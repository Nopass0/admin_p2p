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

// Helper function to calculate match metrics
function calculateClipMatchMetrics(bybitTx: { totalPrice: number }, viresTx: { sum_rub: number }) {
    const grossExpense = Math.abs(Number(viresTx.sum_rub)); // Vires amount is expense (use absolute value)
    const grossIncome = Math.abs(bybitTx.totalPrice); // Bybit amount is income (use absolute value)
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

// Гибкий тип для принятия дат в разных форматах
const flexibleDateSchema = z.union([
  z.string().refine((date) => dayjs(date).isValid(), { message: "Неверный формат даты" }),
  z.date(),
  z.object({ date: z.date() }).transform((val) => val.date), // Для поддержки объектов с датой/временем
]);

const MatchViresReportInput = z.object({
  id: z.number().optional(),
  name: z.string().min(1, "Название отчета обязательно"),
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
    cabinetType: z.enum(['bybit', 'vires']).optional(), // Тип кабинета (bybit или vires)
  })).optional(),
});

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

export const vvRouter = createTRPCRouter({
  // --- MatchViresReport Procedures ---

  createMatchViresReport: publicProcedure
    .input(MatchViresReportInput.omit({ id: true }))
    .mutation(async ({ ctx, input }) => {
      const { name, timeRangeStart, timeRangeEnd, reportDate, cabinetConfigs = [], notes = '', userId = 1 } = input;
      
      // Обработка конфигураций кабинетов, если они есть
      let processedCabinetConfigs = null;
      
      if (cabinetConfigs && cabinetConfigs.length > 0) {
        processedCabinetConfigs = cabinetConfigs.map(config => ({
          cabinetId: config.cabinetId,
          startDate: dayjs(config.startDate).format('YYYY-MM-DD HH:mm:ss'),
          endDate: dayjs(config.endDate).format('YYYY-MM-DD HH:mm:ss'),
          cabinetType: config.cabinetType || 'vires', // По умолчанию vires, если не указан
        }));
      }
      
      // Преобразуем конфигурацию кабинетов в строку JSON для хранения в базе данных
      const cabinetsData = processedCabinetConfigs 
        ? JSON.stringify(processedCabinetConfigs)
        : undefined;

      // Создаем запись в модели MatchViresReport
      const createdReport = await ctx.db.matchViresReport.create({
        data: {
          // В схеме Prisma нет поля name, используем notes для хранения имени отчета
          timeRangeStart: dayjs(timeRangeStart).utc().toDate(),
          timeRangeEnd: dayjs(timeRangeEnd).utc().toDate(),
          reportDate: dayjs(reportDate).utc().toDate(),
          notes: notes || name,
          totalMatches: 0,
          totalProfit: 0,
          averageProfit: 0,
          successRate: 0,
          userId: userId,
          idexCabinets: cabinetsData // Здесь храним конфигурации кабинетов
        },
      });
      
      // Возвращаем созданный отчет
      return createdReport;
    }),

  getMatchViresReports: publicProcedure
    .input(z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(10),
    }))
    .query(async ({ ctx, input }) => {
        const { page, limit } = input;
        const skip = (page - 1) * limit;

        const where = {};

        const [reports, totalCount] = await Promise.all([
            ctx.db.matchViresReport.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: { 
                    User: true
                }
            }),
            ctx.db.matchViresReport.count({ where }),
        ]);

        // Обрабатываем отчеты для включения информации о кабинетах
        const processedReports = await Promise.all(reports.map(async (report) => {
            // Парсим конфигурации кабинетов из JSON
            let cabinetConfigs: any[] = [];
            let bybitCabinets: any[] = [];
            let viresCabinetData: Array<{id: number, name?: string, login: string}> = [];
            
            if (report.idexCabinets && typeof report.idexCabinets === 'string') {
                try {
                    cabinetConfigs = JSON.parse(report.idexCabinets);
                    
                    // Получаем ID кабинетов Bybit
                    const bybitCabinetIds = cabinetConfigs
                        .filter((config: any) => config.cabinetType === 'bybit')
                        .map((config: any) => config.cabinetId);
                    
                    // Получаем ID кабинетов Vires
                    const viresCabinetIds = cabinetConfigs
                        .filter((config: any) => config.cabinetType === 'vires' || !config.cabinetType)
                        .map((config: any) => config.cabinetId);
                    
                    // Получаем кабинеты Bybit
                    if (bybitCabinetIds.length > 0) {
                        bybitCabinets = await ctx.db.bybitCabinet.findMany({
                            where: { id: { in: bybitCabinetIds } }
                        });
                    }
                    
                        // Получаем кабинеты Vires
                        if (viresCabinetIds.length > 0) {
                            const viresCabinets = await ctx.db.viresCabinet.findMany({
                                where: { id: { in: viresCabinetIds } },
                                select: { id: true, name: true, login: true }
                            });
                            // Преобразуем null в undefined для совместимости типов
                            viresCabinetData = viresCabinets.map(cabinet => ({
                                id: cabinet.id,
                                name: cabinet.name ?? undefined,
                                login: cabinet.login
                            }));
                        }
                } catch (e) {
                    console.error("Error parsing cabinet configs:", e);
                }
            }
            
            return {
                ...report,
                parsedCabinetConfigs: cabinetConfigs,
                bybitCabinets,
                viresCabinets: viresCabinetData
            };
        }));

        return {
            reports: processedReports,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            currentPage: page,
        };
    }),

  getMatchViresReportById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        // Получаем отчет с включением всех связанных сопоставлений
        const report = await ctx.db.matchViresReport.findUnique({
          where: { id: input.id },
          include: {
            viresClipMatches: { 
              include: {
                viresTransaction: {
                  include: { 
                    cabinet: true 
                  }
                },
                bybitTransaction: {
                  include: {
                    cabinet: true
                  }
                },
              }
            },
            User: true
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
        const matches = report.viresClipMatches || [];
        
        // Получаем списки ID сопоставленных транзакций
        const matchedBybitIds = matches.map(match => match.bybitTransactionId).filter(Boolean) as number[];
        const matchedViresIds = matches.map(match => match.viresTransactionId).filter(Boolean) as number[];
        
        // Получаем ID кабинетов из конфигурации отчета
        let bybitCabinetIds: number[] = [];
        let viresCabinetIds: number[] = [];
        
        if (report.idexCabinets && typeof report.idexCabinets === 'string') {
          try {
            const configs = JSON.parse(report.idexCabinets);
            
            // Фильтруем кабинеты по типу
            bybitCabinetIds = configs
              .filter((config: any) => config.cabinetType === 'bybit')
              .map((config: any) => config.cabinetId);
            
            viresCabinetIds = configs
              .filter((config: any) => config.cabinetType === 'vires' || !config.cabinetType)
              .map((config: any) => config.cabinetId);
          } catch (e) {
            console.error("Ошибка при парсинге конфигурации кабинетов:", e);
          }
        }
        
        // Получаем количество всех транзакций в заданном периоде
        const [totalViresTransactions, totalBybitTransactions] = await Promise.all([
          ctx.db.viresTransactionPayin.count({
            where: {
              cabinetId: viresCabinetIds.length > 0 ? { in: viresCabinetIds } : undefined,
              createdAt: {
                gte: report.timeRangeStart,
                lte: report.timeRangeEnd
              }
            }
          }),
          ctx.db.bybitTransactionFromCabinet.count({
            where: {
              cabinetId: bybitCabinetIds.length > 0 ? { in: bybitCabinetIds } : undefined,
              dateTime: {
                gte: dayjs(report.timeRangeStart).subtract(3, 'hour').toISOString(),
                lte: dayjs(report.timeRangeEnd).subtract(3, 'hour').toISOString()
              }
            }
          })
        ]);

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
        
        // Количество сопоставленных транзакций для статистики
        const matchedViresCount = new Set(matchedViresIds).size;
        const matchedBybitCount = new Set(matchedBybitIds).size;
        
        // Количество несопоставленных транзакций
        const unmatchedViresTransactions = totalViresTransactions - matchedViresCount;
        const unmatchedBybitTransactions = totalBybitTransactions - matchedBybitCount;
        
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
          // Информация о сопоставлениях
          totalMatches,
          successRate,
          // Статистика по транзакциям
          totalViresTransactions,
          totalBybitTransactions,
          matchedViresCount,
          matchedBybitCount,
          unmatchedViresTransactions,
          unmatchedBybitTransactions
        };
      } catch (error) {
        console.error("Ошибка при получении отчета:", error);
        throw error;
      }
    }),

  updateMatchViresReport: publicProcedure
    .input(MatchViresReportInput.required({ id: true }))
    .mutation(async ({ ctx, input }) => {
      const { id, timeRangeStart, timeRangeEnd, cabinetConfigs, ...data } = input;
      return ctx.db.matchViresReport.update({
        where: { id },
        data: {
            ...data,
            timeRangeStart: dayjs(timeRangeStart).utc().toDate(),
            timeRangeEnd: dayjs(timeRangeEnd).utc().toDate(),
            idexCabinets: cabinetConfigs ? JSON.stringify(cabinetConfigs) : undefined,
        },
      });
    }),

  deleteMatchViresReport: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Сначала удаляем все связанные сопоставления
      await ctx.db.viresClipMatch.deleteMany({
          where: { matchViresReportId: input.id },
      });
      
      // Затем удаляем сам отчет
      return ctx.db.matchViresReport.delete({
          where: { id: input.id },
      });
    }),

  // --- Transaction Fetching Procedures ---

  getBybitTransactionsForReport: publicProcedure
  .input(
    z.object({
      reportId: z.number().int().positive(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(10).default(10),
      search: z.string().optional(),
      sortColumn: z.string().optional(),
      sortDirection: z.enum(['asc', 'desc']).optional(),
    }),
  )
  .query(async ({ ctx, input }) => {
    const { reportId, page, limit, search } = input;
    const skip = (page - 1) * limit;

    // Получаем отчет
    const report = await ctx.db.matchViresReport.findUnique({
      where: { id: reportId },
      select: { timeRangeStart: true, timeRangeEnd: true, idexCabinets: true },
    });
    if (!report) throw new Error(`Отчёт #${reportId} не найден`);

    // Получаем ID кабинетов Bybit
    const bybitCabinetIds: number[] = (() => {
      if (!report.idexCabinets || typeof report.idexCabinets !== 'string') return [];
      try {
        return JSON.parse(report.idexCabinets)
          .filter((c: any) => c.cabinetType === 'bybit')
          .map((c: any) => c.cabinetId);
      } catch (e) {
        console.error('Failed to parse bybit cabinets', e);
        return [];
      }
    })();

    // Получаем уже сопоставленные транзакции
    const matchedRows = await ctx.db.viresClipMatch.findMany({
      where: { matchViresReportId: reportId },
      select: { bybitTransactionId: true },
    });
    const matchedBybitIds = matchedRows.map((r) => r.bybitTransactionId);

    // Диапазон с учётом сдвига времени
    const rangeStart = dayjs(report.timeRangeStart).subtract(3, 'hour').toISOString();
    const rangeEnd = dayjs(report.timeRangeEnd).subtract(3, 'hour').toISOString();

    // Общее кол-во транзакций Bybit в диапазоне
    const totalBybitTransactions = await ctx.db.bybitTransactionFromCabinet.count({
      where: {
        cabinetId: bybitCabinetIds.length ? { in: bybitCabinetIds } : undefined,
        dateTime: { gte: rangeStart, lte: rangeEnd },
      },
    });

    // where для не сопоставленных
    const where: Prisma.BybitTransactionFromCabinetWhereInput = {
      id: matchedBybitIds.length ? { notIn: matchedBybitIds } : undefined,
      dateTime: { gte: rangeStart, lte: rangeEnd },
      cabinetId: bybitCabinetIds.length ? { in: bybitCabinetIds } : undefined,
    };

    // Поиск
    if (search?.trim()) {
      const term = search.trim();
      const num = Number(term);
      const numFloat = parseFloat(term);
      where.OR = [
        !isNaN(num) ? { id: num } : undefined,
        { orderNo: { contains: term } },
        { counterparty: { contains: term } },
        !isNaN(numFloat) ? {
          totalPrice: { gte: numFloat - 0.01, lte: numFloat + 0.01 },
        } : undefined,
        { asset: { contains: term } },
      ].filter(Boolean) as any;
    }

    // Пагинация
    const totalUnmatched = await ctx.db.bybitTransactionFromCabinet.count({ where });

    const transactions = await ctx.db.bybitTransactionFromCabinet.findMany({
      where,
      skip,
      take: limit,
      orderBy: { dateTime: 'desc' },
      include: {
        cabinet: {
          select: { bybitEmail: true },
        },
      },
    });

    const detailed = transactions.map((t) => ({
      ...t,
      email: t.cabinet?.bybitEmail ?? 'Unknown',
    }));

    return {
      success: true,
      transactions: detailed,
      totalPages: Math.ceil(totalUnmatched / limit),
      currentPage: page,
      totalBybitTransactions,
      matchedCount: matchedBybitIds.length,
      unmatchedCount: totalBybitTransactions - matchedBybitIds.length,
    };
  }),

  getViresTransactionsForReport: publicProcedure
  .input(
    z.object({
      reportId: z.number().int().positive(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(10).default(10),
      search: z.string().optional(),
      sortColumn: z.string().optional(),
      sortDirection: z.enum(['asc', 'desc']).optional(),
    }),
  )
  .query(async ({ ctx, input }) => {
    const { reportId, page, limit, search } = input;
    const skip = (page - 1) * limit;

    /** 1. Отчёт */
    const report = await ctx.db.matchViresReport.findUnique({
      where: { id: reportId },
      select: { timeRangeStart: true, timeRangeEnd: true, idexCabinets: true },
    });
    if (!report) throw new Error(`Отчёт #${reportId} не найден`);

    /** 2. Кабинеты Vires */
    const viresCabinetIds: number[] = (() => {
      if (!report.idexCabinets || typeof report.idexCabinets !== 'string') return [];
      try {
        return JSON.parse(report.idexCabinets)
          .filter((c: any) => c.cabinetType === 'vires' || !c.cabinetType)
          .map((c: any) => c.cabinetId);
      } catch (e) {
        console.error('Failed to parse vires cabinets', e);
        return [];
      }
    })();

    /** 3. Сопоставленные */
    const matchedRows = await ctx.db.viresClipMatch.findMany({
      where: { matchViresReportId: reportId },
      select: { viresTransactionId: true },
    });
    const matchedViresIds = matchedRows.map((r) => r.viresTransactionId);

    /** 4. Общее кол-во транзакций Vires в диапазоне */
    const totalViresTransactions = await ctx.db.viresTransactionPayin.count({
      where: {
        cabinetId: viresCabinetIds.length ? { in: viresCabinetIds } : undefined,
        createdAt: { 
          gte: report.timeRangeStart,
          lte: report.timeRangeEnd 
        },
      },
    });

    /** 5. where для не сопоставлённых */
    const where: Prisma.ViresTransactionPayinWhereInput = {
      id: matchedViresIds.length ? { notIn: matchedViresIds } : undefined,
      createdAt: { 
        gte: report.timeRangeStart,
        lte: report.timeRangeEnd 
      },
      cabinetId: viresCabinetIds.length ? { in: viresCabinetIds } : undefined,
    };

    /** 6. Поиск */
    if (search?.trim()) {
      const term = search.trim();
      const num = Number(term);
      where.OR = [
        !isNaN(num) ? { id: num } : undefined,
        { card: { contains: term } },
        { fio: { contains: term } },
        { bank: { contains: term } },
        !isNaN(num) ? { sum_rub: num } : undefined,
      ].filter(Boolean) as any;
    }

    /** 7. Пагинация */
    const totalUnmatched = await ctx.db.viresTransactionPayin.count({ where });

    const transactions = await ctx.db.viresTransactionPayin.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        cabinet: {
          select: { name: true, login: true },
        },
      },
    });

    const detailed = transactions.map((t) => ({
      ...t,
      cabinetName: t.cabinet?.name || t.cabinet?.login || `ID: ${t.cabinetId}`,
    }));

    return {
      success: true,
      transactions: detailed,
      totalPages: Math.ceil(totalUnmatched / limit),
      currentPage: page,
      totalViresTransactions,
      matchedCount: matchedViresIds.length,
      unmatchedCount: totalViresTransactions - matchedViresIds.length,
    };
  }),

  // --- Методы для работы с сопоставлениями ---

  // Получение списка сопоставленных транзакций для отчета
  getMatchedTransactionsForReport: publicProcedure
    .input(z.object({
      reportId: z.number(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
      sortColumn: z.string().optional(),
      sortDirection: z.enum(['asc', 'desc']).optional()
    }))
    .query(async ({ ctx, input }) => {
      const { reportId, page, limit, sortColumn, sortDirection } = input;
      const skip = (page - 1) * limit;
      
      try {
        // Получаем общее количество сопоставленных транзакций
        const totalCount = await ctx.db.viresClipMatch.count({
          where: { matchViresReportId: reportId }
        });
        
        // Определяем порядок сортировки
        let orderBy: Prisma.ViresClipMatchOrderByWithRelationInput = { createdAt: 'desc' };
        
        // Если указаны параметры сортировки, используем их
        if (sortColumn) {
          if (sortColumn === 'id') {
            orderBy = { id: sortDirection || 'asc' };
          } else if (sortColumn === 'bybitDateTime') {
            orderBy = { bybitTransaction: { dateTime: sortDirection || 'desc' } };
          } else if (sortColumn === 'viresDateTime') {
            orderBy = { viresTransaction: { createdAt: sortDirection || 'desc' } };
          } else if (sortColumn === 'bybitAmount') {
            orderBy = { bybitTransaction: { totalPrice: sortDirection || 'desc' } };
          } else if (sortColumn === 'viresAmount') {
            orderBy = { viresTransaction: { sum_rub: sortDirection || 'desc' } };
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
        const matches = await ctx.db.viresClipMatch.findMany({
          where: { matchViresReportId: reportId },
          include: {
            bybitTransaction: {
              include: { cabinet: true }
            },
            viresTransaction: {
              include: { cabinet: true }
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
        const report = await ctx.db.matchViresReport.findUnique({
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
        
        // Получаем списки кабинетов по типам
        const bybitCabinetIds = cabinetConfigs
          .filter((config: any) => config.cabinetType === 'bybit')
          .map((config: any) => config.cabinetId);

        const viresCabinetIds = cabinetConfigs
          .filter((config: any) => config.cabinetType === 'vires' || !config.cabinetType)
          .map((config: any) => config.cabinetId);

        if (viresCabinetIds.length === 0 || bybitCabinetIds.length === 0) {
          return { 
            success: false, 
            message: "Не указаны кабинеты обоих типов для сопоставления", 
            stats: null 
          };
        }
        
        // Получаем Vires транзакции, которые еще не сопоставлены в этом отчете
        const viresTransactions = await ctx.db.viresTransactionPayin.findMany({
          where: {
            cabinetId: { in: viresCabinetIds },
            createdAt: {
              gte: report.timeRangeStart,
              lte: report.timeRangeEnd,
            },
            // Не должны уже иметь сопоставление в этом отчете
            NOT: {
              ViresClipMatch: {
                some: {
                  matchViresReportId: reportId
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
              ViresClipMatch: {
                some: {
                  matchViresReportId: reportId
                }
              }
            }
          },
        });

        console.log(`Найдено ${viresTransactions.length} Vires транзакций и ${bybitTransactions.length} Bybit транзакций для сопоставления`);

        // Массив для новых сопоставлений
        const newMatchesData = [];
        
        // Создаем множества для отслеживания уже использованных транзакций
        const usedViresTxIds = new Set();
        const usedBybitTxIds = new Set();
        
        // Получаем список всех уже сопоставленных транзакций в этом отчете
        const existingMatches = await ctx.db.viresClipMatch.findMany({
          where: {
            matchViresReportId: reportId
          },
          select: {
            viresTransactionId: true,
            bybitTransactionId: true
          }
        });
        
        // Добавляем их в множества использованных
        existingMatches.forEach(match => {
          if (match.viresTransactionId) usedViresTxIds.add(match.viresTransactionId);
          if (match.bybitTransactionId) usedBybitTxIds.add(match.bybitTransactionId);
        });
        
        // Перебираем все Vires транзакции для сопоставления
        for (const viresTx of viresTransactions) {
          if (!viresTx.createdAt || usedViresTxIds.has(viresTx.id)) continue;
          
          // Получаем сумму из Vires транзакции
          const viresAmount = viresTx.sum_rub;
          if (viresAmount <= 0) continue;
          
          // Проверяем возможные совпадения с Bybit транзакциями
          let bestMatch: { bybitTx: typeof bybitTransactions[0] | null; timeDiff: number } = { 
            bybitTx: null, 
            timeDiff: Infinity 
          };
          
          for (const bybitTx of bybitTransactions) {
            if (!bybitTx.dateTime || usedBybitTxIds.has(bybitTx.id)) continue;
            
            // Добавляем 3 часа к времени Bybit транзакции
            const bybitDateTime = dayjs(bybitTx.dateTime).add(3, 'hour').toDate();

            // Проверяем, совпадает ли сумма транзакции (с небольшой погрешностью)
            // Используем абсолютные значения для сравнения сумм
            if (Math.abs(Math.abs(bybitTx.totalPrice) - Math.abs(viresAmount)) > AMOUNT_THRESHOLD) continue;
            
            // Проверяем временную разницу между транзакциями
            const timeDiff = getTimeDifferenceInMinutes(viresTx.createdAt, bybitDateTime);
            
            // Если разница в пределах порога и лучше предыдущего совпадения
            if (timeDiff <= MINUTES_THRESHOLD && timeDiff < bestMatch.timeDiff) {
              bestMatch = { bybitTx, timeDiff };
            }
          }
          
          // Если нашли подходящее совпадение, создаем запись
          if (bestMatch.bybitTx) {
            const bybitMatchTx = bestMatch.bybitTx;
            const metrics = calculateClipMatchMetrics(bybitMatchTx, viresTx);
            
            // Помечаем транзакции как использованные
            usedViresTxIds.add(viresTx.id);
            usedBybitTxIds.add(bybitMatchTx.id);
            
            newMatchesData.push({
              matchViresReportId: reportId,
              viresTransactionId: viresTx.id,
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
          const result = await ctx.db.viresClipMatch.createMany({
            data: newMatchesData,
            skipDuplicates: true,
          });
          
          createdMatches = result.count;
          console.log(`Создано ${createdMatches} новых сопоставлений`);
          
          // Обновляем статистику отчета
          if (createdMatches > 0) {
            // Получаем все сопоставления для расчета статистики
            const allMatches = await ctx.db.viresClipMatch.findMany({
              where: { matchViresReportId: reportId }
            });
            
            // Рассчитываем статистику
            const stats = calculateReportStats(allMatches);
            
            // Обновляем отчет
            await ctx.db.matchViresReport.update({
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
      viresTransactionId: z.string(),
      bybitTransactionId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { reportId, viresTransactionId, bybitTransactionId } = input;

      // 1. Проверка существования транзакций
      const [viresTx, bybitTx, existingMatch] = await Promise.all([
          ctx.db.viresTransactionPayin.findUnique({ where: { uuid: viresTransactionId } }),
          ctx.db.bybitTransactionFromCabinet.findUnique({ where: { id: bybitTransactionId } }),
          ctx.db.viresClipMatch.findFirst({
              where: {
                  matchViresReportId: reportId,
                  OR: [
                      { bybitTransactionId },
                  ],
              },
          }),
      ]);

      if (!viresTx) throw new Error(`Vires транзакция #${viresTransactionId} не найдена.`);
      if (!bybitTx) throw new Error(`Bybit транзакция #${bybitTransactionId} не найдена.`);
      if (!viresTx.createdAt) throw new Error(`Vires транзакция #${viresTransactionId} не имеет даты создания.`);
      if (!bybitTx.dateTime) throw new Error(`Bybit транзакция #${bybitTransactionId} не имеет времени транзакции.`);

      if (existingMatch) {
          throw new Error(`Bybit транзакция #${bybitTransactionId} уже сопоставлена в этом отчете.`);
      }
      
      // Проверка, что транзакция Vires не сопоставлена
      const existingViresMatch = await ctx.db.viresClipMatch.findFirst({
          where: {
              viresTransactionId: viresTx.id, // Используем ID из найденной транзакции
              matchViresReportId: reportId,
          },
      });
      
      if (existingViresMatch) {
          throw new Error(`Vires транзакция #${viresTransactionId} уже сопоставлена в этом отчете.`);
      }

      // 2. Расчет метрик сопоставления
      const bybitDateTime = dayjs(bybitTx.dateTime).add(3, 'hour').toDate();
      const timeDiff = getTimeDifferenceInMinutes(viresTx.createdAt, bybitDateTime);
      const metrics = calculateClipMatchMetrics(bybitTx, viresTx);

      // Получаем данные отчета для получения userId
      const report = await ctx.db.matchViresReport.findUnique({
        where: { id: reportId },
        select: { userId: true },
      });
      if (!report) throw new Error(`Отчет #${reportId} не найден.`);
      
      // 3. Создаем сопоставление
      const newMatch = await ctx.db.viresClipMatch.create({
        data: {
          matchViresReportId: reportId,
          viresTransactionId: viresTx.id,
          bybitTransactionId,
          timeDifference: Math.round(timeDiff * 60), // в секундах
          grossExpense: metrics.grossExpense,
          grossIncome: metrics.grossIncome,
          grossProfit: metrics.grossProfit,
          profitPercentage: metrics.profitPercentage,
          userId: report.userId
        },
      });

      // 4. Обновляем статистику отчета
      const allMatches = await ctx.db.viresClipMatch.findMany({
        where: { matchViresReportId: reportId }
      });
      
      const stats = calculateReportStats(allMatches);
      
      await ctx.db.matchViresReport.update({
        where: { id: reportId },
        data: {
          totalMatches: stats.totalMatches,
          totalProfit: stats.totalProfit,
          averageProfit: stats.averageProfit,
          successRate: stats.successRate,
        }
      });

      return { success: true, matchId: newMatch.id };
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
        const match = await ctx.db.viresClipMatch.findUnique({
          where: { id: matchId }
        });
        
        if (!match) {
          throw new Error(`Сопоставление с ID ${matchId} не найдено`);
        }
        
        // Удаляем сопоставление
        await ctx.db.viresClipMatch.delete({
          where: { id: matchId }
        });
        
        // Обновляем статистику отчета
        const reportMatches = await ctx.db.viresClipMatch.findMany({
          where: { matchViresReportId: reportId }
        });
        
        // Рассчитываем новую статистику
        const stats = calculateReportStats(reportMatches);
        
        // Обновляем отчет
        await ctx.db.matchViresReport.update({
          where: { id: reportId },
          data: {
            totalMatches: stats.totalMatches,
            totalProfit: stats.totalProfit,
            averageProfit: stats.averageProfit,
            successRate: stats.successRate
          }
        });
        
        return { success: true };
      } catch (error) {
        console.error('Ошибка при удалении сопоставления:', error);
        throw new Error(`Ошибка при удалении сопоставления: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      }
    })
});
