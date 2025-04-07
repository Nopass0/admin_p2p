import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { Prisma } from "@prisma/client";

// Подключаем плагины для работы с таймзонами
dayjs.extend(utc);
dayjs.extend(timezone);

// Константы для расчета сопоставлений
const MINUTES_THRESHOLD = 30; // Порог в 30 минут
const COMMISSION = 1.009; // Комиссия 0.9%
const MOSCOW_TIMEZONE = "Europe/Moscow"; // Московская таймзона

// Функция для преобразования даты из локальной в UTC
const convertToUTC = (date: string) => {
  return dayjs(date).toISOString();
};

// Функция для преобразования даты из UTC в московское время
const convertToMoscow = (date: string) => {
  return dayjs(date).tz(MOSCOW_TIMEZONE).format();
};

export const matchRouter = createTRPCRouter({
  // Запуск процесса сопоставления транзакций
  matchTransactions: publicProcedure
  .input(z.object({
    startDate: z.string(),
    endDate: z.string(),
    approvedOnly: z.boolean().optional().default(true),
    userId: z.number().int().positive().nullable().optional(),
    userIds: z.array(z.number().int().positive()).optional(),
    // Keep cabinetIds for backward compatibility
    cabinetIds: z.array(z.number().int().positive()).optional(),
    // New parameter for per-cabinet date configurations
    cabinetConfigs: z.array(z.object({
      cabinetId: z.number().int().positive(),
      startDate: z.string(),
      endDate: z.string(),
    })).optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    try {
      const { startDate, endDate, approvedOnly, userId, userIds, cabinetConfigs } = input;
      
      console.log(`Начинаем сопоставление транзакций с ${startDate} по ${endDate}`);
      
      // Преобразуем глобальные даты с учетом таймзоны
      const globalStartDateTime = dayjs(startDate).utc().toDate();
      const globalEndDateTime = dayjs(endDate).utc().toDate();
      
      console.log(`UTC даты: с ${globalStartDateTime.toISOString()} по ${globalEndDateTime.toISOString()}`);
      
      // Получаем IdexTransactions в указанном диапазоне дат
      let idexTransactionsWhere: any;
      
      if (cabinetConfigs && cabinetConfigs.length > 0) {
        // Если есть конфигурации кабинетов, создаем условия OR для каждого кабинета
        idexTransactionsWhere = {
          OR: cabinetConfigs.map(config => ({
            AND: [
              { cabinetId: config.cabinetId },
              {
                approvedAt: {
                  gte: dayjs(config.startDate).utc().toISOString(),
                  lte: dayjs(config.endDate).utc().toISOString()
                }
              }
            ]
          }))
        };
        
        // Для логирования
        cabinetConfigs.forEach(config => {
          console.log(`Кабинет ID ${config.cabinetId}: с ${config.startDate} по ${config.endDate}`);
        });
      } else {
        // Если кабинеты выбраны, но без конфигураций, используем глобальный диапазон
        const cabinetIds = input.cabinetIds || 
          (cabinetConfigs ? cabinetConfigs.map(config => config.cabinetId) : []);
          
        if (cabinetIds.length > 0) {
          idexTransactionsWhere = {
            cabinetId: {
              in: cabinetIds
            },
            approvedAt: {
              gte: globalStartDateTime.toISOString(),
              lte: globalEndDateTime.toISOString()
            }
          };
        } else {
          // Если нет выбранных кабинетов, используем только глобальный диапазон
          idexTransactionsWhere = {
            approvedAt: {
              gte: globalStartDateTime.toISOString(),
              lte: globalEndDateTime.toISOString()
            }
          };
        }
      }
      
      const idexTransactions = await ctx.db.idexTransaction.findMany({
        where: idexTransactionsWhere,
      });
      
      // Фильтруем IdexTransactions по диапазону дат
      const filteredIdexTransactions = idexTransactions.filter(tx => {
        if (!tx.approvedAt) return false;
        
        // Если для этого кабинета есть специальный диапазон дат, проверяем по нему
        if (cabinetConfigs) {
          const cabinetConfig = cabinetConfigs.find(config => config.cabinetId === tx.cabinetId);
          if (cabinetConfig) {
            const configStartDate = dayjs(cabinetConfig.startDate).utc();
            const configEndDate = dayjs(cabinetConfig.endDate).utc();
            const approvedDate = dayjs(tx.approvedAt).utc();
            return approvedDate.isAfter(configStartDate) && approvedDate.isBefore(configEndDate);
          }
        }
        
        // Иначе проверяем по глобальному диапазону
        const approvedDate = dayjs(tx.approvedAt).utc();
        return approvedDate.isAfter(globalStartDateTime) && approvedDate.isBefore(globalEndDateTime);
      });
      
      console.log(`Найдено ${filteredIdexTransactions.length} IdexTransactions в указанном диапазоне`);
      
      // Получаем Transactions в указанном диапазоне дат
      let transactionsWhere: any = {
        dateTime: {
          gte: globalStartDateTime.toISOString(),
          lte: globalEndDateTime.toISOString()
        }
      };
      
      // Добавляем фильтр по пользователю, если указан
      if (userId) {
        transactionsWhere.userId = userId;
      }
      
      // Добавляем фильтр по массиву пользователей, если указан
      if (userIds && userIds.length > 0) {
        transactionsWhere.userId = {
          in: userIds
        };
      }
      
      const transactions = await ctx.db.transaction.findMany({
        where: transactionsWhere,
      });
      
      console.log(`Найдено ${transactions.length} Transactions в указанном диапазоне`);
      
      // Остальная логика сопоставления остается без изменений
      const matchedIdexTransactions = new Set<number>();
      const matchedTransactions = new Set<number>();
      const matches = [];
      
      // Пытаемся сопоставить каждую IdexTransaction
      for (const idexTx of filteredIdexTransactions) {
        if (matchedIdexTransactions.has(idexTx.id)) continue;
        if (!idexTx.approvedAt) continue; // Пропускаем, если нет даты подтверждения
        
        // Парсим поле amount для получения значения
        let amountValue = 0;
        try {
          // Проверяем, является ли amount строкой JSON
          if (typeof idexTx.amount === 'string') {
            const amountJson = JSON.parse(idexTx.amount as string);
            amountValue = parseFloat(amountJson.trader?.[643] || 0);
          } else {
            // Если amount уже является объектом
            const amountObj = idexTx.amount as any;
            amountValue = parseFloat(amountObj.trader?.[643] || 0);
          }
        } catch (error) {
          console.error('Ошибка при парсинге JSON поля amount:', error);
          continue;
        }
        
        // Находим потенциальные совпадения
        const potentialMatches = transactions
          .filter(tx => {
            // Пропускаем уже сопоставленные транзакции
            if (matchedTransactions.has(tx.id)) return false;
            
            // Проверяем, совпадает ли totalPrice
            if (Math.abs(tx.totalPrice - amountValue) > 0.01) return false;
            
            // Проверяем, находится ли дата в пределах +/- 30 минут
            const timeDiff = getTimeDifferenceInMinutes(idexTx.approvedAt!, tx.dateTime.toISOString());
            return timeDiff <= MINUTES_THRESHOLD;
          })
          .map(tx => ({
            transaction: tx,
            timeDiff: getTimeDifferenceInMinutes(idexTx.approvedAt!, tx.dateTime.toISOString())
          }))
          .sort((a, b) => a.timeDiff - b.timeDiff); // Сортировка по разнице во времени (ближайшая первая)
        
        // Если у нас есть совпадение
        if (potentialMatches.length > 0) {
          const match = potentialMatches[0];
          const tx = match.transaction;
          
          // Отмечаем обе транзакции как сопоставленные
          matchedIdexTransactions.add(idexTx.id);
          matchedTransactions.add(tx.id);
          
          // Рассчитываем метрики матча
          const metrics = calculateMatchMetrics(tx, idexTx);
          
          // Создаем объект матча для пакетного создания
          matches.push({
            idexTransactionId: idexTx.id,
            transactionId: tx.id,
            timeDifference: Math.round(match.timeDiff * 60), // Конвертируем минуты в секунды
            grossExpense: metrics.grossExpense,
            grossIncome: metrics.grossIncome,
            grossProfit: metrics.grossProfit,
            profitPercentage: metrics.profitPercentage
          });
        }
      }
      
      console.log(`Найдено ${matches.length} совпадений`);
      
      // Создаем все совпадения в базе данных
      if (matches.length > 0) {
        await ctx.db.match.createMany({
          data: matches,
          skipDuplicates: true
        });
        
        console.log(`Сохранено ${matches.length} совпадений в базе данных`);
      }
      
      // Рассчитываем совокупную статистику
      const matchCount = matches.length;
      const totalGrossExpense = matches.reduce((sum, match) => sum + match.grossExpense, 0);
      const totalGrossIncome = matches.reduce((sum, match) => sum + match.grossIncome, 0);
      const totalGrossProfit = matches.reduce((sum, match) => sum + match.grossProfit, 0);
      const totalProfitPercentage = totalGrossExpense ? (totalGrossProfit / totalGrossExpense) * 100 : 0;
      const profitPerOrder = matchCount ? totalGrossProfit / matchCount : 0;
      const expensePerOrder = matchCount ? totalGrossExpense / matchCount : 0;
      
      // Статистика для всех транзакций остается без изменений
      const totalTransactions = await ctx.db.transaction.count({
        where: transactionsWhere
      });
      
      const totalIdexTransactions = await ctx.db.idexTransaction.count({
        where: {
          approvedAt: {
            not: null
          }
        }
      });
      
      return {
        success: true,
        stats: {
          grossExpense: totalGrossExpense,
          grossIncome: totalGrossIncome,
          grossProfit: totalGrossProfit,
          profitPercentage: totalProfitPercentage,
          matchedCount: matchCount,
          profitPerOrder,
          expensePerOrder,
          totalTransactions,
          totalIdexTransactions,
          totalMatchedTransactions: matchCount,
          totalMatchedIdexTransactions: matchCount
        }
      };
    } catch (error) {
      console.error("Ошибка при сопоставлении транзакций:", error);
      return { 
        success: false, 
        message: "Произошла ошибка при сопоставлении транзакций" 
      };
    }
  }),

  deleteByFilter: publicProcedure
    .input(z.object({
      userIds: z.array(z.number().int().positive()),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { userIds, startDate, endDate } = input;
        
        // Преобразуем даты с учетом таймзоны
        const startDateTime = dayjs(startDate).utc().toDate();
        const endDateTime = dayjs(endDate).utc().toDate();

        console.log(`Получены данные:`, { userIds, startDate, endDate });
        
        // Удаляем сопоставления
        // Находим транзакции пользователей в указанном диапазоне дат
        const userTransactions = await ctx.db.transaction.findMany({
          where: {
            userId: { in: userIds },
            dateTime: {
              gte: startDateTime,
              lte: endDateTime
            }
          },
          select: { id: true }
        });
      

        // Получаем ID транзакций
        const transactionIds = userTransactions.map(t => t.id);

        console.log(`Найдено ${transactionIds.length} транзакций`);

        // Удаляем все совпадения для найденных транзакций
        const deleteResult = await ctx.db.match.deleteMany({
          where: {
            transactionId: { in: transactionIds }
          }
        });

        // Удаляем сопоставления в bybit
        //get all bybit transactions by dates and userIds
        const bybitTransactions = await ctx.db.bybitTransaction.findMany({
          where: {
            userId: { in: userIds },
            dateTime: {
              gte: startDateTime,
              lte: endDateTime
            }
          },
          select: { id: true }
        });
        
        // Получаем ID транзакций
        const bybitTransactionIds = bybitTransactions.map(t => t.id);

        console.log(`Найдено ${bybitTransactionIds.length} транзакций в bybit`);

        // Удаляем все совпадения для найденных транзакций
        const bybitDeleteResult = await ctx.db.bybitMatch.deleteMany({
          where: {
            bybitTransactionId: { in: bybitTransactionIds }
          }
        });
        
        console.log(`Удалено ${deleteResult.count} сопоставлений`);
        console.log(`Удалено ${bybitDeleteResult.count} сопоставлений в bybit`);
        
        return { success: true };
      } catch (error) {
        console.error("Ошибка при удалении сопоставлений:", error);
        return { success: false, message: "Произошла ошибка при удалении сопоставлений" };
      }
    }),

  // Получение сопоставлений для пользователя
  getUserMatches: publicProcedure
    .input(z.object({
      userId: z.number().int().positive(),
      startDate: z.string(),
      endDate: z.string(),
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().default(10),
      sortColumn: z.string().optional(),
      sortDirection: z.enum(["asc", "desc", "null"]).optional(),
      cabinetIds: z.array(z.number().int().positive()).optional()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const { userId, startDate, endDate, page, pageSize, sortColumn, sortDirection, cabinetIds } = input;
        
        // Преобразуем даты с учетом таймзоны
        const startDateTime = dayjs(startDate).utc().toDate();
        const endDateTime = dayjs(endDate).utc().toDate();
        
        // Расчет пагинации
        const skip = (page - 1) * pageSize;
        
        // Формируем объект сортировки
        let orderBy: any = { createdAt: 'desc' };
        
        if (sortColumn && sortDirection && sortDirection !== "null") {
          // Обрабатываем специальные случаи для вложенных полей
          if (sortColumn === "transaction.user.name") {
            orderBy = {
              transaction: {
                user: {
                  name: sortDirection
                }
              }
            };
          } else if (sortColumn === "transaction.dateTime") {
            orderBy = {
              transaction: {
                dateTime: sortDirection
              }
            };
          } else if (sortColumn === "transaction.totalPrice") {
            orderBy = {
              transaction: {
                totalPrice: sortDirection
              }
            };
          } else if (sortColumn === "idexTransaction.externalId") {
            orderBy = {
              idexTransaction: {
                externalId: sortDirection
              }
            };
          } else if (sortColumn === "idexTransaction.approvedAt") {
            orderBy = {
              idexTransaction: {
                approvedAt: sortDirection
              }
            };
          } else {
            // Обычные поля
            orderBy = {
              [sortColumn]: sortDirection
            };
          }
        }
        
        // Получаем сопоставления для пользователя
        const matches = await ctx.db.match.findMany({
          where: {
            transaction: {
              userId,
              dateTime: {
                gte: startDateTime,
                lte: endDateTime
              },
              
            }
          },
          include: {

            transaction: {
              include: {
                user: true
              }
            },
            idexTransaction: {
              include: {
                cabinet: true
              }
            }
          },

          orderBy,
          skip,
          take: pageSize
        });
        
        // Считаем общее количество сопоставлений для пагинации
        const totalMatches = await ctx.db.match.count({
          where: {
            transaction: {
              userId,
              dateTime: {
                gte: startDateTime,
                lte: endDateTime
              },

            }
          }
        });
        
        // Рассчитываем общее количество страниц
        const totalPages = Math.ceil(totalMatches / pageSize) || 1;
        
        // Рассчитываем статистику пользователя
        const allUserMatches = await ctx.db.match.findMany({
          where: {
            transaction: {
              userId,
              dateTime: {
                gte: startDateTime,
                lte: endDateTime
              }
            }
          }
        });
        
        const stats = calculateTotalStats(allUserMatches);
        
        // Получаем общее количество телеграм-транзакций и сколько из них сопоставлено
        const totalUserTransactions = await ctx.db.transaction.count({
          where: {
            userId,
            dateTime: {
              gte: startDateTime,
              lte: endDateTime
            }
          }
        });
        
        const totalMatchedUserTransactions = await ctx.db.transaction.count({
          where: {
            userId,
            dateTime: {
              gte: startDateTime,
              lte: endDateTime
            },
            matches: {
              some: {}
            }
          }
        });

        // Получаем общее количество IDEX транзакций в указанном диапазоне
        const totalIdexTransactions = await ctx.db.idexTransaction.count({
          where: {
            approvedAt: {
              gte: startDateTime.toISOString(),
              lte: endDateTime.toISOString()
            }
          }
        });
        
        // Получаем количество заматченных IDEX транзакций с этим пользователем
        const matchedIdexTransactions = await ctx.db.match.count({
          where: {
            transaction: {
              userId,
              dateTime: {
                gte: startDateTime,
                lte: endDateTime
              }
            }
          }
        });

                    // Get Bybit statistics for this user
      const bybitTransactions = await ctx.db.bybitTransaction.findMany({
        where: {
          userId
        },
        select: {
          id: true,
          dateTime: true,
          originalData: true
        }
      });
      
      // Фильтруем по Time из originalData с более точной датой
      const filteredBybitIds = bybitTransactions
        .filter(tx => {
          try {
            // Извлекаем Time из originalData
            const originalData = typeof tx.originalData === 'string'
              ? JSON.parse(tx.originalData)
              : tx.originalData;
              
            if (originalData && originalData.Time) {
              // Добавляем 3 часа к Time
              const txTime = dayjs(originalData.Time).add(3, 'hour');
              // Проверяем, попадает ли в диапазон дат, включая границы
              return txTime.isAfter(dayjs(startDateTime).subtract(1, 'millisecond')) && txTime.isBefore(dayjs(endDateTime).add(1, 'millisecond'));
            }
              
            // Если нет Time, используем обычное dateTime
            return tx.dateTime >= startDateTime && tx.dateTime <= endDateTime;
          } catch (error) {
            console.error("Error parsing originalData for transaction:", tx.id, error);
            // Если ошибка парсинга, используем обычное dateTime
            return tx.dateTime >= startDateTime && tx.dateTime <= endDateTime;
          }
        })
        .map(tx => tx.id);
      
      const totalUserBybitTransactions = filteredBybitIds.length;
      
      const matchedUserBybitTransactions = await ctx.db.bybitTransaction.count({
        where: {
          userId,
          dateTime: {
            gte: startDateTime,
            lte: endDateTime
          },
          BybitMatch: {
            some: {}
          }
        }
      });
      
      const unmatchedUserBybitTransactions = totalUserBybitTransactions - matchedUserBybitTransactions;
        
        return {
          success: true,
          matches: matches.map(match => ({
            ...match,
            // Преобразуем даты в московский формат для вывода
            transaction: {
              ...match.transaction,
              dateTime: dayjs(match.transaction.dateTime).tz(MOSCOW_TIMEZONE).format()
            },
            idexTransaction: {
              ...match.idexTransaction,
              approvedAt: match.idexTransaction.approvedAt ? 
                dayjs(match.idexTransaction.approvedAt).tz(MOSCOW_TIMEZONE).format() : null
            },
            cabinet: match.transaction.user.cabinet
          })),
          stats: {
            ...stats,
            totalTelegramTransactions: totalUserTransactions,
            totalTransactions: totalUserTransactions,
            totalIdexTransactions,
            matchedTelegramTransactions: totalMatchedUserTransactions,
            matchedTransactions: totalMatchedUserTransactions,
            matchedIdexTransactions,
            unmatchedTelegramTransactions: totalUserTransactions - totalMatchedUserTransactions,
            unmatchedIdexTransactions: totalIdexTransactions - matchedIdexTransactions,
            totalBybitTransactions: totalUserBybitTransactions,
            matchedBybitTransactions: matchedUserBybitTransactions,
            unmatchedBybitTransactions: unmatchedUserBybitTransactions
          },
          pagination: {
            totalMatches,
            totalPages,
            currentPage: page,
            pageSize
          }
        };
      } catch (error) {
        console.error("Ошибка при получении сопоставлений пользователя:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при получении сопоставлений пользователя",
          matches: [],
          stats: null,
          pagination: {
            totalMatches: 0,
            totalPages: 0,
            currentPage: input.page,
            pageSize: input.pageSize
          }
        };
      }
    }),

    getCabinetMatchStats: publicProcedure
  .input(z.object({
    startDate: z.string(),
    endDate: z.string(),
    userId: z.number().int().positive().nullable().optional()
  }))
  .query(async ({ ctx, input }) => {
    try {
      const { startDate, endDate, userId } = input;
      
      // Преобразуем даты с учетом таймзоны
      const startDateTime = dayjs(startDate).utc().toDate();
      const endDateTime = dayjs(endDate).utc().toDate();
      
      // Получаем все кабинеты
      const cabinets = await ctx.db.idexCabinet.findMany();
      
      // Получаем статистику по сопоставленным транзакциям для каждого кабинета
      const cabinetStats: Record<number, { 
        matchCount: number; 
        totalCount: number;
        hasUserMatches: boolean;
        userMatchCount?: number;
      }> = {};
      
      // Инициализируем объект статистики для всех кабинетов
      for (const cabinet of cabinets) {
        cabinetStats[cabinet.id] = {
          matchCount: 0,
          totalCount: 0,
          hasUserMatches: false
        };
      }
      
      // Получаем сопоставления для всех кабинетов
      const matchesQuery = {
        where: {
          OR: [
            {
              transaction: {
                dateTime: {
                  gte: startDateTime,
                  lte: endDateTime
                }
              }
            },
            {
              idexTransaction: {
                approvedAt: {
                  gte: startDateTime.toISOString(),
                  lte: endDateTime.toISOString()
                }
              }
            }
          ]
        },
        include: {
          idexTransaction: {
            select: {
              cabinetId: true
            }
          },
          transaction: {
            select: {
              userId: true
            }
          }
        }
      };
      
      const matches = await ctx.db.match.findMany(matchesQuery);
      
      // Получаем все IDEX транзакции для выбранного периода
      const idexTransactions = await ctx.db.idexTransaction.findMany({
        where: {
          approvedAt: {
            gte: startDateTime.toISOString(),
            lte: endDateTime.toISOString()
          }
        },
        select: {
          id: true,
          cabinetId: true
        }
      });
      
      // Считаем общее количество транзакций для каждого кабинета
      for (const tx of idexTransactions) {
        if (cabinetStats[tx.cabinetId]) {
          cabinetStats[tx.cabinetId].totalCount++;
        }
      }
      
      // Подсчитываем количество сопоставлений для каждого кабинета
      for (const match of matches) {
        const cabinetId = match.idexTransaction.cabinetId;
        
        if (cabinetStats[cabinetId]) {
          cabinetStats[cabinetId].matchCount++;
          
          // Проверяем, связан ли кабинет с выбранным пользователем
          if (userId && match.transaction.userId === userId) {
            cabinetStats[cabinetId].hasUserMatches = true;
            cabinetStats[cabinetId].userMatchCount = (cabinetStats[cabinetId].userMatchCount || 0) + 1;
          }
        }
      }
      
      // Считаем количество кабинетов с сопоставлениями
      const totalCabinets = cabinets.length;
      const matchedCabinets = Object.values(cabinetStats).filter(stats => stats.matchCount > 0).length;
      
      // Считаем количество кабинетов с сопоставлениями у выбранного пользователя
      const userMatchedCabinets = userId 
        ? Object.values(cabinetStats).filter(stats => stats.hasUserMatches).length 
        : 0;
      
      return {
        success: true,
        cabinetStats,
        totalCabinets,
        matchedCabinets,
        userMatchedCabinets
      };
    } catch (error) {
      console.error("Ошибка при получении статистики по кабинетам:", error);
      return {
        success: false,
        message: "Произошла ошибка при получении статистики по кабинетам",
        cabinetStats: {},
        totalCabinets: 0,
        matchedCabinets: 0,
        userMatchedCabinets: 0
      };
    }
  }),

  // Получение Bybit транзакций пользователя
getBybitTransactions: publicProcedure
.input(z.object({
  userId: z.number().int().positive().nullable().optional(),
  startDate: z.string(),
  endDate: z.string(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().default(10),
  searchQuery: z.string().optional(),
  sortColumn: z.string().optional(),
  sortDirection: z.enum(["asc", "desc", "null"]).optional()
}))
.query(async ({ ctx, input }) => {
  try {
    const { userId, startDate, endDate, page, pageSize, searchQuery, sortColumn, sortDirection } = input;
    
    // Преобразуем даты с учетом таймзоны
    const startDateTime = dayjs(startDate).utc().toDate();
    const endDateTime = dayjs(endDate).utc().toDate();
    
    // Базовый фильтр
    let where: any = {
      dateTime: {
        gte: startDateTime,
        lte: endDateTime
      }
    };
    
    // Добавляем фильтр по пользователю, если указан
    if (userId) {
      where.userId = userId;
    }
    
    // Добавляем поиск, если указан
    if (searchQuery) {
      where.OR = [
        { orderNo: { contains: searchQuery } },
        { counterparty: { contains: searchQuery } },
        { totalPrice: { equals: parseFloat(searchQuery) || undefined } }
      ];
    }
    
    // Формируем объект сортировки
    let orderBy: any = { dateTime: 'desc' };
    
    if (sortColumn && sortDirection && sortDirection !== "null") {
      // Обрабатываем специальные случаи для вложенных полей
      if (sortColumn === "user.name") {
        orderBy = {
          user: {
            name: sortDirection
          }
        };
      } else {
        orderBy = {
          [sortColumn]: sortDirection
        };
      }
    }
    
    // Получаем Bybit транзакции
    const transactions = await ctx.db.bybitTransaction.findMany({
      where,
      include: {
        user: true,
        BybitMatch: true
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize
    });
    
    // Считаем общее количество для пагинации
    const totalTransactions = await ctx.db.bybitTransaction.count({
      where
    });

    // Считаем статистику по соответствиям
    const matchedTransactions = await ctx.db.bybitTransaction.count({
      where: {
        ...where,
        BybitMatch: {
          some: {}
        }
      }
    });
    
    const unmatchedTransactions = totalTransactions - matchedTransactions;
    
    return {
      success: true,
      transactions: transactions.map(tx => ({
        ...tx,
        // Преобразуем дату в московский формат для вывода
        dateTime: dayjs(tx.dateTime).tz(MOSCOW_TIMEZONE).format()
      })),
      stats: {
        totalTransactions,
        matchedTransactions,
        unmatchedTransactions
      },
      pagination: {
        totalTransactions,
        totalPages: Math.ceil(totalTransactions / pageSize) || 1,
        currentPage: page,
        pageSize
      }
    };
  } catch (error) {
    console.error("Ошибка при получении Bybit транзакций:", error);
    return {
      success: false,
      message: "Ошибка при получении Bybit транзакций",
      transactions: [],
      stats: {
        totalTransactions: 0,
        matchedTransactions: 0,
        unmatchedTransactions: 0
      },
      pagination: {
        totalTransactions: 0,
        totalPages: 0,
        currentPage: input.page,
        pageSize: input.pageSize
      }
    };
  }
}),

// Получение несопоставленных Bybit транзакций
getUnmatchedBybitTransactions: publicProcedure
.input(z.object({
  userId: z.number().int().positive().nullable().optional(),
  startDate: z.string(),
  endDate: z.string(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().default(10),
  searchQuery: z.string().optional(),
  sortColumn: z.string().optional(),
  sortDirection: z.enum(["asc", "desc", "null"]).optional()
}))
.query(async ({ ctx, input }) => {
  try {
    const { userId, startDate, endDate, page, pageSize, searchQuery, sortColumn, sortDirection } = input;
    
    // Convert dates to dayjs objects for easier comparison
    const startDateObj = dayjs(startDate).utc();
    const endDateObj = dayjs(endDate).utc();
    
    // Base filter - only filter for unmatched transactions and optionally by user
    let where: any = {
      // Only unmatched transactions
      BybitMatch: {
        none: {}
      }
    };
    
    // Add user filter if specified
    if (userId) {
      where.userId = userId;
    }
    
    // Extended search if specified
    if (searchQuery && searchQuery.trim() !== '') {
      // Check if search query can be a number
      const numericSearch = !isNaN(parseFloat(searchQuery)) ? parseFloat(searchQuery) : null;
      
      const searchConditions = [];
      
      // Search string fields
      searchConditions.push(
        { orderNo: { contains: searchQuery, mode: 'insensitive' } },
        { counterparty: { contains: searchQuery, mode: 'insensitive' } },
        { type: { contains: searchQuery, mode: 'insensitive' } },
        { asset: { contains: searchQuery, mode: 'insensitive' } },
        { status: { contains: searchQuery, mode: 'insensitive' } }
      );
      
      // If user relation exists, search in user data
      searchConditions.push({
        user: {
          name: { contains: searchQuery, mode: 'insensitive' }
        }
      });
      
      // Search numeric fields (only if search query can be converted to a number)
      if (numericSearch !== null) {
        searchConditions.push(
          // Exact match
          { id: { equals: parseInt(searchQuery) || undefined } },
          { totalPrice: { equals: numericSearch } },
          { amount: { equals: numericSearch } },
          { unitPrice: { equals: numericSearch } },
          
          // Approximate match for prices (search values that contain the entered number)
          { totalPrice: { gte: numericSearch - 0.01, lte: numericSearch + 0.01 } },
          { amount: { gte: numericSearch - 0.01, lte: numericSearch + 0.01 } },
          { unitPrice: { gte: numericSearch - 0.01, lte: numericSearch + 0.01 } }
        );
      }
      
      // Search inside originalData JSON field
      searchConditions.push({
        originalData: {
          path: ['Time'],
          string_contains: searchQuery
        }
      });
      
      searchConditions.push({
        originalData: {
          path: ['Cryptocurrency'],
          string_contains: searchQuery
        }
      });
      
      searchConditions.push({
        originalData: {
          path: ['Counterparty'],
          string_contains: searchQuery
        }
      });
      
      searchConditions.push({
        originalData: {
          path: ['Order No.'],
          string_contains: searchQuery
        }
      });
      
      // If numericSearch is not null, search in numeric JSON fields
      if (numericSearch !== null) {
        searchConditions.push({
          originalData: {
            path: ['Fiat Amount'],
            equals: numericSearch.toString()
          }
        });
        
        searchConditions.push({
          originalData: {
            path: ['Coin Amount'],
            equals: numericSearch.toString()
          }
        });
        
        searchConditions.push({
          originalData: {
            path: ['Price'],
            equals: numericSearch.toString()
          }
        });
      }
      
      // Add search conditions to where
      where.OR = searchConditions;
    }
    
    // Get all unmatched Bybit transactions (without date filtering in DB query)
    const allTransactions = await ctx.db.bybitTransaction.findMany({
      where,
      include: {
        user: true
      }
    });
    
    // Function to get and parse Time from originalData
    const getTransactionTime = (tx: any) => {
      try {
        const originalData = typeof tx.originalData === 'string'
          ? JSON.parse(tx.originalData)
          : tx.originalData;
        
        if (originalData && originalData.Time) {
          return dayjs(originalData.Time).add(3, 'hour');
        }
        // Fallback to dateTime from DB if Time not found
        return dayjs(tx.dateTime);
      } catch (error) {
        console.error("Error parsing originalData for transaction:", tx.id, error);
        return dayjs(tx.dateTime);
      }
    };
    
    // Filter transactions based on the Time field in originalData
    const filteredTransactions = allTransactions.filter(tx => {
      const transactionTime = getTransactionTime(tx);
      return transactionTime.isAfter(startDateObj) && transactionTime.isBefore(endDateObj);
    });
    
    // Sort function for transactions
    const sortTransactions = (a: any, b: any) => {
      if (sortColumn && sortDirection && sortDirection !== "null") {
        let aValue, bValue;
        
        // Handle nested fields
        if (sortColumn === "user.name") {
          aValue = a.user?.name;
          bValue = b.user?.name;
        } else if (sortColumn === "dateTime") {
          // For dateTime, sort by the parsed Time field
          aValue = getTransactionTime(a).valueOf();
          bValue = getTransactionTime(b).valueOf();
        } else {
          aValue = a[sortColumn];
          bValue = b[sortColumn];
        }
        
        if (aValue === bValue) return 0;
        
        if (sortDirection === "asc") {
          return aValue < bValue ? -1 : 1;
        } else {
          return aValue > bValue ? -1 : 1;
        }
      } else {
        // Default sort by Time in originalData (desc)
        const aTime = getTransactionTime(a).valueOf();
        const bTime = getTransactionTime(b).valueOf();
        return bTime - aTime;
      }
    };
    
    // Sort the filtered transactions
    const sortedTransactions = [...filteredTransactions].sort(sortTransactions);
    
    // Apply pagination
    const paginatedTransactions = sortedTransactions.slice(
      (page - 1) * pageSize,
      page * pageSize
    );
    
    // Total count for pagination
    const totalTransactions = filteredTransactions.length;
    
    return {
      success: true,
      transactions: paginatedTransactions.map(tx => {
        // Get the transaction time from originalData
        const transactionTime = getTransactionTime(tx).toDate();
        
        return {
          ...tx,
          // Convert date to Moscow format for display
          dateTime: dayjs(transactionTime).tz(MOSCOW_TIMEZONE).format()
        };
      }),
      pagination: {
        totalTransactions,
        totalPages: Math.ceil(totalTransactions / pageSize) || 1,
        currentPage: page,
        pageSize
      }
    };
  } catch (error) {
    console.error("Ошибка при получении несопоставленных Bybit транзакций:", error);
    return {
      success: false,
      message: "Ошибка при получении несопоставленных Bybit транзакций",
      transactions: [],
      pagination: {
        totalTransactions: 0,
        totalPages: 0,
        currentPage: input.page,
        pageSize: input.pageSize
      }
    };
  }
}),

// Сопоставление Bybit транзакций с IDEX транзакциями
matchBybitWithIdex: publicProcedure
.input(z.object({
  startDate: z.string(),
  endDate: z.string(),
  userId: z.number().int().positive().nullable().optional(),
  userIds: z.array(z.number().int().positive()).optional(),
  // Keep cabinetIds for backward compatibility
  cabinetIds: z.array(z.number().int().positive()).optional(),
  // Add support for per-cabinet date configurations
  cabinetConfigs: z.array(z.object({
    cabinetId: z.number().int().positive(),
    startDate: z.string(),
    endDate: z.string(),
  })).optional(),
}))
.mutation(async ({ ctx, input }) => {
  try {
    const { startDate, endDate, userId, userIds, cabinetIds, cabinetConfigs } = input;
    
    // Преобразуем глобальные даты с учетом таймзоны
    const globalStartDateTime = dayjs(startDate).utc().toDate();
    const globalEndDateTime = dayjs(endDate).utc().toDate();
    
    console.log(`Начинаем сопоставление Bybit транзакций с ${startDate} по ${endDate}`);
    console.log(`UTC даты: с ${globalStartDateTime.toISOString()} по ${globalEndDateTime.toISOString()}`);
    console.log(`userId: ${userId}`);
    console.log(`userIds: ${userIds}`);
    console.log(`cabinetIds: ${cabinetIds}`);
    console.log(`cabinetConfigs: ${cabinetConfigs}`);
    
    // Получаем IDEX транзакции в указанном диапазоне дат с учетом настроек кабинетов
    let idexTransactionsWhere: any;
    
    if (cabinetConfigs && cabinetConfigs.length > 0) {
      // Если есть конфигурации кабинетов, создаем условия OR для каждого кабинета
      idexTransactionsWhere = {
        OR: cabinetConfigs.map(config => ({
          AND: [
            { cabinetId: config.cabinetId },
            {
              approvedAt: {
                gte: dayjs(config.startDate).utc().toISOString(),
                lte: dayjs(config.endDate).utc().toISOString()
              }
            }
          ]
        }))
      };
      
      // Для логирования
      cabinetConfigs.forEach(config => {
        console.log(`Кабинет ID ${config.cabinetId}: с ${config.startDate} по ${config.endDate}`);
      });
    } else {
      // Если кабинеты выбраны, но без конфигураций, используем глобальный диапазон
      const selectedCabinetIds = cabinetIds || 
        (cabinetConfigs ? cabinetConfigs.map(config => config.cabinetId) : []);
        
      if (selectedCabinetIds.length > 0) {
        idexTransactionsWhere = {
          cabinetId: {
            in: selectedCabinetIds
          },
          approvedAt: {
            gte: globalStartDateTime.toISOString(),
            lte: globalEndDateTime.toISOString()
          }
        };
      } else {
        // Если нет выбранных кабинетов, используем только глобальный диапазон
        idexTransactionsWhere = {
          approvedAt: {
            gte: globalStartDateTime.toISOString(),
            lte: globalEndDateTime.toISOString()
          }
        };
      }
    }
    
    // Добавляем условие, что IDEX транзакции не должны быть еще сопоставлены с Bybit
    idexTransactionsWhere = {
      ...idexTransactionsWhere,
      BybitMatch: {
        none: {}
      }
    };
    
    const idexTransactions = await ctx.db.idexTransaction.findMany({
      where: idexTransactionsWhere,
    });
    
    console.log(`Найдено ${idexTransactions.length} IDEX транзакций для сопоставления`);
    
    // Фильтруем IDEX транзакции по диапазону дат кабинетов
    const filteredIdexTransactions = idexTransactions.filter(tx => {
      if (!tx.approvedAt) return false;
      
      // Если для этого кабинета есть специальный диапазон дат, проверяем по нему
      if (cabinetConfigs) {
        const cabinetConfig = cabinetConfigs.find(config => config.cabinetId === tx.cabinetId);
        if (cabinetConfig) {
          const configStartDate = dayjs(cabinetConfig.startDate).utc();
          const configEndDate = dayjs(cabinetConfig.endDate).utc();
          const approvedDate = dayjs(tx.approvedAt).utc();
          return approvedDate.isAfter(configStartDate) && approvedDate.isBefore(configEndDate);
        }
      }
      
      // Иначе проверяем по глобальному диапазону
      const approvedDate = dayjs(tx.approvedAt).utc();
      return approvedDate.isAfter(globalStartDateTime) && approvedDate.isBefore(globalEndDateTime);
    });
    
    console.log(`После фильтрации осталось ${filteredIdexTransactions.length} IDEX транзакций`);
    
    // Получаем Bybit транзакции в указанном диапазоне дат
    let bybitTransactionsWhere: any = {
      dateTime: {
        gte: globalStartDateTime,
        lte: globalEndDateTime
      },
      // Только несопоставленные
      BybitMatch: {
        none: {}
      }
    };
    
    // Применяем фильтр по пользователю, если указан
    if (userId) {
      bybitTransactionsWhere.userId = userId;
    }
    
    // Применяем фильтр по массиву пользователей, если указан
    if (userIds && userIds.length > 0) {
      bybitTransactionsWhere.userId = {
        in: userIds
      };
    }
    
    const bybitTransactions = await ctx.db.bybitTransaction.findMany({
      where: bybitTransactionsWhere
    });
    
    console.log(`Найдено ${bybitTransactions.length} Bybit транзакций для сопоставления`);
    
    // Подготовка к сопоставлению
    const matchedIdexTransactions = new Set<number>();
    const matchedBybitTransactions = new Set<number>();
    const matches = [];
    
    // Пытаемся сопоставить каждую IDEX транзакцию с Bybit транзакцией
    for (const idexTx of filteredIdexTransactions) {
      if (matchedIdexTransactions.has(idexTx.id)) continue;
      if (!idexTx.approvedAt) continue; // Пропускаем, если нет даты подтверждения
      
      // Парсим поле amount для получения значения
      let amountValue = 0;
      try {
        // Проверяем, является ли amount строкой JSON
        if (typeof idexTx.amount === 'string') {
          const amountJson = JSON.parse(idexTx.amount as string);
          amountValue = parseFloat(amountJson.trader?.[643] || 0);
        } else {
          // Если amount уже является объектом
          const amountObj = idexTx.amount as any;
          amountValue = parseFloat(amountObj.trader?.[643] || 0);
        }
      } catch (error) {
        console.error('Ошибка при парсинге JSON поля amount:', error);
        continue;
      }
      
      // Находим потенциальные совпадения Bybit транзакций
      const potentialMatches = bybitTransactions
        .filter(tx => {
          // Пропускаем уже сопоставленные транзакции
          if (matchedBybitTransactions.has(tx.id)) return false;
          
          // Проверяем, совпадает ли totalPrice
          if (Math.abs(tx.totalPrice - amountValue) > 0.01) return false;
          
          // Получаем время из originalData и добавляем 3 часа
          let txTime;
          try {
            const originalData = typeof tx.originalData === 'string' 
              ? JSON.parse(tx.originalData) 
              : tx.originalData;
            
            if (originalData && originalData.Time) {
              const timeStr = originalData.Time;
              const parsedTime = dayjs(timeStr).add(3, 'hour'); // Добавляем 3 часа
              txTime = parsedTime.toISOString();
            } else {
              return false;
            }
          } catch (error) {
            console.error("Error parsing originalData:", error);
            return false;
          }
          
          // Проверяем, находится ли дата в пределах +/- 30 минут
          const timeDiff = getTimeDifferenceInMinutes(idexTx.approvedAt!, txTime);
          console.log(`Time difference: ${timeDiff} minutes, idexTx.approvedAt: ${idexTx.approvedAt}, txTime: ${txTime}`);
          return timeDiff <= MINUTES_THRESHOLD;
        })
        .map(tx => {
          const originalData = typeof tx.originalData === 'string' 
            ? JSON.parse(tx.originalData) 
            : tx.originalData;
          const timeStr = originalData.Time;
          const txTime = dayjs(timeStr).add(3, 'hour').toISOString();
          
          return {
            transaction: tx,
            timeDiff: getTimeDifferenceInMinutes(idexTx.approvedAt!, txTime)
          };
        })
        .sort((a, b) => a.timeDiff - b.timeDiff); // Сортировка по разнице во времени (ближайшая первая)
      
      // Если у нас есть совпадение
      if (potentialMatches.length > 0) {
        const match = potentialMatches[0];
        const tx = match.transaction;
        
        // Отмечаем обе транзакции как сопоставленные
        matchedIdexTransactions.add(idexTx.id);
        matchedBybitTransactions.add(tx.id);
        
        // Рассчитываем метрики матча
        const metrics = calculateBybitMatchMetrics(tx, idexTx);
        
        // Создаем объект матча для пакетного создания
        matches.push({
          idexTransactionId: idexTx.id,
          bybitTransactionId: tx.id,
          timeDifference: Math.round(match.timeDiff * 60), // Конвертируем минуты в секунды
          grossExpense: metrics.grossExpense,
          grossIncome: metrics.grossIncome,
          grossProfit: metrics.grossProfit,
          profitPercentage: metrics.profitPercentage
        });
      }
    }
    
    console.log(`Найдено ${matches.length} сопоставлений между Bybit и IDEX транзакциями`);
    
    // Создаем все сопоставления в базе данных
    if (matches.length > 0) {
      await ctx.db.bybitMatch.createMany({
        data: matches,
        skipDuplicates: true
      });
      
      console.log(`Сохранено ${matches.length} сопоставлений в базе данных`);
    }
    
    // Рассчитываем совокупную статистику
    const matchCount = matches.length;
    const totalGrossExpense = matches.reduce((sum, match) => sum + match.grossExpense, 0);
    const totalGrossIncome = matches.reduce((sum, match) => sum + match.grossIncome, 0);
    const totalGrossProfit = matches.reduce((sum, match) => sum + match.grossProfit, 0);
    const totalProfitPercentage = totalGrossExpense ? (totalGrossProfit / totalGrossExpense) * 100 : 0;
    const profitPerOrder = matchCount ? totalGrossProfit / matchCount : 0;
    const expensePerOrder = matchCount ? totalGrossExpense / matchCount : 0;
    
    return {
      success: true,
      stats: {
        grossExpense: totalGrossExpense,
        grossIncome: totalGrossIncome,
        grossProfit: totalGrossProfit,
        profitPercentage: totalProfitPercentage,
        matchedCount: matchCount,
        profitPerOrder,
        expensePerOrder,
        totalBybitTransactions: bybitTransactions.length,
        totalIdexTransactions: filteredIdexTransactions.length
      }
    };
  } catch (error) {
    console.error("Ошибка при сопоставлении Bybit и IDEX транзакций:", error);
    return { 
      success: false, 
      message: "Произошла ошибка при сопоставлении Bybit и IDEX транзакций" 
    };
  }
}),

// Создание ручного сопоставления Bybit с IDEX
createBybitMatch: publicProcedure
.input(z.object({
  idexTransactionId: z.number().int().positive(),
  bybitTransactionId: z.number().int().positive()
}))
.mutation(async ({ ctx, input }) => {
  try {
    const { idexTransactionId, bybitTransactionId } = input;
    
    // Проверяем, сопоставлена ли уже IDEX транзакция с Bybit
    const existingIdexMatch = await ctx.db.bybitMatch.findFirst({
      where: { idexTransactionId }
    });
    
    if (existingIdexMatch) {
      return {
        success: false,
        message: "IDEX транзакция уже сопоставлена с другой Bybit транзакцией"
      };
    }
    
    // Проверяем, сопоставлена ли уже Bybit транзакция
    const existingBybitMatch = await ctx.db.bybitMatch.findFirst({
      where: { bybitTransactionId }
    });
    
    if (existingBybitMatch) {
      return {
        success: false,
        message: "Bybit транзакция уже сопоставлена с другой IDEX транзакцией"
      };
    }
    
    // Получаем обе транзакции для расчета метрик сопоставления
    const idexTransaction = await ctx.db.idexTransaction.findUnique({
      where: { id: idexTransactionId }
    });
    
    const bybitTransaction = await ctx.db.bybitTransaction.findUnique({
      where: { id: bybitTransactionId }
    });
    
    if (!idexTransaction || !bybitTransaction) {
      return {
        success: false,
        message: "Одна или обе транзакции не найдены"
      };
    }
    
    // Рассчитываем разницу во времени
    let timeDifference = 0;
    if (idexTransaction.approvedAt && bybitTransaction.dateTime) {
      const timeDiffMinutes = getTimeDifferenceInMinutes(
        idexTransaction.approvedAt,
        bybitTransaction.dateTime.toISOString()
      );
      timeDifference = Math.round(timeDiffMinutes * 60); // Конвертируем в секунды
    }
    
    // Рассчитываем метрики сопоставления
    const metrics = calculateBybitMatchMetrics(bybitTransaction, idexTransaction);
    
    // Создаем сопоставление
    const match = await ctx.db.bybitMatch.create({
      data: {
        idexTransactionId,
        bybitTransactionId,
        timeDifference,
        grossExpense: metrics.grossExpense,
        grossIncome: metrics.grossIncome,
        grossProfit: metrics.grossProfit,
        profitPercentage: metrics.profitPercentage
      }
    });
    
    return {
      success: true,
      message: "Транзакции успешно сопоставлены",
      match
    };
  } catch (error) {
    console.error("Ошибка при создании ручного сопоставления Bybit и IDEX:", error);
    return {
      success: false,
      message: "Произошла ошибка при создании ручного сопоставления"
    };
  }
}),

// Получение всех сопоставлений Bybit с IDEX
getBybitMatches: publicProcedure
.input(z.object({
  startDate: z.string(),
  endDate: z.string(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().default(10),
  searchQuery: z.string().optional(),
  sortColumn: z.string().optional(),
  sortDirection: z.enum(["asc", "desc", "null"]).optional(),
  userId: z.number().int().positive().nullable().optional(),
  cabinetIds: z.array(z.number().int().positive()).optional()
}))
.query(async ({ ctx, input }) => {
  try {
    const { startDate, endDate, page, pageSize, searchQuery, sortColumn, sortDirection, userId, cabinetIds } = input;
    
    // Преобразуем даты с учетом таймзоны
    const startDateTime = dayjs(startDate).utc().toDate();
    const endDateTime = dayjs(endDate).utc().toDate();
    

    // для уменьшения количества обрабатываемых записей
    const bybitTransactions = await ctx.db.bybitTransaction.findMany({
      where: {
        ...(userId ? { userId } : {}),
       
      }
    });
    
    console.log(`Предварительно выбрано ${bybitTransactions.length} Bybit транзакций по dateTime`);
    
    // Фильтруем по Time из originalData с более точной датой
    const filteredBybitIds = bybitTransactions
      .filter(tx => {
        try {
          // Извлекаем Time из originalData
          const originalData = typeof tx.originalData === 'string'
            ? JSON.parse(tx.originalData)
            : tx.originalData;
          
          if (originalData && originalData.Time) {
            // Добавляем 3 часа к Time
            const txTime = dayjs(originalData.Time).add(3, 'hour');
            // Проверяем, попадает ли в диапазон дат, включая границы
            return txTime.isAfter(dayjs(startDateTime).subtract(1, 'millisecond')) && txTime.isBefore(dayjs(endDateTime).add(1, 'millisecond'));
          }
          
          // Если нет Time, используем обычное dateTime
          return tx.dateTime >= startDateTime && tx.dateTime <= endDateTime;
        } catch (error) {
          console.error("Error parsing originalData for transaction:", tx.id, error);
          // Если ошибка парсинга, используем обычное dateTime
          return tx.dateTime >= startDateTime && tx.dateTime <= endDateTime;
        }
      })
      .map(tx => tx.id);
    
    // Удаляем возможные дубликаты
    const uniqueBybitIds = [...new Set(filteredBybitIds)];
    
    console.log(`После фильтрации по Time осталось ${uniqueBybitIds.length} уникальных Bybit транзакций`);
    
    // Получаем ТОЧНОЕ количество Bybit транзакций в базе данных для данного периода
    const totalBybitTransactions = await ctx.db.bybitTransaction.count({
      where: {
        id: {
          in: uniqueBybitIds
        }
      }
    });
    
    console.log(`Точное количество Bybit транзакций в базе: ${totalBybitTransactions}`);
    
    // Строим базовый фильтр с учетом отфильтрованных bybitIds
    let where: any = {
      OR: [
        {
          bybitTransaction: {
            id: {
              in: uniqueBybitIds
            }
          }
        },
        {
          idexTransaction: {
            approvedAt: {
              gte: startDateTime.toISOString(),
              lte: endDateTime.toISOString()
            }
          }
        }
      ]
    };
    
    // Добавляем фильтр по пользователю, если указан
    if (userId) {
      where.bybitTransaction = {
        ...where.bybitTransaction,
        userId
      };
    }
    
    // Если указаны идентификаторы кабинетов, добавляем фильтр
    if (cabinetIds && cabinetIds.length > 0) {
      where = {
        ...where,
        AND: [
          {
            idexTransaction: {
              cabinetId: {
                in: cabinetIds
              }
            }
          }
        ]
      };
    }
    
    // Если есть поисковый запрос, добавляем фильтры
    if (searchQuery) {
      where = {
        ...where,
        OR: [
          {
            bybitTransaction: {
              orderNo: { contains: searchQuery }
            }
          },
          {
            bybitTransaction: {
              counterparty: { contains: searchQuery }
            }
          },
          {
            bybitTransaction: {
              user: {
                name: { contains: searchQuery }
              }
            }
          },
          {
            idexTransaction: {
              externalId: { equals: /^\d+$/.test(searchQuery) ? BigInt(searchQuery) : undefined }
            }
          },
          {
            idexTransaction: {
              wallet: { contains: searchQuery }
            }
          }
        ]
      };
    }
    
    // Формируем объект сортировки
    let orderBy: any = {};
    
    if (sortColumn && sortDirection && sortDirection !== "null") {
      // Обрабатываем случаи для вложенных полей
      if (sortColumn.includes(".")) {
        const [parentField, childField] = sortColumn.split(".");
        orderBy = {
          [parentField as string]: {
            [childField as string]: sortDirection
          }
        };
      } else {
        orderBy = {
          [sortColumn]: sortDirection
        };
      }
    } else {
      // Сортировка по умолчанию по дате транзакции
      orderBy = {
        bybitTransaction: {
          dateTime: "desc"
        }
      };
    }
    
    // Получаем сопоставления для текущей страницы
    const matches = await ctx.db.bybitMatch.findMany({
      where,
      include: {
        bybitTransaction: {
          include: {
            user: true
          }
        },
        idexTransaction: {
          include: {
            cabinet: true
          }
        }
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize
    });
    
    // Получаем общее количество сопоставлений для пагинации
    const totalMatches = await ctx.db.bybitMatch.count({
      where
    });
    
    // Получаем статистику по транзакциям IDEX в выбранном диапазоне
    const totalIdexTransactions = await ctx.db.idexTransaction.count({
      where: {
        approvedAt: {
          gte: startDateTime.toISOString(),
          lte: endDateTime.toISOString()
        },
        ...(cabinetIds && cabinetIds.length > 0 ? { cabinetId: { in: cabinetIds } } : {})
      }
    });
    
    // Вычисляем общую статистику для всех сопоставлений
    let stats = {
      grossExpense: 0,
      grossIncome: 0,
      grossProfit: 0,
      profitPercentage: 0,
      matchedCount: 0,
      profitPerOrder: 0,
      expensePerOrder: 0,
    };
    
    // Получаем все сопоставления для расчета статистики
    const allMatches = await ctx.db.bybitMatch.findMany({
      where
    });
    
    if (allMatches.length > 0) {
      const totalGrossExpense = allMatches.reduce((sum, match) => sum + match.grossExpense, 0);
      const totalGrossIncome = allMatches.reduce((sum, match) => sum + match.grossIncome, 0);
      const totalGrossProfit = allMatches.reduce((sum, match) => sum + match.grossProfit, 0);
      const totalProfitPercentage = totalGrossExpense ? (totalGrossProfit / totalGrossExpense) * 100 : 0;
      const profitPerOrder = allMatches.length ? totalGrossProfit / allMatches.length : 0;
      const expensePerOrder = allMatches.length ? totalGrossExpense / allMatches.length : 0;
      
      stats = {
        grossExpense: totalGrossExpense,
        grossIncome: totalGrossIncome,
        grossProfit: totalGrossProfit,
        profitPercentage: totalProfitPercentage,
        matchedCount: allMatches.length,
        profitPerOrder,
        expensePerOrder
      };
    }
    
    // Получаем количество сопоставленных Bybit транзакций
    const matchedBybitTransactions = await ctx.db.bybitMatch.count({
      where: {
        bybitTransaction: {
          id: {
            in: uniqueBybitIds
          }
        }
      }
    });
    
    const unmatchedBybitTransactions = totalBybitTransactions - matchedBybitTransactions;

    const matchedIdexTransactions = await ctx.db.idexTransaction.count({
      where: {
        approvedAt: {
          gte: startDateTime.toISOString(),
          lte: endDateTime.toISOString()
        },
        ...(cabinetIds && cabinetIds.length > 0 ? { cabinetId: { in: cabinetIds } } : {}),
        BybitMatch: {
          some: {}
        }
      }
    });
    
    const unmatchedIdexTransactions = totalIdexTransactions - matchedIdexTransactions;
    
    return {
      success: true,
      matches: matches.map(match => {
        // Extract Time from originalData and add 3 hours
        let adjustedDateTime = match.bybitTransaction.dateTime;
        try {
          const originalData = typeof match.bybitTransaction.originalData === 'string'
            ? JSON.parse(match.bybitTransaction.originalData)
            : match.bybitTransaction.originalData;
          
          if (originalData && originalData.Time) {
            // Add 3 hours to the Time value
            adjustedDateTime = dayjs(originalData.Time).add(3, 'hour').toDate();
          }
        } catch (error) {
          console.error("Error parsing originalData for bybitTransaction:", error);
          // Keep the original dateTime if there was an error
        }
        
        return {
          ...match,
          // Use the adjusted dateTime from originalData.Time + 3 hours
          bybitTransaction: {
            ...match.bybitTransaction,
            dateTime: dayjs(adjustedDateTime).tz(MOSCOW_TIMEZONE).format()
          },
          idexTransaction: {
            ...match.idexTransaction,
            approvedAt: match.idexTransaction.approvedAt ? 
              dayjs(match.idexTransaction.approvedAt).tz(MOSCOW_TIMEZONE).format() : null
          }
        };
      }),
      stats: {
        ...stats,
        totalBybitTransactions,
        totalIdexTransactions,
        totalMatchedIdexTransactions: matchedIdexTransactions,
        totalUnmatchedIdexTransactions: unmatchedIdexTransactions,
        matchedBybitTransactions,
        unmatchedBybitTransactions,
      },
      pagination: {
        totalMatches,
        totalPages: Math.ceil(totalMatches / pageSize) || 1,
        currentPage: page,
        pageSize
      }
    };
  } catch (error) {
    console.error("Ошибка при получении сопоставлений Bybit и IDEX:", error);
    return { 
      success: false, 
      message: "Ошибка при получении сопоставлений Bybit и IDEX",
      matches: [],
      stats: {
        grossExpense: 0,
        grossIncome: 0,
        grossProfit: 0,
        profitPercentage: 0,
        matchedCount: 0,
        profitPerOrder: 0,
        expensePerOrder: 0,
        totalBybitTransactions: 0,
        totalIdexTransactions: 0,
        matchedBybitTransactions: 0,
        unmatchedBybitTransactions: 0
      },
      pagination: {
        totalMatches: 0,
        totalPages: 0,
        currentPage: input.page,
        pageSize: input.pageSize
      }
    };
  }
}),

// Удаление сопоставления Bybit с IDEX
deleteBybitMatch: publicProcedure
.input(z.object({
  matchId: z.number().int().positive()
}))
.mutation(async ({ ctx, input }) => {
  try {
    const { matchId } = input;
    
    // Проверяем, существует ли сопоставление
    const match = await ctx.db.bybitMatch.findUnique({
      where: { id: matchId }
    });
    
    if (!match) {
      return {
        success: false,
        message: "Сопоставление не найдено"
      };
    }
    
    // Удаляем сопоставление
    await ctx.db.bybitMatch.delete({
      where: { id: matchId }
    });
    
    return {
      success: true,
      message: "Сопоставление успешно удалено"
    };
  } catch (error) {
    console.error("Ошибка при удалении сопоставления Bybit и IDEX:", error);
    return {
      success: false,
      message: "Произошла ошибка при удалении сопоставления"
    };
  }
}),

  // Получение всех сопоставлений
  getAllMatches: publicProcedure
  .input(z.object({
    startDate: z.string(),
    endDate: z.string(),
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().default(10),
    searchQuery: z.string().optional(),
    sortColumn: z.string().optional(),
    sortDirection: z.enum(["asc", "desc", "null"]).optional(),
    cabinetIds: z.array(z.number().int().positive()).optional()
  }))
  .query(async ({ ctx, input }) => {
    try {
      const { startDate, endDate, page, pageSize, searchQuery, sortColumn, sortDirection, cabinetIds } = input;
      
      // Convert dates considering timezone
      const startDateTime = dayjs(startDate).utc().toDate();
      const endDateTime = dayjs(endDate).utc().toDate();
      
      // Build base filter for date range for regular matches
      let where: any = {
        OR: [
          {
            transaction: {
              dateTime: {
                gte: startDateTime,
                lte: endDateTime
              }
            }
          },
          {
            idexTransaction: {
              approvedAt: {
                gte: startDateTime.toISOString(),
                lte: endDateTime.toISOString()
              }
            }
          }
        ]
      };

      // For Bybit matches, we'll only filter by idexTransaction initially,
      // then filter by parsed Time field in memory
      let bybitWhere: any = {
        idexTransaction: {
          approvedAt: {
            gte: startDateTime.toISOString(),
            lte: endDateTime.toISOString()
          }
        }
      };

      // If cabinet IDs are specified, add filter
      if (cabinetIds && cabinetIds.length > 0) {
        const cabinetFilter = {
          AND: [
            {
              idexTransaction: {
                cabinetId: {
                  in: cabinetIds
                }
              }
            }
          ]
        };
        where = { ...where, ...cabinetFilter };
        bybitWhere = {
          ...bybitWhere,
          idexTransaction: {
            ...bybitWhere.idexTransaction,
            cabinetId: {
              in: cabinetIds
            }
          }
        };
      }
    
      // If there's a search query, add filters for regular matches
      if (searchQuery) {
        const regularSearchFilter = {
          OR: [
            {
              transaction: {
                externalId: { contains: searchQuery }
              }
            },
            {
              transaction: {
                orderNo: { contains: searchQuery }
              }
            },
            {
              transaction: {
                counterparty: { contains: searchQuery }
              }
            },
            {
              transaction: {
                user: {
                  name: { contains: searchQuery }
                }
              }
            },
            {
              idexTransaction: {
                externalId: { equals: /^\d+$/.test(searchQuery) ? BigInt(searchQuery) : undefined }
              }
            },
            {
              idexTransaction: {
                wallet: { contains: searchQuery }
              }
            }
          ]
        };
        
        where = { ...where, ...regularSearchFilter };
      }
      
      // Create sort object for regular matches
      let orderBy: any = {};
      
      if (sortColumn && sortDirection && sortDirection !== "null") {
        if (sortColumn.includes(".")) {
          const [parentField, childField] = sortColumn.split(".");
          orderBy = {
            [parentField as string]: {
              [childField as string]: sortDirection
            }
          };
        } else {
          orderBy = {
            [sortColumn]: sortDirection
          };
        }
      } else {
        orderBy = {
          transaction: {
            dateTime: "desc"
          }
        };
      }
      
      // Get regular matches for current page
      const matches = await ctx.db.match.findMany({
        where,
        include: {
          transaction: {
            include: {
              user: true
            }
          },
          idexTransaction: {
            include: {
              cabinet: true
            }
          }
        },
        orderBy,
        take: pageSize,
        skip: (page - 1) * pageSize
      });
      
      // For Bybit matches, we need to fetch all and filter in memory based on Time field
      const allBybitMatches = await ctx.db.bybitMatch.findMany({
        where: bybitWhere,
        include: {
          bybitTransaction: {
            include: {
              user: true
            }
          },
          idexTransaction: {
            include: {
              cabinet: true
            }
          }
        }
      });
      
      // Function to parse and check Time field in originalData
      const isInTimeRange = (originalData: any) => {
        try {
          if (originalData && originalData.Time) {
            const transactionTime = dayjs(originalData.Time).add(3, 'hour');
            return transactionTime.isAfter(dayjs(startDateTime)) && 
                   transactionTime.isBefore(dayjs(endDateTime));
          }
          return false;
        } catch {
          return false;
        }
      };
      
      // Filter Bybit matches based on the Time field in originalData
      const filteredBybitMatches = allBybitMatches.filter(match => {
        const originalData = typeof match.bybitTransaction.originalData === 'string'
          ? JSON.parse(match.bybitTransaction.originalData)
          : match.bybitTransaction.originalData;
        
        return isInTimeRange(originalData);
      });
      
      // Apply search filter to bybit matches if needed
      let searchFilteredBybitMatches = filteredBybitMatches;
      if (searchQuery) {
        searchFilteredBybitMatches = filteredBybitMatches.filter(match => {
          const { bybitTransaction, idexTransaction } = match;
          
          // Check if any of the fields contain the search query
          return (
            (bybitTransaction.orderNo && bybitTransaction.orderNo.includes(searchQuery)) ||
            (bybitTransaction.counterparty && bybitTransaction.counterparty.includes(searchQuery)) ||
            (bybitTransaction.user && bybitTransaction.user.name && 
             bybitTransaction.user.name.includes(searchQuery)) ||
            (idexTransaction.externalId && 
             idexTransaction.externalId.toString() === searchQuery) ||
            (idexTransaction.wallet && idexTransaction.wallet.includes(searchQuery))
          );
        });
      }
      
      // Sort the filtered bybit matches
      const sortBybitMatches = (a: any, b: any) => {
        if (sortColumn && sortDirection && sortDirection !== "null") {
          let aValue, bValue;
          
          if (sortColumn.includes(".")) {
            const [parentField, childField] = sortColumn.split(".");
            const parent = parentField === 'transaction' ? 'bybitTransaction' : parentField;
            
            aValue = a[parent]?.[childField];
            bValue = b[parent]?.[childField];
          } else {
            const field = sortColumn === 'transaction' ? 'bybitTransaction' : sortColumn;
            aValue = a[field];
            bValue = b[field];
          }
          
          if (aValue === bValue) return 0;
          
          if (sortDirection === "asc") {
            return aValue < bValue ? -1 : 1;
          } else {
            return aValue > bValue ? -1 : 1;
          }
        } else {
          // Default sort by Time in originalData
          try {
            const aData = typeof a.bybitTransaction.originalData === 'string' 
              ? JSON.parse(a.bybitTransaction.originalData) 
              : a.bybitTransaction.originalData;
            
            const bData = typeof b.bybitTransaction.originalData === 'string' 
              ? JSON.parse(b.bybitTransaction.originalData) 
              : b.bybitTransaction.originalData;
            
            const aTime = aData?.Time ? dayjs(aData.Time).valueOf() : 0;
            const bTime = bData?.Time ? dayjs(bData.Time).valueOf() : 0;
            
            return bTime - aTime; // Desc by default
          } catch {
            return 0;
          }
        }
      };
      
      const sortedBybitMatches = [...searchFilteredBybitMatches].sort(sortBybitMatches);
      
      // Apply pagination to filtered and sorted Bybit matches
      const bybitMatches = sortedBybitMatches.slice(
        (page - 1) * pageSize, 
        page * pageSize
      );
      
      // Count total regular matches for pagination
      const totalMatches = await ctx.db.match.count({
        where
      });
      
      // Count total bybit matches (filtered in memory)
      const totalBybitMatches = searchFilteredBybitMatches.length;
      
      // Get statistics for transactions in selected range
      const totalTransactions = await ctx.db.transaction.count({
        where: {
          dateTime: {
            gte: startDateTime,
            lte: endDateTime
          }
        }
      });
      
      const totalIdexTransactions = await ctx.db.idexTransaction.count({
        where: {
          approvedAt: {
            gte: startDateTime.toISOString(),
            lte: endDateTime.toISOString()
          }
        }
      });
      
      // Get count of unmatched IDEX transactions
      const totalUnmatchedIdexTransactions = await ctx.db.idexTransaction.count({
        where: {
          approvedAt: {
            gte: startDateTime.toISOString(),
            lte: endDateTime.toISOString()
          },
          matches: {
            none: {}
          },
          BybitMatch: {
            none: {}
          }
        }
      });
      
      const totalUnmatchedTransactions = await ctx.db.transaction.count({
        where: {
          dateTime: {
            gte: startDateTime,
            lte: endDateTime
          },
          matches: {
            none: {}
          }
        }
      });
      
      // For Bybit transactions, we need to fetch all and filter in memory
      const allBybitTransactions = await ctx.db.bybitTransaction.findMany({
        include: {
          BybitMatch: {
            select: {
              id: true
            }
          }
        }
      });
      
      // Filter Bybit transactions based on originalData.Time
      const filteredBybitTransactions = allBybitTransactions.filter(tx => {
        const originalData = typeof tx.originalData === 'string'
          ? JSON.parse(tx.originalData)
          : tx.originalData;
        
        return isInTimeRange(originalData);
      });
      
      const totalBybitTransactions = filteredBybitTransactions.length;
      const matchedBybitTransactions = filteredBybitTransactions.filter(tx => 
        tx.BybitMatch && tx.BybitMatch.length > 0
      ).length;
      
      const unmatchedBybitTransactions = totalBybitTransactions - matchedBybitTransactions;
      
      // Calculate total statistics for all matches
      let stats = {
        grossExpense: 0,
        grossIncome: 0,
        grossProfit: 0,
        profitPercentage: 0,
        matchedCount: 0,
        profitPerOrder: 0,
        expensePerOrder: 0,
      };
      
      // Get all matches for statistics calculation
      const allMatches = await ctx.db.match.findMany({
        where
      });
      
      if (allMatches.length > 0) {
        stats = calculateTotalStats(allMatches);
      }
      
      // Calculate statistics for bybit matches
      let bybitStats = {
        grossExpense: 0,
        grossIncome: 0,
        grossProfit: 0,
        profitPercentage: 0,
        matchedCount: 0,
        profitPerOrder: 0,
        expensePerOrder: 0,
      };
      
      // We already have filtered Bybit matches
      if (searchFilteredBybitMatches.length > 0) {
        // We need to extract just the necessary fields for calculateTotalStats
        const simplifiedBybitMatches = searchFilteredBybitMatches.map(match => ({
          grossExpense: match.grossExpense,
          grossIncome: match.grossIncome,
          grossProfit: match.grossProfit,
          profitPercentage: match.profitPercentage
        }));
        
        bybitStats = calculateTotalStats(simplifiedBybitMatches);
      }
      
      // Calculate combined statistics
      const combinedStats = {
        grossExpense: stats.grossExpense + bybitStats.grossExpense,
        grossIncome: stats.grossIncome + bybitStats.grossIncome,
        grossProfit: stats.grossProfit + bybitStats.grossProfit,
        profitPercentage: ((stats.grossProfit + bybitStats.grossProfit) / 
                          (stats.grossExpense + bybitStats.grossExpense) * 100) || 0,
        matchedCount: stats.matchedCount + bybitStats.matchedCount,
        profitPerOrder: ((stats.grossProfit + bybitStats.grossProfit) / 
                         (stats.matchedCount + bybitStats.matchedCount)) || 0,
        expensePerOrder: ((stats.grossExpense + bybitStats.grossExpense) / 
                          (stats.matchedCount + bybitStats.matchedCount)) || 0
      };
      
      return {
        success: true,
        matches: matches.map(match => ({
          ...match,
          // Convert dates to Moscow format for display
          transaction: {
            ...match.transaction,
            dateTime: dayjs(match.transaction.dateTime).tz(MOSCOW_TIMEZONE).format()
          },
          idexTransaction: {
            ...match.idexTransaction,
            approvedAt: match.idexTransaction.approvedAt ? 
              dayjs(match.idexTransaction.approvedAt).tz(MOSCOW_TIMEZONE).format() : null
          }
        })),
        bybitMatches: bybitMatches.map(match => ({
          ...match,
          // Convert dates to Moscow format for display
          bybitTransaction: {
            ...match.bybitTransaction,
            dateTime: (() => {
              let transactionTime = match.bybitTransaction.dateTime;
              try {
                const originalData = typeof match.bybitTransaction.originalData === 'string'
                  ? JSON.parse(match.bybitTransaction.originalData)
                  : match.bybitTransaction.originalData;
                
                if (originalData && originalData.Time) {
                  transactionTime = dayjs(originalData.Time).add(3, 'hour').toDate();
                }
              } catch (error) {
                console.error("Error parsing originalData for bybitTransaction:", match.bybitTransaction.id, error);
              }
              return dayjs(transactionTime).tz(MOSCOW_TIMEZONE).format();
            })()
          },
          idexTransaction: {
            ...match.idexTransaction,
            approvedAt: match.idexTransaction.approvedAt ? 
              dayjs(match.idexTransaction.approvedAt).tz(MOSCOW_TIMEZONE).format() : null
          }
        })),
        stats: {
          ...combinedStats,
          totalTransactions,
          totalIdexTransactions,
          totalMatchedTransactions: totalMatches,
          totalUnmatchedTransactions,
          totalMatchedIdexTransactions: totalIdexTransactions - totalUnmatchedIdexTransactions,
          totalUnmatchedIdexTransactions,
          totalTelegramTransactions: totalTransactions,
          matchedTelegramTransactions: totalTransactions - totalUnmatchedTransactions,
          unmatchedTelegramTransactions: totalUnmatchedTransactions,
          matchedIdexTransactions: totalIdexTransactions - totalUnmatchedIdexTransactions,
          unmatchedIdexTransactions: totalUnmatchedIdexTransactions,
          totalBybitTransactions,
          matchedBybitTransactions,
          unmatchedBybitTransactions,
          // Add detailed stats for each type
          regularStats: stats,
          bybitStats
        },
        pagination: {
          totalMatches: totalMatches + totalBybitMatches,
          totalPages: Math.ceil((totalMatches + totalBybitMatches) / pageSize) || 1,
          currentPage: page,
          pageSize
        }
      };
    } catch (error) {
      console.error("Ошибка при получении всех сопоставлений:", error);
      return { 
        success: false, 
        message: "Произошла ошибка при получении всех сопоставлений",
        matches: [],
        bybitMatches: [],
        stats: {
          grossExpense: 0,
          grossIncome: 0,
          grossProfit: 0,
          profitPercentage: 0,
          matchedCount: 0,
          profitPerOrder: 0,
          expensePerOrder: 0,
          totalTransactions: 0,
          totalIdexTransactions: 0,
          totalMatchedTransactions: 0,
          totalUnmatchedTransactions: 0,
          totalMatchedIdexTransactions: 0,
          totalUnmatchedIdexTransactions: 0,
          totalTelegramTransactions: 0,
          matchedTelegramTransactions: 0,
          unmatchedTelegramTransactions: 0,
          matchedIdexTransactions: 0,
          unmatchedIdexTransactions: 0,
          totalBybitTransactions: 0,
          matchedBybitTransactions: 0,
          unmatchedBybitTransactions: 0,
          regularStats: {
            grossExpense: 0,
            grossIncome: 0,
            grossProfit: 0,
            profitPercentage: 0,
            matchedCount: 0,
            profitPerOrder: 0,
            expensePerOrder: 0
          },
          bybitStats: {
            grossExpense: 0,
            grossIncome: 0,
            grossProfit: 0,
            profitPercentage: 0,
            matchedCount: 0,
            profitPerOrder: 0,
            expensePerOrder: 0
          }
        },
        pagination: {
          totalMatches: 0,
          totalPages: 0,
          currentPage: input.page,
          pageSize: input.pageSize
        }
      };
    }
  }),

  // Получение пользователей со статистикой сопоставлений
  getUsersWithMatchStats: publicProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().default(10),
      sortColumn: z.string().optional(),
      sortDirection: z.enum(["asc", "desc", "null"]).optional()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const { startDate, endDate, page, pageSize, sortColumn, sortDirection } = input;
        
        // Преобразуем даты с учетом таймзоны
        const startDateTime = dayjs(startDate).utc().toDate();
        const endDateTime = dayjs(endDate).utc().toDate();
        
        // Получаем всех пользователей с транзакциями в указанном диапазоне дат
        const users = await ctx.db.user.findMany({
          where: {
            transactions: {
              some: {
                dateTime: {
                  gte: startDateTime,
                  lte: endDateTime
                }
              }
            }
          },
          include: {
            transactions: {
              where: {
                dateTime: {
                  gte: startDateTime,
                  lte: endDateTime
                }
              }
            },
            telegramAccounts: true
          }
        });
        
        // Получаем общую статистику
        const allIdexTransactions = await ctx.db.idexTransaction.count({
          where: {
            approvedAt: {
              gte: startDateTime.toISOString(),
              lte: endDateTime.toISOString()
            }
          }
        });
        
        const allMatchedIdexTransactions = await ctx.db.match.count({
          where: {
            idexTransaction: {
              approvedAt: {
                gte: startDateTime.toISOString(),
                lte: endDateTime.toISOString()
              }
            }
          }
        });
        
        const unmatchedIdexTransactions = allIdexTransactions - allMatchedIdexTransactions;
        
        // Рассчитываем статистику пользователей
        const usersWithStats = await Promise.all(users.map(async (user) => {
          // Получаем сопоставления пользователя
          const userMatches = await ctx.db.match.findMany({
            where: {
              transaction: {
                userId: user.id,
                dateTime: {
                  gte: startDateTime,
                  lte: endDateTime
                }
              }
            }
          });
          
          // Рассчитываем статистику сопоставлений
          const stats = calculateTotalStats(userMatches);
          
          // Получаем количество телеграм-транзакций и сопоставленных транзакций
          const totalTelegramTransactions = user.transactions.length;
          
          const matchedTelegramTransactions = await ctx.db.transaction.count({
            where: {
              userId: user.id,
              dateTime: {
                gte: startDateTime,
                lte: endDateTime
              },
              matches: {
                some: {}
              }
            }
          });
          
          return {
            ...user,
            stats: {
              ...stats,
              totalTelegramTransactions,
              matchedTelegramTransactions,
              unmatchedTelegramTransactions: totalTelegramTransactions - matchedTelegramTransactions,
              matchedIdexTransactions: userMatches.length
            },
            matchCount: userMatches.length
          };
        }));
        
        // Применяем сортировку
        let sortedUsers = [...usersWithStats];
        
        if (sortColumn && sortDirection && sortDirection !== "null") {
          sortedUsers.sort((a, b) => {
            let valueA, valueB;
            
            // Обрабатываем вложенные поля
            if (sortColumn.includes('.')) {
              const props = sortColumn.split('.');
              valueA = props.reduce((obj, prop) => obj?.[prop], a);
              valueB = props.reduce((obj, prop) => obj?.[prop], b);
            } else if (sortColumn === "name") {
              valueA = a.name;
              valueB = b.name;
            } else if (sortColumn === "matchCount") {
              valueA = a.matchCount;
              valueB = b.matchCount;
            } else if (sortColumn.startsWith("stats.")) {
              const statsProp = sortColumn.replace("stats.", "");
              valueA = a.stats?.[statsProp];
              valueB = b.stats?.[statsProp];
            } else {
              valueA = a[sortColumn];
              valueB = b[sortColumn];
            }
            
            // Сортировка для чисел
            if (typeof valueA === 'number' && typeof valueB === 'number') {
              return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
            }
            
            // Сортировка для строк
            if (typeof valueA === 'string' && typeof valueB === 'string') {
              return sortDirection === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
            }
            
            return 0;
          });
        }
        
        // Применяем пагинацию
        const paginatedUsers = sortedUsers.slice((page - 1) * pageSize, page * pageSize);
        
        // Рассчитываем общую статистику
        const allMatches = await ctx.db.match.findMany({
          where: {
            transaction: {
              dateTime: {
                gte: startDateTime,
                lte: endDateTime
              }
            }
          }
        });
        
        const totalStats = calculateTotalStats(allMatches);
        
        // Получаем общее количество телеграм-транзакций
        const totalTelegramTransactions = await ctx.db.transaction.count({
          where: {
            dateTime: {
              gte: startDateTime,
              lte: endDateTime
            }
          }
        });
        
        const matchedTelegramTransactions = await ctx.db.transaction.count({
          where: {
            dateTime: {
              gte: startDateTime,
              lte: endDateTime
            },
            matches: {
              some: {}
            }
          }
        });
        
        return {
          success: true,
          users: paginatedUsers,
          totalStats: {
            ...totalStats,
            totalTelegramTransactions,
            matchedTelegramTransactions,
            unmatchedTelegramTransactions: totalTelegramTransactions - matchedTelegramTransactions,
            totalIdexTransactions: allIdexTransactions,
            matchedIdexTransactions: allMatchedIdexTransactions,
            unmatchedIdexTransactions
          },
          pagination: {
            totalUsers: users.length,
            totalPages: Math.ceil(users.length / pageSize) || 1,
            currentPage: page,
            pageSize
          }
        };
      } catch (error) {
        console.error("Ошибка при получении пользователей со статистикой:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при получении пользователей со статистикой",
          users: [],
          totalStats: null,
          pagination: {
            totalUsers: 0,
            totalPages: 0,
            currentPage: input.page,
            pageSize: input.pageSize
          }
        };
      }
    }),
    
  // Получение несопоставленных IDEX транзакций
  getUnmatchedIdexTransactions: publicProcedure
  .input(z.object({
    startDate: z.string(),
    endDate: z.string(),
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().default(10),
    searchQuery: z.string().optional(),
    sortColumn: z.string().optional(),
    sortDirection: z.enum(["asc", "desc", "null"]).optional(),
    cabinetIds: z.array(z.number().int().positive()).optional(),
    matchType: z.enum(["telegram", "bybit"]).default("telegram") // Добавляем новый параметр для типа сопоставления
  }))
  .query(async ({ ctx, input }) => {
    try {
      const { 
        startDate, 
        endDate, 
        page, 
        pageSize, 
        searchQuery, 
        sortColumn, 
        sortDirection,
        cabinetIds,
        matchType // Получаем тип сопоставления
      } = input;
      
      // Преобразуем даты с учетом таймзоны
      const startDateTime = dayjs(startDate).utc().toDate();
      const endDateTime = dayjs(endDate).utc().toDate();
      
      // Базовый фильтр для IDEX транзакций с approvedAt в заданном диапазоне
      let where: any = {
        approvedAt: {
          gte: startDateTime.toISOString(),
          lte: endDateTime.toISOString()
        }
      };
      
      // Добавляем условие в зависимости от выбранного типа сопоставления
      if (matchType === "telegram") {
        where.matches = {
          none: {}
        };
      } else if (matchType === "bybit") {
        where.BybitMatch = {
          none: {}
        };
      }
      
      // Добавляем фильтр по кабинетам, если указан
      if (cabinetIds && cabinetIds.length > 0) {
        where.cabinetId = {
          in: cabinetIds
        };
      }
      
      // Добавляем поиск, если указан
      if (searchQuery) {
        const numericQuery = parseFloat(searchQuery);
        const isNumeric = !isNaN(numericQuery);
  
        // Initialize OR condition array
        const orConditions: Prisma.IdexTransactionWhereInput[] = [];
  
        // Для числовых полей используем числовое сравнение
        if (isNumeric) {
          // Поиск по числовому externalId (BigInt)
          orConditions.push({ 
            externalId: { equals: BigInt(numericQuery) } 
          });
          
          // Поиск в JSON полях
          orConditions.push({
            amount: {
              path: ['trader', '643'],
              equals: numericQuery
            }
          });
          
          orConditions.push({
            amount: {
              path: ['trader', '000001'],
              equals: numericQuery
            }
          });
          
          orConditions.push({
            total: {
              path: ['trader', '643'],
              equals: numericQuery
            }
          });
          
          orConditions.push({
            total: {
              path: ['trader', '000001'],
              equals: numericQuery
            }
          });
          
          orConditions.push({
            extraData: {
              path: ['trader', '643'],
              equals: numericQuery
            }
          });
          
          orConditions.push({
            extraData: {
              path: ['trader', '000001'],
              equals: numericQuery
            }
          });
        }
        
        // Строковые поиски
        orConditions.push({ wallet: { contains: searchQuery, mode: 'insensitive' } });
        
        if (orConditions.length > 0) {
          where.OR = orConditions;
        }
      }
      
      // Формируем объект сортировки
      let orderBy: any = { approvedAt: 'desc' };
      
      if (sortColumn && sortDirection && sortDirection !== "null") {
        orderBy = {
          [sortColumn]: sortDirection
        };
      }
      
      // Получаем несопоставленные IDEX транзакции
      const transactions = await ctx.db.idexTransaction.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          cabinet: true
        }
      });
      
      // Считаем общее количество для пагинации
      const totalTransactions = await ctx.db.idexTransaction.count({
        where
      });
      
      return {
        success: true,
        transactions: transactions.map(tx => ({
          ...tx,
          approvedAt: tx.approvedAt ?
            dayjs(tx.approvedAt).tz(MOSCOW_TIMEZONE).format() : null
        })),
        pagination: {
          totalTransactions,
          totalPages: Math.ceil(totalTransactions / pageSize) || 1,
          currentPage: page,
          pageSize
        }
      };
    } catch (error) {
      console.error("Ошибка при получении несопоставленных IDEX транзакций:", error);
      return {
        success: false,
        message: "Ошибка при получении несопоставленных IDEX транзакций",
        transactions: [],
        pagination: {
          totalTransactions: 0,
          totalPages: 0,
          currentPage: input.page,
          pageSize: input.pageSize
        }
      };
    }
  }),

  // Эндпоинт для получения всех сопоставленных транзакций определенного типа
getMatchedTransactions: publicProcedure
.input(z.object({
  startDate: z.string(),
  endDate: z.string(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().default(10),
  searchQuery: z.string().optional(),
  sortColumn: z.string().optional(),
  sortDirection: z.enum(["asc", "desc", "null"]).optional(),
  cabinetIds: z.array(z.number().int().positive()).optional(),
  transactionType: z.enum(["idex", "bybit"]).default("idex") // Тип транзакций (IDEX или Bybit)
}))
.query(async ({ ctx, input }) => {
  try {
    const { 
      startDate, 
      endDate, 
      page, 
      pageSize, 
      searchQuery, 
      sortColumn, 
      sortDirection,
      cabinetIds,
      transactionType
    } = input;
    
    // Преобразуем даты с учетом таймзоны
    const startDateTime = dayjs(startDate).utc().toDate();
    const endDateTime = dayjs(endDate).utc().toDate();
    
    // В зависимости от типа транзакций выбираем соответствующую логику
    if (transactionType === "idex") {
      // Получаем сопоставленные IDEX транзакции
      let where: any = {
        approvedAt: {
          gte: startDateTime.toISOString(),
          lte: endDateTime.toISOString()
        },
        OR: [
          { matches: { some: {} } }, // Сопоставленные с Telegram
          { BybitMatch: { some: {} } } // Сопоставленные с Bybit
        ]
      };
      
      // Добавляем фильтр по кабинетам, если указан
      if (cabinetIds && cabinetIds.length > 0) {
        where.cabinetId = { in: cabinetIds };
      }
      
      // Добавляем поиск, если указан
      if (searchQuery) {
        const numericQuery = parseFloat(searchQuery);
        const isNumeric = !isNaN(numericQuery);
        const orConditions: any[] = [];
        
        if (isNumeric) {
          orConditions.push({ externalId: { equals: BigInt(numericQuery) } });
          // Добавляем поиск в JSON полях...
        }
        
        orConditions.push({ wallet: { contains: searchQuery, mode: 'insensitive' } });
        
        if (orConditions.length > 0) {
          where.OR = [...(where.OR || []), ...orConditions];
        }
      }
      
      // Получаем транзакции
      const transactions = await ctx.db.idexTransaction.findMany({
        where,
        orderBy: sortColumn && sortDirection !== "null" ? { [sortColumn]: sortDirection } : { approvedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          cabinet: true,
          matches: { select: { id: true, transactionId: true } },
          BybitMatch: { select: { id: true, bybitTransactionId: true } }
        }
      });
      
      // Считаем общее количество
      const totalTransactions = await ctx.db.idexTransaction.count({ where });
      
      return {
        success: true,
        transactions: transactions.map(tx => ({
          ...tx,
          approvedAt: tx.approvedAt ? dayjs(tx.approvedAt).tz(MOSCOW_TIMEZONE).format() : null
        })),
        pagination: {
          totalTransactions,
          totalPages: Math.ceil(totalTransactions / pageSize) || 1,
          currentPage: page,
          pageSize
        }
      };
    } else {
      // Получаем сопоставленные Bybit транзакции
      let where: any = {
        dateTime: {
          gte: startDateTime,
          lte: endDateTime
        },
        BybitMatch: { some: {} }
      };
      
      // Добавляем поиск, если указан
      if (searchQuery) {
        const numericQuery = parseFloat(searchQuery);
        const isNumeric = !isNaN(numericQuery);
        const orConditions: any[] = [];
        
        orConditions.push(
          { orderNo: { contains: searchQuery, mode: 'insensitive' } },
          { counterparty: { contains: searchQuery, mode: 'insensitive' } }
        );
        
        if (isNumeric) {
          orConditions.push({ totalPrice: { equals: numericQuery } });
        }
        
        if (orConditions.length > 0) {
          where.OR = orConditions;
        }
      }
      
      // Получаем транзакции
      const transactions = await ctx.db.bybitTransaction.findMany({
        where,
        orderBy: sortColumn && sortDirection !== "null" ? { [sortColumn]: sortDirection } : { dateTime: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: true,
          BybitMatch: {
            select: {
              id: true,
              idexTransactionId: true
            }
          }
        }
      });
      
      // Считаем общее количество
      const totalTransactions = await ctx.db.bybitTransaction.count({ where });
      
      return {
        success: true,
        transactions: transactions.map(tx => {
          // Извлекаем поле Time из originalData для корректного отображения даты
          let transactionTime = tx.dateTime;
          
          try {
            const originalData = typeof tx.originalData === 'string'
              ? JSON.parse(tx.originalData)
              : tx.originalData;
            
            if (originalData && originalData.Time) {
              transactionTime = dayjs(originalData.Time).add(3, 'hour').toDate();
            }
          } catch (error) {
            console.error("Error parsing originalData for transaction:", tx.id, error);
          }
          
          return {
            ...tx,
            dateTime: dayjs(transactionTime).tz(MOSCOW_TIMEZONE).format()
          };
        }),
        pagination: {
          totalTransactions,
          totalPages: Math.ceil(totalTransactions / pageSize) || 1,
          currentPage: page,
          pageSize
        }
      };
    }
  } catch (error) {
    console.error("Ошибка при получении сопоставленных транзакций:", error);
    return {
      success: false,
      message: "Ошибка при получении сопоставленных транзакций",
      transactions: [],
      pagination: {
        totalTransactions: 0,
        totalPages: 0,
        currentPage: input.page,
        pageSize: input.pageSize
      }
    };
  }
}),

// Получение IDEX транзакций, сопоставленных с Bybit
getIdexTransactionsMatchedWithBybit: publicProcedure
.input(z.object({
  startDate: z.string(),
  endDate: z.string(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().default(10),
  searchQuery: z.string().optional(),
  sortColumn: z.string().optional(),
  sortDirection: z.enum(["asc", "desc", "null"]).optional(),
  cabinetIds: z.array(z.number().int().positive()).optional()
}))
.query(async ({ ctx, input }) => {
  try {
    const { startDate, endDate, page, pageSize, searchQuery, sortColumn, sortDirection, cabinetIds } = input;
    
    // Преобразуем даты с учетом таймзоны
    const startDateTime = dayjs(startDate).utc().toDate();
    const endDateTime = dayjs(endDate).utc().toDate();
    
    // Базовый фильтр: IDEX транзакции, которые сопоставлены с Bybit
    let where: any = {
      approvedAt: {
        gte: startDateTime.toISOString(),
        lte: endDateTime.toISOString()
      },
      BybitMatch: {
        some: {} // Только сопоставленные с Bybit
      }
    };
    
    // Добавляем фильтр по кабинетам, если указан
    if (cabinetIds && cabinetIds.length > 0) {
      where.cabinetId = { in: cabinetIds };
    }
    
    // Добавляем поиск, если указан
    if (searchQuery) {
      const numericQuery = parseFloat(searchQuery);
      const isNumeric = !isNaN(numericQuery);
      const orConditions: any[] = [];
      
      if (isNumeric) {
        orConditions.push({ externalId: { equals: BigInt(numericQuery) } });
        
        // Поиск в JSON полях
        orConditions.push({
          amount: {
            path: ['trader', '643'],
            equals: numericQuery
          }
        });
        
        orConditions.push({
          total: {
            path: ['trader', '000001'],
            equals: numericQuery
          }
        });
      }
      
      // Строковые поиски
      orConditions.push({ wallet: { contains: searchQuery, mode: 'insensitive' } });
      
      if (orConditions.length > 0) {
        where.OR = orConditions;
      }
    }
    
    // Формируем объект сортировки
    let orderBy: any = { approvedAt: 'desc' };
    
    if (sortColumn && sortDirection && sortDirection !== "null") {
      orderBy = {
        [sortColumn]: sortDirection
      };
    }
    
    // Получаем транзакции
    const transactions = await ctx.db.idexTransaction.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        cabinet: true,
        BybitMatch: {
          include: {
            bybitTransaction: {
              select: {
                id: true,
                orderNo: true,
                totalPrice: true,
                dateTime: true,
                user: {
                  select: {
                    id: true,
                    name: true
                  }
                },
                originalData: true
              }
            }
          }
        }
      }
    });
    
    // Считаем общее количество
    const totalTransactions = await ctx.db.idexTransaction.count({ where });
    
    return {
      success: true,
      transactions: transactions.map(tx => ({
        ...tx,
        approvedAt: tx.approvedAt ? dayjs(tx.approvedAt).tz(MOSCOW_TIMEZONE).format() : null,
        // Добавляем информацию о связанных Bybit транзакциях
        bybitMatches: tx.BybitMatch.map(match => ({
          id: match.id,
          bybitTransaction: {
            ...match.bybitTransaction,
            dateTime: (() => {
              // Извлекаем время из originalData, если оно есть
              try {
                const originalData = typeof match.bybitTransaction.originalData === 'string'
                  ? JSON.parse(match.bybitTransaction.originalData)
                  : match.bybitTransaction.originalData;
                
                if (originalData && originalData.Time) {
                  return dayjs(originalData.Time).add(3, 'hour').tz(MOSCOW_TIMEZONE).format();
                }
                return dayjs(match.bybitTransaction.dateTime).tz(MOSCOW_TIMEZONE).format();
              } catch (error) {
                return dayjs(match.bybitTransaction.dateTime).tz(MOSCOW_TIMEZONE).format();
              }
            })()
          }
        }))
      })),
      pagination: {
        totalTransactions,
        totalPages: Math.ceil(totalTransactions / pageSize) || 1,
        currentPage: page,
        pageSize
      }
    };
  } catch (error) {
    console.error("Ошибка при получении IDEX транзакций, сопоставленных с Bybit:", error);
    return {
      success: false,
      message: "Ошибка при получении IDEX транзакций, сопоставленных с Bybit",
      transactions: [],
      pagination: {
        totalTransactions: 0,
        totalPages: 0,
        currentPage: input.page,
        pageSize: input.pageSize
      }
    };
  }
}),

  // Получение несопоставленных транзакций пользователя
  getUnmatchedUserTransactions: publicProcedure
    .input(z.object({
      userId: z.number().int().positive().nullable(),
      startDate: z.string(),
      endDate: z.string(),
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().default(10),
      searchQuery: z.string().optional(),
      sortColumn: z.string().optional(),
      sortDirection: z.enum(["asc", "desc", "null"]).optional()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const { userId, startDate, endDate, page, pageSize, searchQuery, sortColumn, sortDirection } = input;
        
        // Преобразуем даты с учетом таймзоны
        const startDateTime = dayjs(startDate).utc().toDate();
        const endDateTime = dayjs(endDate).utc().toDate();
        
        // Базовый фильтр по диапазону дат и отсутствию сопоставлений
        let where: any = {
          dateTime: {
            gte: startDateTime,
            lte: endDateTime
          },
          matches: {
            none: {}
          }
        };
        
        // Добавляем фильтр по пользователю, если указан
        if (userId) {
          where.userId = userId;
        }
        
        // Добавляем поиск, если указан
        if (searchQuery) {
          where.OR = [
            { externalId: { contains: searchQuery } },
            { orderNo: { contains: searchQuery } },
            { counterparty: { contains: searchQuery } },
            { totalPrice: { equals: parseFloat(searchQuery) || undefined } }
          ];
        }
        
        // Формируем объект сортировки
        let orderBy: any = { dateTime: 'desc' };
        
        if (sortColumn && sortDirection && sortDirection !== "null") {
          // Обрабатываем специальные случаи для вложенных полей
          if (sortColumn === "user.name") {
            orderBy = {
              user: {
                name: sortDirection
              }
            };
          } else {
            orderBy = {
              [sortColumn]: sortDirection
            };
          }
        }
        
        // Получаем несопоставленные транзакции пользователя
        const transactions = await ctx.db.transaction.findMany({
          where,
          include: {
            user: true
          },
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize
        });
        
        // Считаем общее количество для пагинации
        const totalTransactions = await ctx.db.transaction.count({
          where
        });
        
        return {
          success: true,
          transactions: transactions.map(tx => ({
            ...tx,
            // Преобразуем дату в московский формат для вывода
            dateTime: dayjs(tx.dateTime).tz(MOSCOW_TIMEZONE).format()
          })),
          pagination: {
            totalTransactions,
            totalPages: Math.ceil(totalTransactions / pageSize) || 1,
            currentPage: page,
            pageSize
          }
        };
      } catch (error) {
        console.error("Ошибка при получении несопоставленных транзакций пользователя:", error);
        return {
          success: false,
          message: "Ошибка при получении несопоставленных транзакций пользователя",
          transactions: [],
          pagination: {
            totalTransactions: 0,
            totalPages: 0,
            currentPage: input.page,
            pageSize: input.pageSize
          }
        };
      }
    }),

  // Создание ручного сопоставления
  createManualMatch: publicProcedure
    .input(z.object({
      idexTransactionId: z.number().int().positive(),
      userTransactionId: z.number().int().positive()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { idexTransactionId, userTransactionId } = input;
        
        // Проверяем, сопоставлена ли уже IDEX транзакция
        const existingIdexMatch = await ctx.db.match.findFirst({
          where: { idexTransactionId }
        });
        
        if (existingIdexMatch) {
          return {
            success: false,
            message: "IDEX транзакция уже сопоставлена с другой транзакцией"
          };
        }
        
        // Проверяем, сопоставлена ли уже пользовательская транзакция
        const existingTransactionMatch = await ctx.db.match.findFirst({
          where: { transactionId: userTransactionId }
        });
        
        if (existingTransactionMatch) {
          return {
            success: false,
            message: "Транзакция кошелька уже сопоставлена с другой IDEX транзакцией"
          };
        }
        
        // Получаем обе транзакции для расчета метрик сопоставления
        const idexTransaction = await ctx.db.idexTransaction.findUnique({
          where: { id: idexTransactionId }
        });
        
        const userTransaction = await ctx.db.transaction.findUnique({
          where: { id: userTransactionId }
        });
        
        if (!idexTransaction || !userTransaction) {
          return {
            success: false,
            message: "Одна или обе транзакции не найдены"
          };
        }
        
        // Рассчитываем разницу во времени
        let timeDifference = 0;
        if (idexTransaction.approvedAt && userTransaction.dateTime) {
          const timeDiffMinutes = getTimeDifferenceInMinutes(
            idexTransaction.approvedAt,
            userTransaction.dateTime.toISOString()
          );
          timeDifference = Math.round(timeDiffMinutes * 60); // Конвертируем в секунды
        }
        
        // Рассчитываем метрики сопоставления
        const metrics = calculateMatchMetrics(userTransaction, idexTransaction);
        
        // Создаем сопоставление
        const match = await ctx.db.match.create({
          data: {
            idexTransactionId,
            transactionId: userTransactionId,
            timeDifference,
            grossExpense: metrics.grossExpense,
            grossIncome: metrics.grossIncome,
            grossProfit: metrics.grossProfit,
            profitPercentage: metrics.profitPercentage
          }
        });
        
        return {
          success: true,
          message: "Транзакции успешно сопоставлены",
          match
        };
      } catch (error) {
        console.error("Ошибка при создании ручного сопоставления:", error);
        return {
          success: false,
          message: "Произошла ошибка при создании ручного сопоставления"
        };
      }
    }),

  // Удаление сопоставления
  deleteMatch: publicProcedure
    .input(z.object({
      matchId: z.number().int().positive()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { matchId } = input;
        
        // Проверяем, существует ли сопоставление
        const match = await ctx.db.match.findUnique({
          where: { id: matchId }
        });
        
        if (!match) {
          return {
            success: false,
            message: "Сопоставление не найдено"
          };
        }
        
        // Удаляем сопоставление
        await ctx.db.match.delete({
          where: { id: matchId }
        });
        
        return {
          success: true,
          message: "Сопоставление успешно удалено"
        };
      } catch (error) {
        console.error("Ошибка при удалении сопоставления:", error);
        return {
          success: false,
          message: "Произошла ошибка при удалении сопоставления"
        };
      }
    }),

  // Получение статистики несопоставленных транзакций
  getUnmatchedTransactionsStats: publicProcedure
  .input(z.object({
    startDate: z.string(),
    endDate: z.string(),
    userId: z.number().int().positive().nullable().optional(),
    cabinetIds: z.array(z.number().int().positive()).optional(), // Array of cabinet IDs
    searchQuery: z.string().optional() // Search query for IDEX transactions
  }))
  .query(async ({ ctx, input }) => {
    try {
      const { startDate, endDate, userId, cabinetIds, searchQuery } = input;
      
      // Convert dates with timezone handling
      const startDateTime = dayjs(startDate).utc().toDate();
      const endDateTime = dayjs(endDate).utc().toDate();
      
      // Base filter for user transactions
      let userTransactionsWhere: any = {
        dateTime: {
          gte: startDateTime,
          lte: endDateTime
        },
        matches: {
          none: {}
        }
      };
      
      // Add user filter if specified
      if (userId) {
        userTransactionsWhere.userId = userId;
      }
      
      // Base filter for IDEX transactions
      let idexTransactionsWhere: any = {
        approvedAt: {
          gte: startDateTime.toISOString(),
          lte: endDateTime.toISOString()
        },
        matches: {
          none: {}
        }
      };
      
      // Add cabinet filter if specified
      if (cabinetIds && cabinetIds.length > 0) {
        idexTransactionsWhere.cabinetId = {
          in: cabinetIds
        };
      }
      
      // Add search if specified
      if (searchQuery && searchQuery.trim() !== '') {
        // Search by externalId as string or number
        const numericSearch = !isNaN(Number(searchQuery)) ? Number(searchQuery) : undefined;
        
        idexTransactionsWhere.OR = [
          numericSearch ? { externalId: { equals: BigInt(numericSearch) } } : {},
          { wallet: { contains: searchQuery, mode: 'insensitive' } },
        ].filter(condition => Object.keys(condition).length > 0);
      }
      
      // Get transaction statistics
      const totalTransactions = await ctx.db.transaction.count({
        where: {
          dateTime: {
            gte: startDateTime,
            lte: endDateTime
          }
        }
      });
      
      const matchedTransactions = await ctx.db.transaction.count({
        where: {
          dateTime: {
            gte: startDateTime,
            lte: endDateTime
          },
          matches: {
            some: {}
          }
        }
      });
      
      // Get unmatched user transactions count
      const unmatchedUserTransactions = await ctx.db.transaction.count({
        where: userTransactionsWhere
      });
      
      // Get unmatched IDEX transactions count
      const unmatchedIdexTransactions = await ctx.db.idexTransaction.count({
        where: idexTransactionsWhere
      });
      
      // Get total IDEX transactions
      const totalIdexTransactions = await ctx.db.idexTransaction.count({
        where: {
          approvedAt: {
            gte: startDateTime.toISOString(),
            lte: endDateTime.toISOString()
          },
          ...(cabinetIds && cabinetIds.length > 0 ? { cabinetId: { in: cabinetIds } } : {})
        }
      });
      
      // Get all IDEX cabinets with transaction counts
      const cabinets = await ctx.db.idexCabinet.findMany({
        select: {
          id: true,
          idexId: true,
          login: true,
          _count: {
            select: {
              transactions: {
                where: {
                  approvedAt: {
                    gte: startDateTime.toISOString(),
                    lte: endDateTime.toISOString()
                  }
                }
              }
            }
          }
        }
      });
      
      // Transform cabinet data for frontend use
      const cabinetsData = cabinets.map(cabinet => ({
        id: cabinet.id,
        idexId: cabinet.idexId,
        login: cabinet.login,
        transactionCount: cabinet._count.transactions
      }));
      
      return {
        success: true,
        totalTransactions,
        totalIdexTransactions,
        totalMatchedTransactions: matchedTransactions,
        totalUnmatchedTransactions: totalTransactions - matchedTransactions,
        totalUnmatchedIdexTransactions: unmatchedIdexTransactions,
        unmatchedUserTransactions,
        cabinets: cabinetsData,
        stats: {
          unmatchedUserTransactions,
          unmatchedIdexTransactions,
          totalTransactions,
          totalIdexTransactions,
          matchedTransactions,
          matchedIdexTransactions: totalIdexTransactions - unmatchedIdexTransactions
        }
      };
    } catch (error) {
      console.error("Ошибка при получении статистики несопоставленных транзакций:", error);
      return {
        success: false,
        message: "Произошла ошибка при получении статистики несопоставленных транзакций",
        stats: null,
        cabinets: []
      };
    }
  })
});

// Вспомогательные функции

/**
 * Функция для расчета разницы во времени в минутах
 */
function getTimeDifferenceInMinutes(dateStr1: string, dateStr2: string): number {
  const date1 = dayjs(dateStr1).utc();
  const date2 = dayjs(dateStr2).utc();
  return Math.abs(date1.diff(date2, 'minute'));
}

/**
 * Функция для расчета метрик для сопоставления
 */
function calculateMatchMetrics(transaction: any, idexTransaction: any): {
  grossExpense: number;
  grossIncome: number;
  grossProfit: number;
  profitPercentage: number;
} {
  const amount = transaction.amount || 0;
  const grossExpense = amount * COMMISSION;
  
  // Парсим поле total для получения суммы
  let totalUsdt = 0;
  try {
    // Проверяем, является ли total строкой JSON
    if (typeof idexTransaction.total === 'string') {
      const totalJson = JSON.parse(idexTransaction.total);
      totalUsdt = parseFloat(totalJson.trader?.["000001"] || 0);
    } else {
      // Если total уже является объектом
      const totalObj = idexTransaction.total as any;
      totalUsdt = parseFloat(totalObj.trader?.["000001"] || 0);
    }
  } catch (error) {
    console.error('Ошибка при парсинге JSON поля total:', error);
  }
  
  const grossIncome = totalUsdt;
  const grossProfit = grossIncome - grossExpense;
  const profitPercentage = grossExpense ? (grossProfit / grossExpense) * 100 : 0;
  
  return {
    grossExpense,
    grossIncome,
    grossProfit,
    profitPercentage
  };
}

/**
 * Вспомогательная функция для расчета общей статистики из списка сопоставлений
 */
function calculateTotalStats(matches: any[]): {
  grossExpense: number;
  grossIncome: number;
  grossProfit: number;
  profitPercentage: number;
  matchedCount: number;
  profitPerOrder: number;
  expensePerOrder: number;
} {
  const matchCount = matches.length;
  const totalGrossExpense = matches.reduce((sum, match) => sum + (match.grossExpense || 0), 0);
  const totalGrossIncome = matches.reduce((sum, match) => sum + (match.grossIncome || 0), 0);
  const totalGrossProfit = matches.reduce((sum, match) => sum + (match.grossProfit || 0), 0);
  const totalProfitPercentage = totalGrossExpense ? (totalGrossProfit / totalGrossExpense) * 100 : 0;
  const profitPerOrder = matchCount ? totalGrossProfit / matchCount : 0;
  const expensePerOrder = matchCount ? totalGrossExpense / matchCount : 0;
  
  return {
    grossExpense: totalGrossExpense,
    grossIncome: totalGrossIncome,
    grossProfit: totalGrossProfit,
    profitPercentage: totalProfitPercentage,
    matchedCount: matchCount,
    profitPerOrder,
    expensePerOrder
  };
}

// Вспомогательная функция для расчета метрик сопоставления Bybit и IDEX
function calculateBybitMatchMetrics(bybitTransaction: any, idexTransaction: any) {
  const amount = bybitTransaction.amount || 0;
  const grossExpense = amount;
  
  // Парсим поле total для получения суммы
  let totalUsdt = 0;
  try {
    // Проверяем, является ли total строкой JSON
    if (typeof idexTransaction.total === 'string') {
      const totalJson = JSON.parse(idexTransaction.total);
      totalUsdt = parseFloat(totalJson.trader?.["000001"] || 0);
    } else {
      // Если total уже является объектом
      const totalObj = idexTransaction.total as any;
      totalUsdt = parseFloat(totalObj.trader?.["000001"] || 0);
    }
  } catch (error) {
    console.error('Ошибка при парсинге JSON поля total:', error);
  }
  
  const grossIncome = totalUsdt;
  const grossProfit = grossIncome - grossExpense;
  const profitPercentage = grossExpense ? (grossProfit / grossExpense) * 100 : 0;
  
  return {
    grossExpense,
    grossIncome,
    grossProfit,
    profitPercentage
  };
}