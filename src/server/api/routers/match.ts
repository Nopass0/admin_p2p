import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

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
      cabinetIds: z.array(z.number().int().positive()).optional(),
      userIds: z.array(z.number().int().positive()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { startDate, endDate, approvedOnly, userId, cabinetIds, userIds } = input;
        
        console.log(`Начинаем сопоставление транзакций с ${startDate} по ${endDate}`);
        
        // Преобразуем даты с учетом таймзоны
        const startDateTime = dayjs(startDate).utc().toDate();
        const endDateTime = dayjs(endDate).utc().toDate();
        
        console.log(`UTC даты: с ${startDateTime.toISOString()} по ${endDateTime.toISOString()}`);
        
        // Получаем IdexTransactions в указанном диапазоне дат
        let idexTransactionsWhere: any = {
          approvedAt: {
            gte: startDateTime.toISOString(),
            lte: endDateTime.toISOString()
          }
        };
   
        // Добавляем фильтр по кабинетам, если указаны
        if (cabinetIds && cabinetIds.length > 0) {
          idexTransactionsWhere.cabinetId = {
            in: cabinetIds
          };
        }
        
        const idexTransactions = await ctx.db.idexTransaction.findMany({
          where: idexTransactionsWhere,
        });
        
        // Фильтруем IdexTransactions по диапазону дат
        const filteredIdexTransactions = idexTransactions.filter(tx => {
          if (!tx.approvedAt) return false;
          
          const approvedDate = dayjs(tx.approvedAt).utc();
          return approvedDate.isAfter(startDateTime) && approvedDate.isBefore(endDateTime);
        });
        
        console.log(`Найдено ${filteredIdexTransactions.length} IdexTransactions в указанном диапазоне`);
        
        // Получаем Transactions в указанном диапазоне дат
        let transactionsWhere: any = {
          dateTime: {
            gte: startDateTime.toISOString(),
            lte: endDateTime.toISOString()
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
        
        // Отслеживаем сопоставленные ID для обеспечения соответствия один к одному
        const matchedIdexTransactions = new Set<number>();
        const matchedTransactions = new Set<number>();
        
        // Сохраняем все найденные совпадения
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
        
        // Получаем общую статистику для всех транзакций
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
        
        console.log(`Удалено ${deleteResult.count} сопоставлений`);
        
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
            unmatchedIdexTransactions: totalIdexTransactions - matchedIdexTransactions
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
        
        // Преобразуем даты с учетом таймзоны
        const startDateTime = dayjs(startDate).utc().toDate();
        const endDateTime = dayjs(endDate).utc().toDate();
        
        // Строим базовый фильтр по диапазону дат
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
            transaction: {
              dateTime: "desc"
            }
          };
        }
        
        // Получаем сопоставления для текущей страницы
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
        
        // Получаем общее количество сопоставлений для пагинации
        const totalMatches = await ctx.db.match.count({
          where
        });
        
        // Получаем статистику по транзакциям в выбранном диапазоне
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
        
        // Получаем количество несопоставленных IDEX транзакций
        const totalUnmatchedIdexTransactions = await ctx.db.idexTransaction.count({
          where: {
            approvedAt: {
              gte: startDateTime.toISOString(),
              lte: endDateTime.toISOString()
            },
            matches: {
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
        const allMatches = await ctx.db.match.findMany({
          where
        });
        
        if (allMatches.length > 0) {
          stats = calculateTotalStats(allMatches);
        }
        
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
            }
          })),
          stats: {
            ...stats,
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
            unmatchedIdexTransactions: totalUnmatchedIdexTransactions
          },
          pagination: {
            totalMatches,
            totalPages: Math.ceil(totalMatches / pageSize) || 1,
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
            unmatchedIdexTransactions: 0
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
    cabinetIds: z.array(z.number().int().positive()).optional() // Добавляем массив ID кабинетов
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
        cabinetIds
      } = input;
      
      // Преобразуем даты с учетом таймзоны
      const startDateTime = dayjs(startDate).utc().toDate();
      const endDateTime = dayjs(endDate).utc().toDate();
      
      // Базовый фильтр для IDEX транзакций с approvedAt в заданном диапазоне
      // и еще не сопоставленных
      let where: any = {
        approvedAt: {
          gte: startDateTime.toISOString(),
          lte: endDateTime.toISOString()
        },
        matches: {
          none: {}
        }
      };
      
      // Добавляем фильтр по кабинетам, если указан
      if (cabinetIds && cabinetIds.length > 0) {
        where.cabinetId = {
          in: cabinetIds
        };
      }
      
      // Добавляем поиск по запросу, если указан
      if (searchQuery) {
        const numericSearch = !isNaN(Number(searchQuery)) ? Number(searchQuery) : undefined;
        
        where = {
          ...where,
          OR: [
            numericSearch 
              ? { externalId: { equals: BigInt(numericSearch) } } 
              : {},
            { wallet: { contains: searchQuery, mode: 'insensitive' } }
          ].filter(condition => Object.keys(condition).length > 0)
        };
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