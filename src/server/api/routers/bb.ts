import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { Prisma } from "@prisma/client";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import {
  buildIdexWhere,
  buildBybitWhere,
  parseWindows,
} from "../utils/perCabinetWindows";

dayjs.extend(utc);

const MINUTES_THRESHOLD = 30; // Matching time window (+/- 30 minutes)
const AMOUNT_THRESHOLD = 0.01; // Matching amount tolerance (+/- 0.01 RUB)

// Helper function for time difference
function getTimeDifferenceInMinutes(date1: Date, date2: Date): number {
  return Math.abs(dayjs(date1).diff(dayjs(date2), "minute"));
}

// Helper function to calculate match metrics (adapt fields as needed)
function calculateClipMatchMetrics(
  bybitTx: { amount: Prisma.Decimal },
  idexTx: { parsedAmount: number },
) {
  const grossExpense = Number(bybitTx.amount); // Bybit amount is expense
  const grossIncome = Number(idexTx.parsedAmount); // Idex amount is income
  const grossProfit = grossIncome - grossExpense;
  const profitPercentage =
    grossExpense !== 0 ? (grossProfit / grossExpense) * 100 : 0;

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
  z.string().refine((date) => dayjs(date).isValid(), {
    message: "Неверный формат даты",
  }),
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
  cabinetConfigs: z
    .array(
      z.object({
        cabinetId: z.number().int().positive(),
        startDate: flexibleDateSchema,
        endDate: flexibleDateSchema,
        cabinetType: z.enum(["idex", "bybit"]).optional(), // Тип кабинета (бибит или идекс)
      }),
    )
    .optional(),
});

// Функция для извлечения суммы из IDEX транзакции
function getIdexAmount(amount: any): number {
  try {
    // Проверяем, является ли amount строкой JSON
    if (typeof amount === "string") {
      const amountJson = JSON.parse(amount);
      return parseFloat(amountJson.trader?.[643] || 0);
    } else {
      // Если amount уже является объектом
      const amountObj = amount as any;
      return parseFloat(amountObj.trader?.[643] || 0);
    }
  } catch (error) {
    console.error("Ошибка при парсинге JSON поля amount:", error);
    return 0;
  }
}

function getIdexAmountTotalUsdt(total: any): number {
  try {
    // Проверяем, является ли total строкой JSON
    if (typeof total === "string") {
      const totalJson = JSON.parse(total);
      return parseFloat(totalJson.trader?.["000001"] || 0);
    } else {
      // Если total уже является объектом
      const totalObj = total as any;
      return parseFloat(totalObj.trader?.["000001"] || 0);
    }
  } catch (error) {
    console.error("Ошибка при парсинге JSON поля total:", error);
    return 0;
  }
}

// Расчет статистики отчета
function calculateReportStats(matches: any[]) {
  const totalMatches = matches.length;

  // Валовые показатели
  const totalProfit = matches.reduce(
    (sum, match) => sum + match.grossProfit,
    0,
  );
  const totalExpense = matches.reduce(
    (sum, match) => sum + match.grossExpense,
    0,
  );
  const totalIncome = matches.reduce(
    (sum, match) => sum + match.grossIncome,
    0,
  );

  // Средние показатели
  const averageProfit = totalMatches > 0 ? totalProfit / totalMatches : 0;
  const averageExpense = totalMatches > 0 ? totalExpense / totalMatches : 0;
  const averageIncome = totalMatches > 0 ? totalIncome / totalMatches : 0;

  // Максимальные и минимальные значения
  const maxProfit =
    totalMatches > 0
      ? Math.max(...matches.map((match) => match.grossProfit))
      : 0;
  const minProfit =
    totalMatches > 0
      ? Math.min(...matches.map((match) => match.grossProfit))
      : 0;

  // Статистика по успешным сопоставлениям
  const successfulMatches = matches.filter(
    (match) => match.grossProfit > 0,
  ).length;
  const successRate =
    totalMatches > 0 ? (successfulMatches / totalMatches) * 100 : 0;

  // Суммарный процент прибыли
  const totalProfitPercentage =
    totalExpense > 0 ? (totalProfit / totalExpense) * 100 : 0;

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
    totalProfitPercentage,
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
          bybitApiToken: apiKey, // Map apiKey to bybitApiToken
          bybitApiSecret: apiSecret, // Map apiSecret to bybitApiSecret
          // Add createdById or similar if you track who added it
          // createdById: ctx.session.user.id,
        },
      });
    }),

  getBybitCabinets: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.bybitCabinet.findMany({
      // Add ordering or filtering if needed
      orderBy: { createdAt: "desc" },
    });
  }),

  updateBybitCabinet: publicProcedure
    .input(
      z.object({
        id: z.number(),
        bybitEmail: z.string().email().optional(),
        apiKey: z.string().optional(),
        apiSecret: z.string().optional(),
        userId: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, userId, apiKey, apiSecret, ...otherFields } = input;

      // Build the data object conditionally to only update the fields that are provided
      const updateData: any = {
        ...otherFields,
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
      const {
        name,
        timeRangeStart,
        timeRangeEnd,
        reportDate,
        cabinetConfigs = [],
        notes = "",
        userId = 1,
      } = input;

      // Обработка конфигураций кабинетов, если они есть
      let processedCabinetConfigs = null;

      if (cabinetConfigs && cabinetConfigs.length > 0) {
        processedCabinetConfigs = cabinetConfigs.map((config) => ({
          cabinetId: config.cabinetId,
          startDate: dayjs(config.startDate).format("YYYY-MM-DD HH:mm:ss"),
          endDate: dayjs(config.endDate).format("YYYY-MM-DD HH:mm:ss"),
          cabinetType: config.cabinetType || "bybit", // По умолчанию bybit, если не указан
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
          idexCabinets: idexCabinetsData, // Записываем конфигурацию кабинетов в поле idexCabinets
        },
      });

      // Возвращаем созданный отчет
      return createdReport;
    }),

  // ─────────────────────────────────────────────────────────────────────────────
  //  getMatchBybitReports   (заменить весь блок)
  // ─────────────────────────────────────────────────────────────────────────────
  getMatchBybitReports: publicProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(10),
        // при необходимости добавляйте фильтры (userId, диапазон дат …)
      }),
    )
    .query(async ({ ctx, input }) => {
      const { page, limit } = input;
      const skip = (page - 1) * limit;

      /* ── 1.  Базовый where для списка отчётов  ───────────────────────────── */
      const where: Prisma.MatchBybitReportWhereInput = {
        // пример: createdById: ctx.session.user.id
      };

      /* ── 2.  Сами отчёты (без метрик) + totalCount ───────────────────────── */
      const [reports, totalCount] = await Promise.all([
        ctx.db.matchBybitReport.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        ctx.db.matchBybitReport.count({ where }),
      ]);

      /* ── 3.  Для каждой строки считаем агрегаты + выводим кабинеты ───────── */
      const processedReports = await Promise.all(
        reports.map(async (report) => {
          /* 3-a) Кабинеты (как раньше) */
          let parsedCabinetConfigs: any[] = [];
          let idexCabinets: any[] = [];
          let bybitCabinetEmails: Array<{ id: number; email: string }> = [];

          if (typeof report.idexCabinets === "string") {
            try {
              parsedCabinetConfigs = JSON.parse(report.idexCabinets);

              const idexCabinetIds = parsedCabinetConfigs
                .filter((c: any) => c.cabinetType === "idex")
                .map((c: any) => c.cabinetId);

              const bybitCabinetIds = parsedCabinetConfigs
                .filter((c: any) => c.cabinetType === "bybit" || !c.cabinetType)
                .map((c: any) => c.cabinetId);

              if (idexCabinetIds.length) {
                idexCabinets = await ctx.db.idexCabinet.findMany({
                  where: { id: { in: idexCabinetIds } },
                });
              }

              if (bybitCabinetIds.length) {
                const bbCabs = await ctx.db.bybitCabinet.findMany({
                  where: { id: { in: bybitCabinetIds } },
                  select: { id: true, bybitEmail: true },
                });
                bybitCabinetEmails = bbCabs.map((c) => ({
                  id: c.id,
                  email: c.bybitEmail,
                }));
              }
            } catch (e) {
              console.error("bad cabinet json", e);
            }
          }

          /* 3-b) Аггрегация по матчам для отчёта  */
          const [{ _sum, _count }, profitableCount] = await Promise.all([
            ctx.db.bybitClipMatch.aggregate({
              where: { matchBybitReportId: report.id },
              _sum: {
                grossExpense: true,
                grossIncome: true,
                grossProfit: true,
              },
              _count: { _all: true },
            }),
            ctx.db.bybitClipMatch.count({
              where: {
                matchBybitReportId: report.id,
                grossProfit: { gt: 0 },
              },
            }),
          ]);

          const totalMatches = _count._all;
          const totalExpense = _sum.grossExpense ?? 0;
          const totalIncome = _sum.grossIncome ?? 0;
          const totalProfit = _sum.grossProfit ?? 0;
          const averageExpense = totalMatches ? totalExpense / totalMatches : 0;
          const averageProfit = totalMatches ? totalProfit / totalMatches : 0;
          const successRate = totalMatches
            ? (profitableCount / totalMatches) * 100
            : 0;
          const totalProfitPerc = totalExpense
            ? (totalProfit / totalExpense) * 100
            : 0;

          /* 3-c) Финальный объект, поля совпадают с другими эндпоинтами */
          return {
            ...report,

            parsedCabinetConfigs,
            idexCabinets,
            bybitCabinetEmails,

            totalMatches,
            totalExpense,
            totalIncome,
            totalProfit,
            averageExpense,
            averageProfit,
            successRate,
            totalProfitPercentage: totalProfitPerc,
          };
        }),
      );

      /* ── 4.  Итог ответа ─────────────────────────────────────────────────── */
      return {
        reports: processedReports,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
      };
    }),
  // ─────────────────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────────
  //  getMatchBybitReportById   (полностью заменить блок)
  // ─────────────────────────────────────────────────────────────────────────────
  getMatchBybitReportById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        /* ── 1.  Сам отчёт + ВСЕ матч-ы (нужны для диапазонов и id-шников) ─── */
        const report = await ctx.db.matchBybitReport.findUnique({
          where: { id: input.id },
          include: {
            bybitClipMatches: {
              include: {
                idexTransaction: { include: { cabinet: true } },
                bybitTransaction: true,
              },
            },
            User: true,
          },
        });
        if (!report) throw new Error("Отчёт не найден");

        const matches = report.bybitClipMatches ?? [];

        /* ── 2.  Кабинеты из конфигурации ──────────────────────────────────── */
        const { idex: idexWins, bybit: bybitWins } = parseWindows(
          report.idexCabinets as string,
        );
        const idexWhere = buildIdexWhere(idexWins);
        const bybitWhere = buildBybitWhere(bybitWins);

        let parsedCabinetConfigs: any[] | null = null;
        if (typeof report.idexCabinets === "string") {
          try {
            parsedCabinetConfigs = JSON.parse(report.idexCabinets);
          } catch (e) {
            console.error("bad idexCabinets json", e);
          }
        }

        /* ── 3.  Агрегируем суммы/кол-ва прямо в БД ────────────────────────── */
        const [{ _sum, _count }, profitableCount] = await Promise.all([
          ctx.db.bybitClipMatch.aggregate({
            where: { matchBybitReportId: input.id },
            _sum: {
              grossExpense: true,
              grossIncome: true,
              grossProfit: true,
            },
            _count: { _all: true },
          }),
          ctx.db.bybitClipMatch.count({
            where: {
              matchBybitReportId: input.id,
              grossProfit: { gt: 0 },
            },
          }),
        ]);

        const totalMatches = _count._all;
        const totalExpense = _sum.grossExpense ?? 0;
        const totalIncome = _sum.grossIncome ?? 0;
        const totalProfit = _sum.grossProfit ?? 0;
        const averageExpense = totalMatches ? totalExpense / totalMatches : 0;
        const averageProfit = totalMatches ? totalProfit / totalMatches : 0;
        const averageIncome = totalMatches ? totalIncome / totalMatches : 0;
        const totalProfitPerc = totalExpense
          ? (totalProfit / totalExpense) * 100
          : 0;
        const successRate = totalMatches
          ? (profitableCount / totalMatches) * 100
          : 0;

        /* ── 4.  Считаем matched / unmatched / in-range ────────────────────── */
        const matchedIdexIds = matches
          .map((m) => m.idexTransactionId)
          .filter(Boolean) as number[];
        const matchedBybitIds = matches
          .map((m) => m.bybitTransactionId)
          .filter(Boolean) as number[];

        const [
          totalIdexTransactions,
          totalBybitTransactions,
          matchedIdexInRange,
          matchedBybitInRange,
          matchesWithinRange,
        ] = await Promise.all([
          ctx.db.idexTransaction.count({ where: idexWhere }),
          ctx.db.bybitTransactionFromCabinet.count({ where: bybitWhere }),
          ctx.db.idexTransaction.count({
            where: {
              ...idexWhere,
              id: { in: matchedIdexIds },
            },
          }),
          ctx.db.bybitTransactionFromCabinet.count({
            where: {
              ...bybitWhere,
              id: { in: matchedBybitIds },
            },
          }),
          ctx.db.bybitClipMatch.count({
            where: {
              matchBybitReportId: input.id,
              idexTransaction: idexWhere,
              bybitTransaction: bybitWhere,
            },
          }),
        ]);

        const unmatchedIdex = totalIdexTransactions - matchedIdexInRange;
        const unmatchedBybit = totalBybitTransactions - matchedBybitInRange;

        /* ── 5.  Несуществующие id-шники (диагностика) ─────────────────────── */
        const [nonExistentIdex, nonExistentBybit] = await Promise.all([
          Promise.all(
            matchedIdexIds.map(async (id) => {
              const ok = await ctx.db.idexTransaction.findUnique({
                where: { id },
                select: { id: true },
              });
              return ok ? null : id;
            }),
          ).then((arr) => arr.filter(Boolean)),
          Promise.all(
            matchedBybitIds.map(async (id) => {
              const ok = await ctx.db.bybitTransactionFromCabinet.findUnique({
                where: { id },
                select: { id: true },
              });
              return ok ? null : id;
            }),
          ).then((arr) => arr.filter(Boolean)),
        ]);

        /* ── 6.  Возвращаем отчёт + свежие метрики ─────────────────────────── */
        return {
          ...report,
          cabinetConfigs: parsedCabinetConfigs,

          // метрики из данных
          totalExpense,
          totalIncome,
          totalProfit,
          averageExpense,
          averageIncome,
          averageProfit,
          totalProfitPercentage: totalProfitPerc,
          successRate,

          // транзакционные счётчики
          totalIdexTransactions,
          totalBybitTransactions,
          matchedIdexCount: matchedIdexInRange,
          matchedBybitCount: matchedBybitInRange,
          unmatchedIdexTransactions: unmatchedIdex,
          unmatchedBybitTransactions: unmatchedBybit,

          // другие показатели
          totalMatches,
          matchesWithinRange,

          // диагностика
          dataIssues: {
            nonExistentIdexCount: nonExistentIdex.length,
            nonExistentBybitCount: nonExistentBybit.length,
            hasIdexBybitCountMismatch:
              matchedIdexIds.length !== matchedBybitIds.length,
            hasMatchesCountMismatch:
              matchedIdexIds.length !== totalMatches ||
              matchedBybitIds.length !== totalMatches,
          },
        };
      } catch (err) {
        console.error("getMatchBybitReportById failed:", err);
        throw err;
      }
    }),
  // ─────────────────────────────────────────────────────────────────────────────

  getReportsSummary: publicProcedure
    .input(
      z.object({
        reportIds: z.array(z.number().int().positive()).nonempty(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { reportIds } = input;

      /* ------------------------------------------------------------------
       * 1. Fetch *all* clip‑matches belonging to the selected reports.
       * ------------------------------------------------------------------ */
      const matches = await ctx.db.bybitClipMatch.findMany({
        where: { matchBybitReportId: { in: reportIds } },
        select: {
          grossExpense: true,
          grossIncome: true,
          grossProfit: true,
          idexTransactionId: true,
          bybitTransactionId: true,
          matchBybitReportId: true,
        },
      });

      const totalMatches = matches.length;
      const totalExpense = matches.reduce(
        (s, m) => s + (m.grossExpense ?? 0),
        0,
      );
      const totalIncome = matches.reduce((s, m) => s + (m.grossIncome ?? 0), 0);
      const totalProfit = matches.reduce((s, m) => s + (m.grossProfit ?? 0), 0);
      const profitPercentage = totalExpense
        ? (totalProfit / totalExpense) * 100
        : 0;

      const matchedIdexIds = new Set(matches.map((m) => m.idexTransactionId));
      const matchedBybitIds = new Set(matches.map((m) => m.bybitTransactionId));

      /* ------------------------------------------------------------------
       * 2. Compute *unmatched* transactions for each report in parallel.
       *    We reuse (a simplified version of) the logic you already had in
       *    getMatchBybitReportById.
       * ------------------------------------------------------------------ */
      let unmatchedIdexTransactions = 0;
      let unmatchedBybitTransactions = 0;

      await Promise.all(
        reportIds.map(async (reportId) => {
          const report = await ctx.db.matchBybitReport.findUnique({
            where: { id: reportId },
            select: {
              timeRangeStart: true,
              timeRangeEnd: true,
              idexCabinets: true,
            },
          });
          if (!report) return;

          // Parse cabinet config → idex / bybit cabinet IDs
          const wins = parseWindows(report.idexCabinets as string);

          // Count total IDEX transactions in the report window
          const totalIdex = await ctx.db.idexTransaction.count({
            where: buildIdexWhere(wins.idex),
          });

          // Count total Bybit transactions
          const totalBybit = await ctx.db.bybitTransactionFromCabinet.count({
            where: buildBybitWhere(wins.bybit),
          });
        }),
      );

      return {
        totalMatches,
        totalExpense,
        totalIncome,
        totalProfit,
        profitPercentage,
        matchedIdexCount: matchedIdexIds.size,
        matchedBybitCount: matchedBybitIds.size,
        unmatchedIdexTransactions,
        unmatchedBybitTransactions,
      };
    }),

  updateMatchBybitReport: publicProcedure
    .input(MatchBybitReportInput.required({ id: true }))
    .mutation(async ({ ctx, input }) => {
      const { id, timeRangeStart, timeRangeEnd, cabinetConfigs, ...data } =
        input;
      return ctx.db.matchBybitReport.update({
        where: { id },
        data: {
          ...data,
          timeRangeStart: dayjs(timeRangeStart).utc().toDate(),
          timeRangeEnd: dayjs(timeRangeEnd).utc().toDate(),
          idexCabinets: cabinetConfigs
            ? JSON.stringify(cabinetConfigs)
            : undefined,
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
    .input(
      z.object({
        reportId: z.number().int().positive(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(10).default(10),
        search: z.string().optional(),
        sortColumn: z.string().optional(),
        sortDirection: z.enum(["asc", "desc"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { reportId, page, limit, search } = input;
      const skip = (page - 1) * limit;

      /** 1. Берём отчёт */
      const report = await ctx.db.matchBybitReport.findUnique({
        where: { id: reportId },
        select: {
          timeRangeStart: true,
          timeRangeEnd: true,
          idexCabinets: true,
        },
      });

      if (!report) throw new Error(`Отчёт #${reportId} не найден`);

      /** 2. Парсим idexCabinets */
      const { idex: idexWins } = parseWindows(report.idexCabinets as string);
      const idexWhere = buildIdexWhere(idexWins);

      /** 3. Все сопоставленные в этом отчёте */
      const matchedRows = await ctx.db.bybitClipMatch.findMany({
        where: { matchBybitReportId: reportId },
        select: { idexTransactionId: true },
      });
      const matchedIdexIds = matchedRows.map((m) => m.idexTransactionId);

      /** 4. К-во всех IDEX транзакций в диапазоне */
      const totalIdexTransactions = await ctx.db.idexTransaction.count({
        where: idexWhere,
      });

      /** 5. where для НЕсопоставлённых (в таблицах) */
      const where: Prisma.IdexTransactionWhereInput = {
        ...idexWhere,
        id: matchedIdexIds.length ? { notIn: matchedIdexIds } : undefined,
      };

      /** 6. Поиск */
      if (search?.trim()) {
        const term = search.trim();
        const num = Number(term);
        where.OR = [
          !isNaN(num) ? { id: num } : undefined,
          { wallet: { contains: term } },
          !isNaN(num) ? { status: num } : undefined,
        ].filter(Boolean) as any;
      }

      /** 7. Пагинация + сортировка */
      const totalUnmatched = await ctx.db.idexTransaction.count({ where });

      const transactions = await ctx.db.idexTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { approvedAt: "desc" },
        select: {
          id: true,
          amount: true,
          total: true,
          approvedAt: true,
          cabinetId: true,
          externalId: true,
          status: true,
          wallet: true,
        },
      });

      /** 8. Обогащаем данными кабинета + парсим суммы */
      const detailed = await Promise.all(
        transactions.map(async (tx) => {
          const cabinet = await ctx.db.idexCabinet.findUnique({
            where: { id: tx.cabinetId },
            select: { idexId: true },
          });
          return {
            ...tx,
            parsedAmount: getIdexAmount(tx.amount),
            parsedAmountTotalUsdt: getIdexAmountTotalUsdt(tx.total),
            cabinet,
          };
        }),
      );

      return {
        success: true,
        transactions: detailed,
        totalPages: Math.ceil(totalUnmatched / limit),
        currentPage: page,
        totalIdexTransactions,
        matchedCount: matchedIdexIds.length,
        unmatchedCount: totalIdexTransactions - matchedIdexIds.length,
      };
    }),

  getBybitTransactionsForReport: publicProcedure
    .input(
      z.object({
        reportId: z.number().int().positive(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(10).default(10),
        search: z.string().optional(),
        sortColumn: z.string().optional(),
        sortDirection: z.enum(["asc", "desc"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { reportId, page, limit, search } = input;
      const skip = (page - 1) * limit;

      /** 1. Отчёт */
      const report = await ctx.db.matchBybitReport.findUnique({
        where: { id: reportId },
        select: {
          timeRangeStart: true,
          timeRangeEnd: true,
          idexCabinets: true,
        },
      });
      if (!report) throw new Error(`Отчёт #${reportId} не найден`);

      /** 2. Кабинеты Bybit */
      const { bybit: bybitWins } = parseWindows(report.idexCabinets as string);
      const bybitWhere = buildBybitWhere(bybitWins);

      /** 3. Сопоставленные */
      const matchedRows = await ctx.db.bybitClipMatch.findMany({
        where: { matchBybitReportId: reportId },
        select: { bybitTransactionId: true },
      });
      const matchedBybitIds = matchedRows.map((r) => r.bybitTransactionId);

      /** 4. Общее кол-во транзакций Bybit в диапазоне */
      const totalBybitTransactions =
        await ctx.db.bybitTransactionFromCabinet.count({ where: bybitWhere });

      /** 5. where для не сопоставлённых */
      const where: Prisma.BybitTransactionFromCabinetWhereInput = {
        ...bybitWhere,
        id: matchedBybitIds.length ? { notIn: matchedBybitIds } : undefined,
      };

      /** 6. Поиск */
      if (search?.trim()) {
        const term = search.trim();
        const num = Number(term);
        const numFloat = parseFloat(term);
        where.OR = [
          !isNaN(num) ? { id: num } : undefined,
          { orderNo: { contains: term } },
          { counterparty: { contains: term } },
          !isNaN(numFloat)
            ? {
                totalPrice: { gte: numFloat - 0.01, lte: numFloat + 0.01 },
              }
            : undefined,
          { asset: { contains: term } },
        ].filter(Boolean) as any;
      }

      /** 7. Пагинация */
      const totalUnmatched = await ctx.db.bybitTransactionFromCabinet.count({
        where,
      });

      const transactions = await ctx.db.bybitTransactionFromCabinet.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dateTime: "desc" },
        include: {
          cabinet: {
            select: { bybitEmail: true },
          },
        },
      });

      const detailed = transactions.map((t) => ({
        ...t,
        email: t.cabinet?.bybitEmail ?? "Unknown",
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

  // --- Методы для работы с сопоставлениями ---

  // Получение списка сопоставленных транзакций для отчета
  // ─────────────────────────────────────────────────────────────────────────────
  //  getMatchedTransactionsForReport   (полная замена)
  // ─────────────────────────────────────────────────────────────────────────────
  getMatchedTransactionsForReport: publicProcedure
    .input(
      z.object({
        reportId: z.number(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(1000).default(20),
        sortColumn: z.string().optional(), // колонка сортировки
        sortDirection: z.enum(["asc", "desc"]).optional(), // направление
      }),
    )
    .query(async ({ ctx, input }) => {
      const { reportId, page, limit, sortColumn, sortDirection } = input;
      const skip = (page - 1) * limit;

      /* ── 1.  where для ВСЕХ запросов (count / aggregate / findMany) ───────── */
      const matchWhere: Prisma.BybitClipMatchWhereInput = {
        matchBybitReportId: reportId,
      };

      /* ── 2.  Сколько всего сопоставлений (для пагинации) ─────────────────── */
      const totalCount = await ctx.db.bybitClipMatch.count({
        where: matchWhere,
      });

      /* ── 3.  Агрегируем валовые суммы сразу в БД  ─────────────────────────── */
      const agg = await ctx.db.bybitClipMatch.aggregate({
        where: matchWhere,
        _sum: {
          grossExpense: true,
          grossIncome: true,
          grossProfit: true,
        },
      });

      const totalExpense = agg._sum.grossExpense ?? 0;
      const totalIncome = agg._sum.grossIncome ?? 0;
      const totalProfit = agg._sum.grossProfit ?? 0;
      const averageExpense = totalCount ? totalExpense / totalCount : 0;
      const averageProfit = totalCount ? totalProfit / totalCount : 0;
      const totalProfitPercentage = totalExpense
        ? (totalProfit / totalExpense) * 100
        : 0;

      /* ── 4.  Сортировка (как и раньше) ────────────────────────────────────── */
      let orderBy: Prisma.BybitClipMatchOrderByWithRelationInput = {
        createdAt: "desc",
      };
      if (sortColumn) {
        const dir = sortDirection ?? "asc";
        orderBy =
          sortColumn === "id"
            ? { id: dir }
            : sortColumn === "bybitDateTime"
              ? { bybitTransaction: { dateTime: dir } }
              : sortColumn === "idexDateTime"
                ? { idexTransaction: { approvedAt: dir } }
                : sortColumn === "bybitAmount"
                  ? { bybitTransaction: { totalPrice: dir } }
                  : sortColumn === "idexCabinet"
                    ? { idexTransaction: { cabinet: { idexId: dir } } }
                    : sortColumn === "grossExpense"
                      ? { grossExpense: dir }
                      : sortColumn === "grossIncome"
                        ? { grossIncome: dir }
                        : sortColumn === "grossProfit"
                          ? { grossProfit: dir }
                          : sortColumn === "profitPercentage"
                            ? { profitPercentage: dir }
                            : { createdAt: "desc" };
      }

      /* ── 5.  Пагинированный список сопоставлений ─────────────────────────── */
      const matches = await ctx.db.bybitClipMatch.findMany({
        where: matchWhere,
        include: {
          bybitTransaction: {
            include: { cabinet: { select: { bybitEmail: true } } },
          },
          idexTransaction: {
            include: { cabinet: true },
          },
        },
        orderBy,
        skip,
        take: limit,
      });

      /* ── 6.  Возвращаем, НИЧЕГО не ломая в API ────────────────────────────── */
      return {
        success: true,
        matches,

        // пагинация
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,

        // добавленные агрегированные показатели
        totalExpense, // валовый расход
        totalIncome, // валовый доход
        totalProfit, // валовая прибыль
        totalProfitPercentage, // % прибыли
        averageExpense, // средний расход
        averageProfit, // средний спред / прибыль
      };
    }),
  // ─────────────────────────────────────────────────────────────────────────────

  // Удаление сопоставления
  unmatchTransaction: publicProcedure
    .input(
      z.object({
        matchId: z.number(),
        reportId: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { matchId, reportId } = input;

      try {
        // Получаем информацию о сопоставлении перед удалением
        const match = await ctx.db.bybitClipMatch.findUnique({
          where: { id: matchId },
        });

        if (!match) {
          throw new Error(`Сопоставление с ID ${matchId} не найдено`);
        }

        // Удаляем сопоставление
        await ctx.db.bybitClipMatch.delete({
          where: { id: matchId },
        });

        // Обновляем статистику отчета
        const reportMatches = await ctx.db.bybitClipMatch.findMany({
          where: { matchBybitReportId: reportId },
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
        const successRate =
          totalMatches > 0 ? profitableMatches / totalMatches : 0;

        // Обновляем отчет
        await ctx.db.matchBybitReport.update({
          where: { id: reportId },
          data: {
            totalMatches,
            totalProfit,
            averageProfit,
            successRate,
          },
        });

        return { success: true };
      } catch (error) {
        console.error("Ошибка при удалении сопоставления:", error);
        throw new Error(
          `Ошибка при удалении сопоставления: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`,
        );
      }
    }),

  // Автоматическое сопоставление транзакций для отчета
  // Автоматическое сопоставление транзакций для отчета
  matchTransactionsAutomatically: publicProcedure
    .input(
      z.object({
        reportId: z.number().int().positive(),
        userId: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { reportId, userId } = input;

        // Получаем данные отчета
        const report = await ctx.db.matchBybitReport.findUnique({
          where: { id: reportId },
        });

        if (!report) {
          return {
            success: false,
            message: "Отчет не найден",
            stats: null,
          };
        }

        // Парсим конфигурацию кабинетов из отчета
        let cabinetConfigs = [];
        if (report.idexCabinets) {
          try {
            cabinetConfigs = JSON.parse(report.idexCabinets as string);
          } catch (error) {
            console.error("Ошибка при парсинге конфигурации кабинетов:", error);
            return {
              success: false,
              message: "Ошибка при парсинге конфигурации кабинетов",
              stats: null,
            };
          }
        }

        console.log(
          `Начинаем автоматическое сопоставление для отчета #${reportId}`,
        );
        console.log(
          `Период: с ${report.timeRangeStart} по ${report.timeRangeEnd} ISO format: ${dayjs(report.timeRangeStart).toISOString()} - ${dayjs(report.timeRangeEnd).toISOString()}`,
        );
        console.log(`Конфигурации кабинетов: ${cabinetConfigs.length}`);

        // Получаем списки кабинетов по типам
        const { idex: idexWins, bybit: bybitWins } = parseWindows(
          report.idexCabinets as string,
        );

        if (idexWins.length === 0 || bybitWins.length === 0) {
          return {
            success: false,
            message: "Не указаны кабинеты обоих типов для сопоставления",
            stats: null,
          };
        }

        // Получаем IDEX транзакции, которые еще не сопоставлены в этом отчете
        const idexTransactions = await ctx.db.idexTransaction.findMany({
          where: {
            ...buildIdexWhere(idexWins),
            // Не должны уже иметь сопоставление в этом отчете
            NOT: {
              BybitClipMatch: {
                some: {
                  matchBybitReportId: reportId,
                },
              },
            },
          },
        });

        // Получаем Bybit транзакции, которые еще не сопоставлены в этом отчете
        const bybitTransactions =
          await ctx.db.bybitTransactionFromCabinet.findMany({
            where: {
              ...buildBybitWhere(bybitWins),
              // Не должны уже иметь сопоставление в этом отчете
              NOT: {
                BybitClipMatch: {
                  some: {
                    matchBybitReportId: reportId,
                  },
                },
              },
            },
          });

        console.log(
          `Найдено ${idexTransactions.length} IDEX транзакций и ${bybitTransactions.length} Bybit транзакций для сопоставления`,
        );
        console.log(JSON.stringify(bybitTransactions, null, 2));

        // Массив для новых сопоставлений
        const newMatchesData = [];

        // Создаем множества для отслеживания уже использованных транзакций
        const usedIdexTxIds = new Set();
        const usedBybitTxIds = new Set();

        // Получаем список всех уже сопоставленных транзакций в этом отчете
        const existingMatches = await ctx.db.bybitClipMatch.findMany({
          where: {
            matchBybitReportId: reportId,
          },
          select: {
            idexTransactionId: true,
            bybitTransactionId: true,
          },
        });

        // Добавляем их в множества использованных
        existingMatches.forEach((match) => {
          if (match.idexTransactionId)
            usedIdexTxIds.add(match.idexTransactionId);
          if (match.bybitTransactionId)
            usedBybitTxIds.add(match.bybitTransactionId);
        });

        // Перебираем все IDEX транзакции для сопоставления
        for (const idexTx of idexTransactions) {
          if (!idexTx.approvedAt || usedIdexTxIds.has(idexTx.id)) continue;

          // Получаем сумму из IDEX транзакции
          const idexAmount = getIdexAmount(idexTx.amount);
          const idexAmountTotalUsdt = getIdexAmountTotalUsdt(idexTx.total);
          if (idexAmount <= 0) continue;

          // Проверяем возможные совпадения с Bybit транзакциями
          let bestMatch = { bybitTx: null, timeDiff: Infinity };

          for (const bybitTx of bybitTransactions) {
            if (!bybitTx.dateTime || usedBybitTxIds.has(bybitTx.id)) continue;

            // Добавляем 3 часа к времени Bybit транзакции
            const bybitDateTime = dayjs(bybitTx.dateTime)
              .add(3, "hour")
              .toISOString(); //! TODO:DELETE 3 hourse /// !!DELETED

            // Проверяем, совпадает ли сумма транзакции (с небольшой погрешностью)
            if (Math.abs(bybitTx.totalPrice - idexAmount) > AMOUNT_THRESHOLD)
              continue;

            // Проверяем временную разницу между транзакциями
            const timeDiff = getTimeDifferenceInMinutes(
              idexTx.approvedAt,
              bybitDateTime,
            );

            // Если разница в пределах порога и лучше предыдущего совпадения
            if (
              timeDiff <= MINUTES_THRESHOLD &&
              timeDiff < bestMatch.timeDiff
            ) {
              bestMatch = { bybitTx, timeDiff };
            }
            // console.log(`\n--------------------------\nСопоставление для транзакции ${idexTx.id} (BB: ${bybitTx.orderNo}): ${bestMatch.bybitTx ? 'Найдено' : 'Нет'}\n---------------------\nIDEX TIME: ${idexTx.approvedAt}\nBYBIT TIME: ${bybitDateTime}\n-------------------------------\nIDEX AMOUNT: ${idexAmount}\nBYBIT AMOUNT: ${bybitTx.totalPrice}\n-------------------------------\n`);
          }

          if (bestMatch.bybitTx) {
            console.log(
              `✔ match IDEX#${idexTx.id} ⇄ BYBIT#${bestMatch.bybitTx.orderNo}  Δ=${bestMatch.timeDiff} мин`,
            );
          }

          // Если нашли подходящее совпадение, создаем запись
          if (bestMatch.bybitTx) {
            const bybitMatchTx = bestMatch.bybitTx;
            const idexTxWithAmount = {
              ...idexTx,
              parsedAmount: idexAmountTotalUsdt,
            };
            const metrics = calculateClipMatchMetrics(
              bybitMatchTx,
              idexTxWithAmount,
            );

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

        console.log(
          `Найдено ${newMatchesData.length} сопоставлений для добавления в отчет`,
        );

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
              where: { matchBybitReportId: reportId },
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
              },
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
              },
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
          },
        };
      } catch (error) {
        console.error(
          "Ошибка при автоматическом сопоставлении транзакций:",
          error,
        );
        return {
          success: false,
          message: `Ошибка при автоматическом сопоставлении: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`,
          stats: null,
        };
      }
    }),

  // Ручное сопоставление транзакций

  // ─────────────────────────────────────────────────────────────────────────────
  //  matchTransactionManually  (замените весь блок на этот)
  // ─────────────────────────────────────────────────────────────────────────────
  matchTransactionManually: publicProcedure
    .input(
      z.object({
        reportId: z.number(),
        idexTransactionId: z.number(),
        bybitTransactionId: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { reportId, idexTransactionId, bybitTransactionId } = input;

      /* ── 1. Проверяем сущности и двойные матчи ────────────────────────────── */
      const [idexTx, bybitTx, duplicate] = await Promise.all([
        ctx.db.idexTransaction.findUnique({ where: { id: idexTransactionId } }),
        ctx.db.bybitTransactionFromCabinet.findUnique({
          where: { id: bybitTransactionId },
        }),
        ctx.db.bybitClipMatch.findFirst({
          where: {
            matchBybitReportId: reportId,
            OR: [{ idexTransactionId }, { bybitTransactionId }],
          },
        }),
      ]);

      if (!idexTx)
        throw new Error(`IDEX транзакция #${idexTransactionId} не найдена`);
      if (!bybitTx)
        throw new Error(`Bybit транзакция #${bybitTransactionId} не найдена`);
      if (duplicate)
        throw new Error("Одна из транзакций уже сопоставлена в этом отчёте");

      /* ── 2. Получаем userId отчёта (для связи) ────────────────────────────── */
      const { userId } = await ctx.db.matchBybitReport.findUniqueOrThrow({
        where: { id: reportId },
        select: { userId: true },
      });

      /* ── 3. Считаем разницу времени (сек) ─────────────────────────────────── */
      // approvedAt хранится строкой ISO; приводим к Date
      if (!idexTx.approvedAt) throw new Error("IDEX транзакция без approvedAt");
      const idexTime = dayjs(idexTx.approvedAt).toDate();
      const bybitTime = dayjs(bybitTx.dateTime).add(3, "hour").toDate(); // +3 ч

      const timeDifference = Math.round(
        getTimeDifferenceInMinutes(idexTime, bybitTime) * 60,
      );

      /* ── 4. Считаем метрики (числа, а не NaN) ─────────────────────────────── */
      const toNumber = (v: unknown) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      };

      const grossExpense = toNumber(bybitTx.amount); // расход BYBIT
      const grossIncome = toNumber(getIdexAmountTotalUsdt(idexTx.total)); // доход IDEX
      const grossProfit = grossIncome - grossExpense;
      const profitPercentage = grossExpense
        ? (grossProfit / grossExpense) * 100
        : 0;

      /* ── 5. Пишем матч ────────────────────────────────────────────────────── */
      const newMatch = await ctx.db.bybitClipMatch.create({
        data: {
          timeDifference,
          grossExpense,
          grossIncome,
          grossProfit,
          profitPercentage,

          /* ← исправлено: заглавная М */
          MatchBybitReport: { connect: { id: reportId } },

          bybitTransaction: { connect: { id: bybitTransactionId } },
          idexTransaction: { connect: { id: idexTransactionId } },
          user: { connect: { id: userId } },
        },
      });

      return { success: true, matchId: newMatch.id };
    }),
  // ─────────────────────────────────────────────────────────────────────────────
});

export type BBRouter = typeof bbRouter; // Export type for frontend
