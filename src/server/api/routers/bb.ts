import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { Prisma } from "@prisma/client";
import dayjs from "dayjs";
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

const MINUTES_THRESHOLD = 30; // Matching time window (+/- 30 minutes)
const AMOUNT_THRESHOLD = 0.01; // Matching amount tolerance (+/- 0.01 RUB)

// Helper function for time difference
function getTimeDifferenceInMinutes(date1: Date, date2: Date): number {
  return Math.abs(dayjs(date1).diff(dayjs(date2), 'minute'));
}

// Helper function to calculate match metrics (adapt fields as needed)
function calculateClipMatchMetrics(bybitTx: { amount: Prisma.Decimal }, idexTx: { parsedAmount: number }) {
    const grossExpense = Number(bybitTx.amount); // Bybit amount is expense
    const grossIncome = idexTx.parsedAmount; // Idex amount is income
    const grossProfit = grossIncome - grossExpense;
    const profitPercentage = grossExpense !== 0 ? (grossProfit / grossExpense) * 100 : 0;

    return {
        grossExpense,
        grossIncome,
        grossProfit,
        profitPercentage,
    };
}



// Define Zod schema for cabinet config used in fetching
const CabinetConfigSchema = z.object({
  cabinetId: z.number().int().positive(),
  startDate: z.string().refine((date) => dayjs(date).isValid()),
  endDate: z.string().refine((date) => dayjs(date).isValid()),
});

const BybitCabinetInput = z.object({
  id: z.number().optional(),
  bybitEmail: z.string().email(),
  apiKey: z.string().min(1, "API ключ обязателен"),
  apiSecret: z.string().min(1, "API секрет обязателен"),
  // Add any other relevant fields for BybitCabinet here
});

// Гибкий тип для принятия дат в разных форматах
const flexibleDateSchema = z.union([
  z.string().refine((date) => dayjs(date).isValid(), { message: "Неверный формат даты" }),
  z.date(),
  z.object({ date: z.date() }).transform((val) => val.date), // Для поддержки объектов с датой/временем
]);

const MatchBybitReportInput = z.object({
  id: z.number().optional(),
  name: z.string().min(1, "Название отчета обязательно"), // Добавлено поле названия, которого нет в модели Prisma
  reportDate: flexibleDateSchema, // Дата формирования отчета
  timeRangeStart: flexibleDateSchema, // Начало периода поиска сопоставлений
  timeRangeEnd: flexibleDateSchema, // Конец периода поиска сопоставлений
  notes: z.string().optional(), // Дополнительные заметки (необязательно)
  userId: z.number().int().positive().default(1), // ID пользователя
  totalMatches: z.number().int().nonnegative().default(0), // Количество сопоставлений
  totalProfit: z.number().default(0), // Общая прибыль
  averageProfit: z.number().default(0), // Средняя прибыль
  successRate: z.number().default(0), // Процент успешности
  cabinetConfigs: z.array(z.object({
    cabinetId: z.number().int().positive(),
    startDate: flexibleDateSchema,
    endDate: flexibleDateSchema,
    cabinetType: z.enum(['idex', 'bybit']).optional(), // Тип кабинета (бибит или идекс)
  })).optional(),
});

// Функция для извлечения суммы из IDEX транзакции
function getIdexAmount(amount: any): number {
  try {
    // Проверяем, является ли amount строкой JSON
    if (typeof amount === 'string') {
      const amountJson = JSON.parse(amount);
      return parseFloat(amountJson.trader?.[643] || 0);
    } else {
      // Если amount уже является объектом
      const amountObj = amount as any;
      return parseFloat(amountObj.trader?.[643] || 0);
    }
  } catch (error) {
    console.error('Ошибка при парсинге JSON поля amount:', error);
    return 0;
  }
}

function getIdexAmountTotalUsdt(total: any): number {
  try {
    // Проверяем, является ли total строкой JSON
    if (typeof total === 'string') {
      const totalJson = JSON.parse(total);
      return parseFloat(totalJson.trader?.["000001"] || 0);
    } else {
      // Если total уже является объектом
      const totalObj = total as any;
      return parseFloat(totalObj.trader?.["000001"] || 0);
    }
  } catch (error) {
    console.error('Ошибка при парсинге JSON поля total:', error);
    return 0;
  }
}

// Расчет статистики отчета
function calculateReportStats(matches: any[]) {
  const totalMatches = matches.length;
  
  // Валовые показатели
  const totalProfit = matches.reduce((sum, match) => sum + match.grossProfit, 0);
  const totalExpense = matches.reduce((sum, match) => sum + match.grossExpense, 0);
  const totalIncome = matches.reduce((sum, match) => sum + match.grossIncome, 0);
  
  // Средние показатели
  const averageProfit = totalMatches > 0 ? totalProfit / totalMatches : 0;
  const averageExpense = totalMatches > 0 ? totalExpense / totalMatches : 0;
  const averageIncome = totalMatches > 0 ? totalIncome / totalMatches : 0;
  
  // Максимальные и минимальные значения
  const maxProfit = totalMatches > 0 ? Math.max(...matches.map(match => match.grossProfit)) : 0;
  const minProfit = totalMatches > 0 ? Math.min(...matches.map(match => match.grossProfit)) : 0;
  
  // Статистика по успешным сопоставлениям
  const successfulMatches = matches.filter(match => match.grossProfit > 0).length;
  const successRate = totalMatches > 0 ? (successfulMatches / totalMatches) * 100 : 0;
  
  // Суммарный процент прибыли
  const totalProfitPercentage = totalExpense > 0 ? (totalProfit / totalExpense) * 100 : 0;

  return {
    // Основные показатели
    totalMatches,
    totalProfit,
    averageProfit,
    successRate,
    
    // Дополнительные показатели
    totalExpense,
    totalIncome,
    averageExpense,
    averageIncome,
    maxProfit,
    minProfit,
    totalProfitPercentage
  };
}

export const bbRouter = createTRPCRouter({
  // --- BybitCabinet Procedures ---

  createBybitCabinet: publicProcedure
    .input(BybitCabinetInput.omit({ id: true }))
    .mutation(async ({ ctx, input }) => {
      const { apiKey, apiSecret, ...otherFields } = input;
      return ctx.db.bybitCabinet.create({
        data: {
          ...otherFields,
          bybitApiToken: apiKey,       // Map apiKey to bybitApiToken
          bybitApiSecret: apiSecret,   // Map apiSecret to bybitApiSecret
          // Add createdById or similar if you track who added it
          // createdById: ctx.session.user.id, 
        },
      });
    }),

  getBybitCabinets: publicProcedure
    .query(async ({ ctx }) => {
      return ctx.db.bybitCabinet.findMany({
         // Add ordering or filtering if needed
         orderBy: { createdAt: 'desc' },
      });
    }),

  updateBybitCabinet: publicProcedure
    .input(z.object({
      id: z.number(),
      bybitEmail: z.string().email().optional(),
      apiKey: z.string().optional(),
      apiSecret: z.string().optional(),
      userId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, userId, apiKey, apiSecret, ...otherFields } = input;
      
      // Build the data object conditionally to only update the fields that are provided
      const updateData: any = {
        ...otherFields
      };
      
      if (apiKey !== undefined) {
        updateData.bybitApiToken = apiKey;
      }
      
      if (apiSecret !== undefined) {
        updateData.bybitApiSecret = apiSecret;
      }
      
      return ctx.db.bybitCabinet.update({
        where: { id },
        data: updateData,
      });
    }),

  deleteBybitCabinet: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.bybitCabinet.delete({
        where: { id: input.id },
      });
    }),

  // --- MatchBybitReport Procedures ---

  createMatchBybitReport: publicProcedure
    .input(MatchBybitReportInput.omit({ id: true }))
    .mutation(async ({ ctx, input }) => {
      const { name, timeRangeStart, timeRangeEnd, reportDate, cabinetConfigs = [], notes = '', userId = 1 } = input;
      
      // Обработка конфигураций кабинетов, если они есть
      let processedCabinetConfigs = null;
      
      if (cabinetConfigs && cabinetConfigs.length > 0) {
        processedCabinetConfigs = cabinetConfigs.map(config => ({
          cabinetId: config.cabinetId,
          startDate: dayjs(config.startDate).format('YYYY-MM-DD HH:mm:ss'),
          endDate: dayjs(config.endDate).format('YYYY-MM-DD HH:mm:ss'),
          cabinetType: config.cabinetType || 'bybit', // По умолчанию bybit, если не указан
        }));
      }
      
      // Преобразуем конфигурацию кабинетов в строку JSON для хранения в базе данных
      const idexCabinetsData = processedCabinetConfigs 
        ? JSON.stringify(processedCabinetConfigs)
        : undefined;

      // Используем timeRangeStart и timeRangeEnd вместо startDate и endDate
      const createdReport = await ctx.db.matchBybitReport.create({
        data: {
          timeRangeStart: dayjs(timeRangeStart).utc().toDate(),
          timeRangeEnd: dayjs(timeRangeEnd).utc().toDate(),
          reportDate: dayjs(reportDate).utc().toDate(),
          notes: notes || name, // Для совместимости записываем name в notes, если notes не указано
          totalMatches: 0,
          totalProfit: 0,
          averageProfit: 0,
          successRate: 0,
          userId: userId, // Сохраняем ID пользователя в отчете
          idexCabinets: idexCabinetsData // Записываем конфигурацию кабинетов в поле idexCabinets
        },
      });
      
      // Возвращаем созданный отчет
      return createdReport;
    }),

  getMatchBybitReports: publicProcedure
    .input(z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(10),
        // Add filters if needed (e.g., by user, date range)
    }))
    .query(async ({ ctx, input }) => {
        const { page, limit } = input;
        const skip = (page - 1) * limit;

        const where = {
            // Add filters here, e.g., createdById: ctx.session.user.id
        };

        const [reports, totalCount] = await Promise.all([
            ctx.db.matchBybitReport.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: { // Include related data if needed on the list view
                    // user: true, 
                    // _count: { select: { matches: true } } // Example: count of matches
                }
            }),
            ctx.db.matchBybitReport.count({ where }),
        ]);

        // Process reports to include idexCabinets and bybitCabinets
        const processedReports = await Promise.all(reports.map(async (report) => {
            // Parse cabinet configurations from JSON
            let cabinetConfigs: any[] = [];
            let idexCabinets: any[] = [];
            let bybitCabinetEmails: Array<{id: number, email: string}> = [];
            
            if (report.idexCabinets && typeof report.idexCabinets === 'string') {
                try {
                    cabinetConfigs = JSON.parse(report.idexCabinets);
                    
                    // Get idex cabinet IDs
                    const idexCabinetIds = cabinetConfigs
                        .filter((config: any) => config.cabinetType === 'idex')
                        .map((config: any) => config.cabinetId);
                    
                    // Get bybit cabinet IDs
                    const bybitCabinetIds = cabinetConfigs
                        .filter((config: any) => config.cabinetType === 'bybit' || !config.cabinetType)
                        .map((config: any) => config.cabinetId);
                    
                    // Fetch idex cabinets
                    if (idexCabinetIds.length > 0) {
                        idexCabinets = await ctx.db.idexCabinet.findMany({
                            where: { id: { in: idexCabinetIds } }
                        });
                    }
                    
                    // Fetch bybit cabinets
                    if (bybitCabinetIds.length > 0) {
                        const bybitCabinets = await ctx.db.bybitCabinet.findMany({
                            where: { id: { in: bybitCabinetIds } },
                            select: { id: true, bybitEmail: true }
                        });
                        bybitCabinetEmails = bybitCabinets.map(cabinet => ({
                            id: cabinet.id,
                            email: cabinet.bybitEmail
                        }));
                    }
                } catch (e) {
                    console.error("Error parsing cabinet configs:", e);
                }
            }
            
            return {
                ...report,
                parsedCabinetConfigs: cabinetConfigs,
                idexCabinets,
                bybitCabinetEmails
            };
        }));

        return {
            reports: processedReports,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            currentPage: page,
        };
    }),

getMatchBybitReportById: publicProcedure
  .input(z.object({ id: z.number() }))
  .query(async ({ ctx, input }) => {
    try {
      // Получаем отчет с включением всех связанных сопоставлений
      const report = await ctx.db.matchBybitReport.findUnique({
        where: { id: input.id },
        include: {
          bybitClipMatches: { // Включаем все сопоставления
            include: {
              idexTransaction: {
                include: { 
                  cabinet: true // Включаем данные о кабинете IDEX
                }
              },
              bybitTransaction: true,
            }
          },
          User: true // Включаем информацию о пользователе (используем User с большой буквы)
        }
      });
      
      if (!report) {
        throw new Error("Отчет не найден");
      }
      
      // Парсим конфигурацию кабинетов, если она хранится как JSON
      let parsedCabinetConfigs = null;
      if (report.idexCabinets && typeof report.idexCabinets === 'string') {
        try {
          parsedCabinetConfigs = JSON.parse(report.idexCabinets);
        } catch (e) {
          console.error("Ошибка при парсинге JSON конфигурации кабинетов", e);
        }
      }
      
      // Получаем информацию о сопоставлениях
      const matches = report.bybitClipMatches || [];
      
      // Выводим отладочную информацию о сопоставлениях
      console.log(`Report ID: ${input.id}`);
      console.log(`Total matches in report: ${matches.length}`);
      
      // Получаем списки ID сопоставленных транзакций
      const matchedIdexIds = matches.map(match => match.idexTransactionId).filter(Boolean) as number[];
      const matchedBybitIds = matches.map(match => match.bybitTransactionId).filter(Boolean) as number[];
      
      console.log(`Matched IDEX IDs count: ${matchedIdexIds.length} Unique: ${new Set(matchedIdexIds).size}`);
      console.log(`Matched Bybit IDs count: ${matchedBybitIds.length} Unique: ${new Set(matchedBybitIds).size}`);
      
      // Получаем ID кабинетов из конфигурации отчета
      let idexCabinetIds: number[] = [];
      let bybitCabinetIds: number[] = [];
      
      if (report.idexCabinets && typeof report.idexCabinets === 'string') {
        try {
          const configs = JSON.parse(report.idexCabinets);
          
          // Фильтруем кабинеты по типу
          idexCabinetIds = configs
            .filter((config: any) => config.cabinetType === 'idex')
            .map((config: any) => config.cabinetId);
          
          bybitCabinetIds = configs
            .filter((config: any) => config.cabinetType === 'bybit' || !config.cabinetType)
            .map((config: any) => config.cabinetId);
            
          console.log(`IDEX cabinet IDs in config: ${idexCabinetIds.join(', ')}`);
          console.log(`Bybit cabinet IDs in config: ${bybitCabinetIds.join(', ')}`);
        } catch (e) {
          console.error("Ошибка при парсинге конфигурации кабинетов:", e);
        }
      }
      
      // Выводим информацию о диапазоне дат
      console.log(`Date range start: ${report.timeRangeStart}`);
      console.log(`Date range end: ${report.timeRangeEnd}`);
      console.log(`ISO format start: ${dayjs(report.timeRangeStart).toISOString()}`);
      console.log(`ISO format end: ${dayjs(report.timeRangeEnd).toISOString()}`);
      
      // Для отладки получим несколько примеров сопоставленных транзакций
      if (matchedIdexIds.length > 0) {
        const sampleIdex = await ctx.db.idexTransaction.findMany({
          where: { id: { in: matchedIdexIds.slice(0, 3) } },
          select: { id: true, approvedAt: true, cabinetId: true }
        });
        
        console.log('Sample IDEX transactions:');
        console.log(JSON.stringify(sampleIdex, null, 2));
      }
      
      if (matchedBybitIds.length > 0) {
        const sampleBybit = await ctx.db.bybitTransactionFromCabinet.findMany({
          where: { id: { in: matchedBybitIds.slice(0, 3) } },
          select: { id: true, dateTime: true, cabinetId: true }
        });
        
        console.log('Sample Bybit transactions:');
        console.log(JSON.stringify(sampleBybit, null, 2));
      }
      
      // Подсчет всех транзакций IDEX в пределах диапазона дат и кабинетов
      const totalIdexTransactions = await ctx.db.idexTransaction.count({
        where: {
          approvedAt: {
            gte: dayjs(report.timeRangeStart).add(3, 'hour').toISOString(),
            lte: dayjs(report.timeRangeEnd).add(3, 'hour').toISOString(),
          },
          cabinetId: idexCabinetIds.length > 0 ? { in: idexCabinetIds } : undefined
        }
      });
      
      // Подсчет всех транзакций Bybit в пределах диапазона дат и кабинетов
      const totalBybitTransactions = await ctx.db.bybitTransactionFromCabinet.count({
        where: {
          dateTime: {
            gte: report.timeRangeStart,
            lte: report.timeRangeEnd,
          },
          cabinetId: bybitCabinetIds.length > 0 ? { in: bybitCabinetIds } : undefined
        }
      });
      
      console.log(`Total IDEX transactions in range: ${totalIdexTransactions}`);
      console.log(`Total Bybit transactions in range: ${totalBybitTransactions}`);
      
      // Подсчет количества сопоставленных транзакций, которые входят в диапазон дат и кабинетов
      const matchedIdexInRange = await ctx.db.idexTransaction.count({
        where: {
          id: { in: matchedIdexIds },
          approvedAt: {
            gte: dayjs(report.timeRangeStart).toISOString(),
            lte: dayjs(report.timeRangeEnd).toISOString(),
          },
          cabinetId: idexCabinetIds.length > 0 ? { in: idexCabinetIds } : undefined
        }
      });
      
      const matchedBybitInRange = await ctx.db.bybitTransactionFromCabinet.count({
        where: {
          id: { in: matchedBybitIds },
          dateTime: {
            gte: report.timeRangeStart,
            lte: report.timeRangeEnd,
          },
          cabinetId: bybitCabinetIds.length > 0 ? { in: bybitCabinetIds } : undefined
        }
      });
      
      console.log(`Matched IDEX transactions in range: ${matchedIdexInRange}`);
      console.log(`Matched Bybit transactions in range: ${matchedBybitInRange}`);
      
      // Проверка на транзакции взятые из более старых отчетов
      const matchesWithoutRangeCheck = matches.length;
      
      // Проверяем, сколько именно сопоставлений имеет транзакции, которые находятся в диапазоне
      const matchesWithinRange = await ctx.db.bybitClipMatch.count({
        where: {
          matchBybitReportId: input.id,
          idexTransaction: {
            approvedAt: {
              gte: dayjs(report.timeRangeStart).toISOString(),
              lte: dayjs(report.timeRangeEnd).toISOString(),
            },
            cabinetId: idexCabinetIds.length > 0 ? { in: idexCabinetIds } : undefined
          },
          bybitTransaction: {
            dateTime: {
              gte: report.timeRangeStart,
              lte: report.timeRangeEnd,
            },
            cabinetId: bybitCabinetIds.length > 0 ? { in: bybitCabinetIds } : undefined
          }
        }
      });
      
      console.log(`Matches with both transactions in range: ${matchesWithinRange}`);
      
      // Расчет основных показателей из сопоставлений
      const totalMatches = matches.length;
      let totalExpense = 0;
      let totalIncome = 0;
      let totalProfit = 0;
      let successfulMatches = 0;
      
      // Собираем данные из всех сопоставлений
      matches.forEach(match => {
        const expense = match.grossExpense || 0;
        const income = match.grossIncome || 0;
        const profit = match.grossProfit || 0;
        
        totalExpense += expense;
        totalIncome += income;
        totalProfit += profit;
        
        if (profit > 0) {
          successfulMatches++;
        }
      });
      
      // Рассчитываем производные показатели
      const averageExpense = totalMatches > 0 ? totalExpense / totalMatches : 0;
      const averageIncome = totalMatches > 0 ? totalIncome / totalMatches : 0;
      const averageProfit = totalMatches > 0 ? totalProfit / totalMatches : 0;
      const successRate = totalMatches > 0 ? (successfulMatches / totalMatches) * 100 : 0;
      const totalProfitPercentage = totalExpense > 0 ? (totalProfit / totalExpense) * 100 : 0;
      
      // Рассчитываем количество несопоставленных транзакций
      const unmatchedIdexTransactions = totalIdexTransactions - matchedIdexInRange;
      const unmatchedBybitTransactions = totalBybitTransactions - matchedBybitInRange;
      
      // Для отладки проверяем, есть ли транзакции, которые сопоставлены, но не найдены в БД
      const nonExistentIdexIds = await Promise.all(
        matchedIdexIds.map(async id => {
          const exists = await ctx.db.idexTransaction.findUnique({
            where: { id },
            select: { id: true }
          });
          return exists ? null : id;
        })
      ).then(ids => ids.filter(Boolean));
      
      const nonExistentBybitIds = await Promise.all(
        matchedBybitIds.map(async id => {
          const exists = await ctx.db.bybitTransactionFromCabinet.findUnique({
            where: { id },
            select: { id: true }
          });
          return exists ? null : id;
        })
      ).then(ids => ids.filter(Boolean));
      
      if (nonExistentIdexIds.length > 0) {
        console.warn(`Warning: Found ${nonExistentIdexIds.length} matched IDEX transactions that don't exist in the database`);
        console.log(`Non-existent IDEX IDs: ${nonExistentIdexIds.join(', ')}`);
      }
      
      if (nonExistentBybitIds.length > 0) {
        console.warn(`Warning: Found ${nonExistentBybitIds.length} matched Bybit transactions that don't exist in the database`);
        console.log(`Non-existent Bybit IDs: ${nonExistentBybitIds.join(', ')}`);
      }
      
      // Проверяем, есть ли несоответствия между количеством сопоставлений и количеством найденных транзакций
      if (matchedIdexIds.length !== matchedBybitIds.length) {
        console.warn(`Warning: Mismatch between matched IDEX count (${matchedIdexIds.length}) and matched Bybit count (${matchedBybitIds.length})`);
      }
      
      if (matchedIdexIds.length !== totalMatches) {
        console.warn(`Warning: Mismatch between total matches (${totalMatches}) and matched IDEX IDs (${matchedIdexIds.length})`);
      }
      
      if (matchedBybitIds.length !== totalMatches) {
        console.warn(`Warning: Mismatch between total matches (${totalMatches}) and matched Bybit IDs (${matchedBybitIds.length})`);
      }
      
      // Возвращаем отчет с расширенной статистикой
      return {
        ...report,
        cabinetConfigs: parsedCabinetConfigs,
        // Добавляем расширенную статистику
        totalExpense,
        totalIncome,
        averageExpense,
        averageIncome,
        averageProfit,
        totalProfitPercentage,
        // Добавляем исправленную статистику по транзакциям
        totalIdexTransactions,
        totalBybitTransactions,
        matchedIdexCount: matchedIdexInRange,
        matchedBybitCount: matchedBybitInRange,
        unmatchedIdexTransactions,
        unmatchedBybitTransactions,
        // Информация о сопоставлениях
        totalMatches,
        matchesWithinRange,
        successRate,
        // Добавляем информацию о возможных проблемах
        dataIssues: {
          nonExistentIdexCount: nonExistentIdexIds.length,
          nonExistentBybitCount: nonExistentBybitIds.length,
          hasIdexBybitCountMismatch: matchedIdexIds.length !== matchedBybitIds.length,
          hasMatchesCountMismatch: matchedIdexIds.length !== totalMatches || matchedBybitIds.length !== totalMatches
        }
      };
      
    } catch (error) {
      console.error("Ошибка при получении отчета:", error);
      throw error;
    }
  }),

  

  updateMatchBybitReport: publicProcedure
    .input(MatchBybitReportInput.required({ id: true }))
    .mutation(async ({ ctx, input }) => {
      const { id, timeRangeStart, timeRangeEnd, cabinetConfigs, ...data } = input;
      return ctx.db.matchBybitReport.update({
        where: { id },
        data: {
            ...data,
            timeRangeStart: dayjs(timeRangeStart).utc().toDate(),
            timeRangeEnd: dayjs(timeRangeEnd).utc().toDate(),
            idexCabinets: cabinetConfigs ? JSON.stringify(cabinetConfigs) : undefined,
        },
      });
    }),

  deleteMatchBybitReport: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
        // First delete all associated matches
        await ctx.db.bybitClipMatch.deleteMany({
            where: { matchBybitReportId: input.id },
        });
        
        // Then delete the report itself
        return ctx.db.matchBybitReport.delete({
            where: { id: input.id },
        });
    }),

  // --- Transaction Fetching Procedures ---

  getIdexTransactionsForReport: publicProcedure
    .input(z.object({
      reportId: z.number(), // ID отчета, для которого запрашиваются транзакции
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
      search: z.string().optional(), // Параметр поиска для фильтрации транзакций
      sortColumn: z.string().optional(), // Колонка для сортировки
      sortDirection: z.enum(['asc', 'desc']).optional() // Направление сортировки
    }))
    .query(async ({ ctx, input }) => {
      const { reportId, page, limit, search } = input;
      const skip = (page - 1) * limit;
      
      try {
        // Сначала получим информацию об отчете
        const report = await ctx.db.matchBybitReport.findUnique({
          where: { id: reportId },
          select: {
            timeRangeStart: true,
            timeRangeEnd: true,
            idexCabinets: true
          }
        });
        
        if (!report) {
          throw new Error(`Отчет с ID ${reportId} не найден`);
        }
        
        // Получаем конфигурации кабинетов из отчета
        let cabinetIds: number[] = [];
        if (report.idexCabinets && typeof report.idexCabinets === 'string') {
          try {
            const configs = JSON.parse(report.idexCabinets);
            // Фильтруем только IDEX кабинеты
            cabinetIds = configs
              .filter((config: any) => config.cabinetType === 'idex')
              .map((config: any) => config.cabinetId);
          } catch (e) {
            console.error("Failed to parse idexCabinets JSON", e);
          }
        }
        
        // Находим ID транзакций, которые уже сопоставлены в этом отчете
        const existingMatches = await ctx.db.bybitClipMatch.findMany({
          where: { matchBybitReportId: reportId },
          select: { idexTransactionId: true },
        });
        const matchedIdexIds = existingMatches.map(m => m.idexTransactionId).filter(Boolean);
        
        // Получаем общее количество IDEX транзакций в рамках отчета (для точной статистики)
        const totalIdexTransactions = await ctx.db.idexTransaction.count({
          where: {
            cabinetId: cabinetIds.length > 0 ? { in: cabinetIds } : undefined,
            approvedAt: {
              gte: dayjs(report.timeRangeStart).add(3, 'hour').toISOString(),
              lte: dayjs(report.timeRangeEnd).add(3, 'hour').toISOString(),
            },
          }
        });
        
        console.log(`[DEBUG] Total IDEX transactions in range: ${totalIdexTransactions}; Range: ${report.timeRangeStart} - ${report.timeRangeEnd}; IN ISO: ${dayjs(report.timeRangeStart).toISOString()} - ${dayjs(report.timeRangeEnd).toISOString()}`)
        
        // Строим условия запроса для неспоставленных транзакций
        const where: Prisma.IdexTransactionWhereInput = {
          // Фильтруем по дате (поле approvedAt имеет тип String в модели)
          approvedAt: {
            gte: dayjs(report.timeRangeStart).add(3, 'hour').toISOString(),
            lte: dayjs(report.timeRangeEnd).add(3, 'hour').toISOString(),
          },
          // Фильтруем по кабинетам
          cabinetId: cabinetIds.length > 0 ? { in: cabinetIds } : undefined
        };
        
        // Исключаем транзакции, которые уже сопоставлены (только если есть сопоставленные)
        if (matchedIdexIds.length > 0) {
          where.id = { notIn: matchedIdexIds };
        }
        
        // Добавляем условие поиска, если указано
        if (search && search.trim()) {
          const searchTerm = search.trim();
          const searchId = !isNaN(parseInt(searchTerm)) ? parseInt(searchTerm) : undefined;
          
          // Расширенный поиск по всем возможным полям
          where.OR = [
            searchId ? { id: searchId } : undefined,
            { wallet: { contains: searchTerm } },
            { status: searchTerm ? parseInt(searchTerm) : undefined }
          ].filter(Boolean) as any;
        }
        
        // Получаем количество несопоставленных транзакций
        const unmatchedCount = await ctx.db.idexTransaction.count({ where });
        
        // Получаем транзакции с пагинацией
        const transactions = await ctx.db.idexTransaction.findMany({
          where,
          skip,
          take: limit,
          orderBy: { approvedAt: 'desc' },
          select: {
            id: true,
            amount: true,  // JSON поле с суммой
            total: true,   // Добавляем поле total для расчета parsedAmountTotalUsdt
            approvedAt: true,
            cabinetId: true,
            externalId: true,
            status: true,
            wallet: true
          }
        });
        
        // Добавляем включение данных кабинета для поиска по idexId
        const transactionsWithDetails = await Promise.all(transactions.map(async tx => {
          // Получаем данные кабинета
          const cabinet = await ctx.db.idexCabinet.findUnique({
            where: { id: tx.cabinetId },
            select: { idexId: true }
          });
          
          try {
            // Проверяем, что amount и total существуют и являются JSON-объектами
            const parsedAmount = tx.amount ? getIdexAmount(tx.amount) : 0;
            const parsedAmountTotalUsdt = tx.total ? getIdexAmountTotalUsdt(tx.total) : 0;
            return { 
              ...tx, 
              parsedAmount,
              parsedAmountTotalUsdt,
              cabinet
            };
          } catch (error) {
            console.error('Error parsing IDEX transaction amount:', error);
            // В случае ошибки возвращаем транзакцию с parsedAmount = 0
            return { 
              ...tx, 
              parsedAmount: 0,
              parsedAmountTotalUsdt: 0,
              cabinet
            };
          }
        }));
        
        return {
          success: true,
          transactions: transactionsWithDetails,
          totalCount: unmatchedCount,                      // Возвращаем количество несопоставленных транзакций
          totalIdexTransactions: totalIdexTransactions,    // Общее количество транзакций в отчете
          matchedCount: matchedIdexIds.length,             // Количество сопоставленных транзакций
          totalPages: Math.ceil(unmatchedCount / limit),
          currentPage: page,
        };
      } catch (error) {
        console.error("Ошибка при получении IDEX транзакций:", error);
        return {
          success: false,
          message: `Ошибка при получении IDEX транзакций: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
          transactions: [],
          totalCount: 0,
          totalPages: 0,
          currentPage: page,
        };
      }
    }),

  getBybitTransactionsForReport: publicProcedure
    .input(z.object({
      reportId: z.number(), // ID отчета, для которого запрашиваются транзакции
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
      search: z.string().optional(), // Параметр поиска для фильтрации транзакций
      sortColumn: z.string().optional(), // Колонка для сортировки
      sortDirection: z.enum(['asc', 'desc']).optional() // Направление сортировки
    }))
    .query(async ({ ctx, input }) => {
      const { reportId, page, limit, search } = input;
      const skip = (page - 1) * limit;
      
      try {
        // Сначала получим информацию об отчете
        const report = await ctx.db.matchBybitReport.findUnique({
          where: { id: reportId },
          select: {
            timeRangeStart: true,
            timeRangeEnd: true,
            idexCabinets: true
          }
        });
        
        if (!report) {
          throw new Error(`Отчет с ID ${reportId} не найден`);
        }
        
        // Получаем конфигурации кабинетов из отчета
        let cabinetIds: number[] = [];
        if (report.idexCabinets && typeof report.idexCabinets === 'string') {
          try {
            const configs = JSON.parse(report.idexCabinets);
            // Фильтруем только Bybit кабинеты
            cabinetIds = configs
              .filter((config: any) => config.cabinetType === 'bybit' || !config.cabinetType)
              .map((config: any) => config.cabinetId);
          } catch (e) {
            console.error("Failed to parse cabinetConfigs JSON", e);
          }
        }
        
        // Находим ID транзакций, которые уже сопоставлены в этом отчете
        const existingMatches = await ctx.db.bybitClipMatch.findMany({
          where: { matchBybitReportId: reportId },
          select: { bybitTransactionId: true },
        });
        const matchedBybitIds = existingMatches.map(m => m.bybitTransactionId).filter(id => id !== null) as number[];
        
        // Строим условия запроса
        const where: Prisma.BybitTransactionFromCabinetWhereInput = {
          // Обязательно исключаем транзакции, которые уже были сопоставлены
          id: matchedBybitIds.length > 0 ? { notIn: matchedBybitIds } : undefined,
          // Фильтруем по дате
          dateTime: {
            gte: report.timeRangeStart,
            lte: report.timeRangeEnd,
          },
          // Фильтруем по кабинетам
          cabinetId: cabinetIds.length > 0 ? { in: cabinetIds } : undefined
        };
        
        // Добавляем условие поиска, если указано
        if (search && search.trim()) {
          const searchTerm = search.trim();
          const searchId = !isNaN(parseInt(searchTerm)) ? parseInt(searchTerm) : undefined;
          const searchAmount = !isNaN(parseFloat(searchTerm)) ? parseFloat(searchTerm) : undefined;
          
          // Расширенный поиск по всем столбцам
          where.OR = [
            { id: searchId },
            { orderNo: { contains: searchTerm } },
            { counterparty: { contains: searchTerm } },
            { totalPrice: searchAmount ? { gte: searchAmount - 0.01, lte: searchAmount + 0.01 } : undefined },
            { asset: { contains: searchTerm } }
          ].filter(Boolean);
        }
        
        // Получаем общее количество транзакций, соответствующих запросу
        const totalCount = await ctx.db.bybitTransactionFromCabinet.count({ where });
        
        // Получаем транзакции с пагинацией
        const transactions = await ctx.db.bybitTransactionFromCabinet.findMany({
          where,
          skip,
          take: limit,
          orderBy: { dateTime: 'desc' },
          include: {
            cabinet: {
              select: {
                bybitEmail: true
              }
            }
          }
        });
        
        // Добавляем email для удобства отображения
        const transactionsWithEmail = transactions.map(tx => ({
          ...tx,
          email: tx.cabinet?.bybitEmail || 'Unknown'
        }));
        
        return {
          success: true,
          transactions: transactionsWithEmail,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          currentPage: page,
        };
      } catch (error) {
        console.error("Ошибка при получении Bybit транзакций:", error);
        return {
          success: false,
          message: `Ошибка при получении Bybit транзакций: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
          transactions: [],
          totalCount: 0,
          totalPages: 0,
          currentPage: page,
        };
      }
    }),

  // --- Методы для работы с сопоставлениями ---

  // Получение списка сопоставленных транзакций для отчета
  getMatchedTransactionsForReport: publicProcedure
    .input(z.object({
      reportId: z.number(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
      sortColumn: z.string().optional(), // Колонка для сортировки
      sortDirection: z.enum(['asc', 'desc']).optional() // Направление сортировки
    }))
    .query(async ({ ctx, input }) => {
      const { reportId, page, limit, sortColumn, sortDirection } = input;
      const skip = (page - 1) * limit;
      
      try {
        // Получаем общее количество сопоставленных транзакций
        const totalCount = await ctx.db.bybitClipMatch.count({
          where: { matchBybitReportId: reportId }
        });
        
        // Определяем порядок сортировки
        let orderBy: Prisma.BybitClipMatchOrderByWithRelationInput = { createdAt: 'desc' };
        
        // Если указаны параметры сортировки, используем их
        if (sortColumn) {
          if (sortColumn === 'id') {
            orderBy = { id: sortDirection || 'asc' };
          } else if (sortColumn === 'bybitDateTime') {
            orderBy = { bybitTransaction: { dateTime: sortDirection || 'desc' } };
          } else if (sortColumn === 'idexDateTime') {
            orderBy = { idexTransaction: { approvedAt: sortDirection || 'desc' } };
          } else if (sortColumn === 'bybitAmount') {
            orderBy = { bybitTransaction: { totalPrice: sortDirection || 'desc' } };
          } else if (sortColumn === 'idexCabinet') {
            orderBy = { idexTransaction: { cabinet: { idexId: sortDirection || 'asc' } } };
          } else if (sortColumn === 'grossExpense') {
            orderBy = { grossExpense: sortDirection || 'desc' };
          } else if (sortColumn === 'grossIncome') {
            orderBy = { grossIncome: sortDirection || 'desc' };
          } else if (sortColumn === 'grossProfit') {
            orderBy = { grossProfit: sortDirection || 'desc' };
          } else if (sortColumn === 'profitPercentage') {
            orderBy = { profitPercentage: sortDirection || 'desc' };
          }
        }
        
        // Получаем список сопоставлений с включением связанных транзакций
        const matches = await ctx.db.bybitClipMatch.findMany({
          where: { matchBybitReportId: reportId },
          include: {
            bybitTransaction: true,
            idexTransaction: {
              include: {
                cabinet: true
              }
            }
          },
          orderBy,
          skip,
          take: limit
        });
        
        return {
          success: true,
          matches,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          currentPage: page
        };
      } catch (error) {
        console.error('Ошибка при получении сопоставленных транзакций:', error);
        return {
          success: false,
          message: `Ошибка при получении сопоставленных транзакций: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
          matches: [],
          totalCount: 0,
          totalPages: 0,
          currentPage: page
        };
      }
    }),

  // Удаление сопоставления
  unmatchTransaction: publicProcedure
    .input(z.object({
      matchId: z.number(),
      reportId: z.number()
    }))
    .mutation(async ({ ctx, input }) => {
      const { matchId, reportId } = input;
      
      try {
        // Получаем информацию о сопоставлении перед удалением
        const match = await ctx.db.bybitClipMatch.findUnique({
          where: { id: matchId }
        });
        
        if (!match) {
          throw new Error(`Сопоставление с ID ${matchId} не найдено`);
        }
        
        // Удаляем сопоставление
        await ctx.db.bybitClipMatch.delete({
          where: { id: matchId }
        });
        
        // Обновляем статистику отчета
        const reportMatches = await ctx.db.bybitClipMatch.findMany({
          where: { matchBybitReportId: reportId }
        });
        
        // Рассчитываем новую статистику
        const totalMatches = reportMatches.length;
        let totalProfit = 0;
        let profitableMatches = 0;
        
        for (const m of reportMatches) {
          totalProfit += m.grossProfit;
          if (m.grossProfit > 0) profitableMatches++;
        }
        
        const averageProfit = totalMatches > 0 ? totalProfit / totalMatches : 0;
        const successRate = totalMatches > 0 ? profitableMatches / totalMatches : 0;
        
        // Обновляем отчет
        await ctx.db.matchBybitReport.update({
          where: { id: reportId },
          data: {
            totalMatches,
            totalProfit,
            averageProfit,
            successRate
          }
        });
        
        return { success: true };
      } catch (error) {
        console.error('Ошибка при удалении сопоставления:', error);
        throw new Error(`Ошибка при удалении сопоставления: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      }
    }),
    
  // Автоматическое сопоставление транзакций для отчета
  // Автоматическое сопоставление транзакций для отчета
  matchTransactionsAutomatically: publicProcedure
    .input(z.object({
      reportId: z.number().int().positive(),
      userId: z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { reportId, userId } = input;

        // Получаем данные отчета
        const report = await ctx.db.matchBybitReport.findUnique({
          where: { id: reportId }
        });

        if (!report) {
          return { 
            success: false, 
            message: "Отчет не найден", 
            stats: null 
          };
        }
        
        // Парсим конфигурацию кабинетов из отчета
        let cabinetConfigs = [];
        if (report.idexCabinets) {
          try {
            cabinetConfigs = JSON.parse(report.idexCabinets as string);
          } catch (error) {
            console.error('Ошибка при парсинге конфигурации кабинетов:', error);
            return { 
              success: false, 
              message: "Ошибка при парсинге конфигурации кабинетов", 
              stats: null 
            };
          }
        }

        console.log(`Начинаем автоматическое сопоставление для отчета #${reportId}`);
        console.log(`Период: с ${report.timeRangeStart} по ${report.timeRangeEnd} ISO format: ${dayjs(report.timeRangeStart).toISOString()} - ${dayjs(report.timeRangeEnd).toISOString()}`);
        console.log(`Конфигурации кабинетов: ${cabinetConfigs.length}`);

        // Получаем списки кабинетов по типам
        const idexCabinetIds = cabinetConfigs
          .filter(config => config.cabinetType === 'idex')
          .map(config => config.cabinetId);

        const bybitCabinetIds = cabinetConfigs
          .filter(config => config.cabinetType === 'bybit' || !config.cabinetType)
          .map(config => config.cabinetId);

        if (idexCabinetIds.length === 0 || bybitCabinetIds.length === 0) {
          return { 
            success: false, 
            message: "Не указаны кабинеты обоих типов для сопоставления", 
            stats: null 
          };
        }
        
        // Получаем IDEX транзакции, которые еще не сопоставлены в этом отчете
        const idexTransactions = await ctx.db.idexTransaction.findMany({
          where: {
            cabinetId: { in: idexCabinetIds },
            approvedAt: {
              gte: dayjs(report.timeRangeStart).toISOString(),
              lte: dayjs(report.timeRangeEnd).toISOString(),
            },
            // Не должны уже иметь сопоставление в этом отчете
            NOT: {
              BybitClipMatch: {
                some: {
                  matchBybitReportId: reportId
                }
              }
            }
          },
        });

        // Получаем Bybit транзакции, которые еще не сопоставлены в этом отчете
        const bybitTransactions = await ctx.db.bybitTransactionFromCabinet.findMany({
          where: {
            cabinetId: { in: bybitCabinetIds },
            dateTime: {
              gte: dayjs(report.timeRangeStart).subtract(3, 'hour').toISOString(),
              lte: dayjs(report.timeRangeEnd).subtract(3, 'hour').toISOString(),
            },
            // Не должны уже иметь сопоставление в этом отчете
            NOT: {
              BybitClipMatch: {
                some: {
                  matchBybitReportId: reportId
                }
              }
            }
          },
        });

        console.log(`Найдено ${idexTransactions.length} IDEX транзакций и ${bybitTransactions.length} Bybit транзакций для сопоставления`);
        console.log(JSON.stringify(bybitTransactions, null, 2));

        // Массив для новых сопоставлений
        const newMatchesData = [];
        
        // Создаем множества для отслеживания уже использованных транзакций
        const usedIdexTxIds = new Set();
        const usedBybitTxIds = new Set();
        
        // Получаем список всех уже сопоставленных транзакций в этом отчете
        const existingMatches = await ctx.db.bybitClipMatch.findMany({
          where: {
            matchBybitReportId: reportId
          },
          select: {
            idexTransactionId: true,
            bybitTransactionId: true
          }
        });
        
        // Добавляем их в множества использованных
        existingMatches.forEach(match => {
          if (match.idexTransactionId) usedIdexTxIds.add(match.idexTransactionId);
          if (match.bybitTransactionId) usedBybitTxIds.add(match.bybitTransactionId);
        });
        
        // Перебираем все IDEX транзакции для сопоставления
        for (const idexTx of idexTransactions) {
          if (!idexTx.approvedAt || usedIdexTxIds.has(idexTx.id)) continue;
          
          // Получаем сумму из IDEX транзакции
          const idexAmount = getIdexAmount(idexTx.amount);
          const idexAmountTotalUsdt = getIdexAmountTotalUsdt(idexTx.total)
          if (idexAmount <= 0) continue;
          
          // Проверяем возможные совпадения с Bybit транзакциями
          let bestMatch = { bybitTx: null, timeDiff: Infinity };
          
          for (const bybitTx of bybitTransactions) {
            if (!bybitTx.dateTime || usedBybitTxIds.has(bybitTx.id)) continue;
            
            // Добавляем 3 часа к времени Bybit транзакции
            const bybitDateTime = dayjs(bybitTx.dateTime).add(3, 'hour').toISOString(); //! TODO:DELETE 3 hourse /// !!DELETED

            // Проверяем, совпадает ли сумма транзакции (с небольшой погрешностью)
            if (Math.abs(bybitTx.totalPrice - idexAmount) > AMOUNT_THRESHOLD) continue;
            
            // Проверяем временную разницу между транзакциями
            const timeDiff = getTimeDifferenceInMinutes(idexTx.approvedAt, bybitDateTime);
            
            // Если разница в пределах порога и лучше предыдущего совпадения
            if (timeDiff <= MINUTES_THRESHOLD && timeDiff < bestMatch.timeDiff) {
              bestMatch = { bybitTx, timeDiff };
            }
            // console.log(`\n--------------------------\nСопоставление для транзакции ${idexTx.id} (BB: ${bybitTx.orderNo}): ${bestMatch.bybitTx ? 'Найдено' : 'Нет'}\n---------------------\nIDEX TIME: ${idexTx.approvedAt}\nBYBIT TIME: ${bybitDateTime}\n-------------------------------\nIDEX AMOUNT: ${idexAmount}\nBYBIT AMOUNT: ${bybitTx.totalPrice}\n-------------------------------\n`);
          }

          if (bestMatch.bybitTx) {
            console.log(
              `✔ match IDEX#${idexTx.id} ⇄ BYBIT#${bestMatch.bybitTx.orderNo}  Δ=${bestMatch.timeDiff} мин`
            );
          }
          
          // Если нашли подходящее совпадение, создаем запись
          if (bestMatch.bybitTx) {
            const bybitMatchTx = bestMatch.bybitTx;
            const idexTxWithAmount = { ...idexTx, parsedAmount: idexAmountTotalUsdt };
            const metrics = calculateClipMatchMetrics(bybitMatchTx, idexTxWithAmount);
            
            // Помечаем транзакции как использованные
            usedIdexTxIds.add(idexTx.id);
            usedBybitTxIds.add(bybitMatchTx.id);
            
            newMatchesData.push({
              matchBybitReportId: reportId,
              idexTransactionId: idexTx.id,
              bybitTransactionId: bybitMatchTx.id,
              timeDifference: Math.round(bestMatch.timeDiff * 60), // Переводим минуты в секунды
              grossExpense: metrics.grossExpense,
              grossIncome: metrics.grossIncome,
              grossProfit: metrics.grossProfit,
              profitPercentage: metrics.profitPercentage,

              userId: userId || report.userId, // Используем переданный userId или берем из отчета
            });
          }
        }
        
        console.log(`Найдено ${newMatchesData.length} сопоставлений для добавления в отчет`);
        
        // Создаем сопоставления в БД
        let createdMatches = 0;
        if (newMatchesData.length > 0) {
          const result = await ctx.db.bybitClipMatch.createMany({
            data: newMatchesData,
            skipDuplicates: true,
          });
          
          createdMatches = result.count;
          console.log(`Создано ${createdMatches} новых сопоставлений`);
          
          // Обновляем статистику отчета
          if (createdMatches > 0) {
            // Получаем все сопоставления для расчета статистики
            const allMatches = await ctx.db.bybitClipMatch.findMany({
              where: { matchBybitReportId: reportId }
            });
            
            // Рассчитываем статистику
            const stats = calculateReportStats(allMatches);
            
            // Обновляем отчет
            await ctx.db.matchBybitReport.update({
              where: { id: reportId },
              data: {
                totalMatches: stats.totalMatches,
                totalProfit: stats.totalProfit,
                averageProfit: stats.averageProfit,
                successRate: stats.successRate,
              }
            });
            
            return {
              success: true,
              message: `Успешно создано ${createdMatches} новых сопоставлений`,
              stats: {
                newMatches: createdMatches,
                totalMatches: stats.totalMatches,
                totalProfit: stats.totalProfit,
                averageProfit: stats.averageProfit,
                successRate: stats.successRate,
              }
            };
          }
        }
        
        // Если не было создано новых сопоставлений
        return {
          success: true,
          message: "Новых сопоставлений не найдено",
          stats: {
            newMatches: 0,
            totalMatches: report.totalMatches,
            totalProfit: report.totalProfit,
            averageProfit: report.averageProfit,
            successRate: report.successRate,
          }
        };
      } catch (error) {
        console.error('Ошибка при автоматическом сопоставлении транзакций:', error);
        return { 
          success: false, 
          message: `Ошибка при автоматическом сопоставлении: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`, 
          stats: null 
        };
      }
    }),
  
  // Ручное сопоставление транзакций


  matchTransactionManually: publicProcedure
    .input(z.object({
      reportId: z.number(),
      idexTransactionId: z.number(),
      bybitTransactionId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { reportId, idexTransactionId, bybitTransactionId } = input;

      // 1. Validation
      const [idexTx, bybitTx, existingMatch] = await Promise.all([
          ctx.db.idexTransaction.findUnique({ where: { id: idexTransactionId } }),
          ctx.db.bybitTransactionFromCabinet.findUnique({ where: { id: bybitTransactionId } }),
          ctx.db.bybitClipMatch.findFirst({
              where: {
                  matchBybitReportId: reportId,
                  OR: [
                      { idexTransactionId },
                      { bybitTransactionId },
                  ],
              },
          }),
      ]);

      if (!idexTx) throw new Error(`IDEX транзакция #${idexTransactionId} не найдена.`);
      if (!bybitTx) throw new Error(`Bybit транзакция #${bybitTransactionId} не найдена.`);
      if (!idexTx.approvedAt) throw new Error(`IDEX транзакция #${idexTransactionId} не имеет даты подтверждения.`);
       if (!bybitTx.dateTime) throw new Error(`Bybit транзакция #${bybitTransactionId} не имеет времени транзакции.`);

      if (existingMatch) {
          if (existingMatch.idexTransactionId === idexTransactionId) {
              throw new Error(`IDEX транзакция #${idexTransactionId} уже сопоставлена в этом отчете.`);
          } else {
               throw new Error(`Bybit транзакция #${bybitTransactionId} уже сопоставлена в этом отчете.`);
          }
      }

      // 2. Calculate Metrics

      //get report and get userId
      const report = await ctx.db.matchBybitReport.findUnique({
        where: { id: reportId },
        select: { userId: true },
      });
      if (!report) throw new Error(`Отчет #${reportId} не найден.`);
      
      // Проверяем, что пользователь существует
      const userExists = await ctx.db.user.findUnique({
        where: { id: report.userId },
        select: { id: true }
      });
      
      // Если пользователь не найден, используем стандартное значение (1)
      const userId = userExists ? report.userId : 1;


      // 3. Create Match
      const newMatch = await ctx.db.bybitClipMatch.create({
        data: {
          matchBybitReportId: reportId,
          idexTransactionId,
          bybitTransactionId,
          timeDifference: timeDiff,
          // Store calculated metrics
          grossExpense: metrics.grossExpense,
          grossIncome: metrics.grossIncome,
          grossProfit: metrics.grossProfit,
          profitPercentage: metrics.profitPercentage,
          userId: userId // Используем проверенный userId
        },
      });

      console.log(`Создано ручное сопоставление ID ${newMatch.id} для отчета ${reportId}.`);

      return { success: true, matchId: newMatch.id };
    }),

});

export type BBRouter = typeof bbRouter; // Export type for frontend
