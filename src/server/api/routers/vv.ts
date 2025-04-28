/*  =============================================================================
    vvRouter.ts – TRPC-роутер “Match-Vires”            (fixed 2025-04-28)
    -----------------------------------------------------------------------------
      • использует BybitOrderInfo
      • все суммы и спред — в USDT
      • при create / update записываем ТОЛЬКО существующие
        в модели MatchViresReport поля:  
          totalMatches, totalProfit, averageProfit, successRate
      • никаких totalExpense / totalIncome / totalProfitPercentage
        в записях БД (они рассчитываются и возвращаются в ответе, но
        не сохраняются — таких колонок нет в схеме)
    ========================================================================== */

    import { z } from 'zod';
    import { createTRPCRouter, publicProcedure } from '@/server/api/trpc';
    import { Prisma } from '@prisma/client';
    import dayjs from 'dayjs';
    import utc from 'dayjs/plugin/utc';
    
    dayjs.extend(utc);
    
    /* ───────── helpers ───────── */
    
    const MIN_WIN = 30; // ±30 минут для совпадения
    
    const diffMin = (a: Date, b: Date) =>
      Math.abs(dayjs(a).diff(dayjs(b), 'minute'));
    
    const normPhone = (raw?: string | null) => {
      if (!raw) return undefined;
      let d = raw.replace(/\D/g, '');
      if (d.length === 10) d = '7' + d;
      if (d.length === 11 && d.startsWith('8')) d = '7' + d.slice(1);
      return d.length === 11 ? d : undefined;
    };
    
    function metrics(bybit: { amount: number }, vires: { sum_usdt: number }) {
      const grossExpense = Math.abs(vires.sum_usdt);
      const grossIncome  = Math.abs(bybit.amount);
      const grossProfit  = grossIncome - grossExpense;
      const profitPct    = grossExpense ? (grossProfit / grossExpense) * 100 : 0;
      return { grossExpense, grossIncome, grossProfit, profitPercentage: profitPct };
    }
    
    function calcBasic(matches: { grossProfit: number }[]) {
      const totalMatches  = matches.length;
      const totalProfit   = matches.reduce((s, m) => s + m.grossProfit, 0);
      const averageProfit = totalMatches ? totalProfit / totalMatches : 0;
      const successRate   = totalMatches
        ? (matches.filter((m) => m.grossProfit > 0).length / totalMatches) * 100
        : 0;
      return { totalMatches, totalProfit, averageProfit, successRate };
    }
    
    /* ───────── input schemas ───────── */
    
    const flexDate = z.union([
      z.string().refine((d) => dayjs(d).isValid()),
      z.date(),
      z.object({ date: z.date() }).transform((v) => v.date),
    ]);
    
    const MatchViresReportInput = z.object({
      id             : z.number().optional(),
      name           : z.string().min(1),
      reportDate     : flexDate,
      timeRangeStart : flexDate,
      timeRangeEnd   : flexDate,
      notes          : z.string().optional(),
      userId         : z.number().positive().default(1),
      cabinetConfigs : z
        .array(
          z.object({
            cabinetId  : z.number().positive(),
            startDate  : flexDate,
            endDate    : flexDate,
            cabinetType: z.enum(['bybit', 'vires']).optional(),
          }),
        )
        .optional(),
    });
    
    /* ───────── router ───────── */
    
    export const vvRouter = createTRPCRouter({
      /* ── create ── */
      createMatchViresReport: publicProcedure
        .input(MatchViresReportInput.omit({ id: true }))
        .mutation(async ({ ctx, input }) => {
          const cfgJSON =
            input.cabinetConfigs?.length
              ? JSON.stringify(input.cabinetConfigs)
              : undefined;
    
          return ctx.db.matchViresReport.create({
            data: {
              timeRangeStart: dayjs(input.timeRangeStart).utc().toDate(),
              timeRangeEnd  : dayjs(input.timeRangeEnd  ).utc().toDate(),
              reportDate    : dayjs(input.reportDate   ).utc().toDate(),
              notes         : input.notes || input.name,
              userId        : input.userId,
              idexCabinets  : cfgJSON,
              /* обязательные в модели поля */
              totalMatches  : 0,
              totalProfit   : 0,
              averageProfit : 0,
              successRate   : 0,
            },
          });
        }),
    
      /* ── list ── */
      getMatchViresReports: publicProcedure
        .input(
          z.object({
            page : z.number().min(1).default(1),
            limit: z.number().min(1).max(100).default(10),
          }),
        )
        .query(async ({ ctx, input }) => {
          const skip = (input.page - 1) * input.limit;
          const [items, total] = await Promise.all([
            ctx.db.matchViresReport.findMany({
              skip,
              take: input.limit,
              orderBy: { createdAt: 'desc' },
              include: { User: true },
            }),
            ctx.db.matchViresReport.count(),
          ]);
          return {
            reports     : items,
            totalCount  : total,
            totalPages  : Math.ceil(total / input.limit),
            currentPage : input.page,
          };
        }),
    
      /* ── report by id ── */
      getMatchViresReportById: publicProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ ctx, input }) => {
          const rep = await ctx.db.matchViresReport.findUnique({
            where: { id: input.id },
            include: {
              viresClipMatches: {
                include: {
                  viresTransaction: true,
                  bybitTransaction: true,
                },
              },
            },
          });
          if (!rep) throw new Error('Отчёт не найден');
    
          /* конфиги */
          let cfg: any[] = [];
          try {
            cfg = rep.idexCabinets ? JSON.parse(rep.idexCabinets as string) : [];
          } catch {}
    
          const bybitIds = cfg
            .filter((c) => c.cabinetType === 'bybit')
            .map((c) => c.cabinetId);
          const viresIds = cfg
            .filter((c) => c.cabinetType === 'vires' || !c.cabinetType)
            .map((c) => c.cabinetId);
    
          /* счётчики транзакций */
          const totalVires = viresIds.length
            ? await ctx.db.viresTransactionPayin.count({
                where: {
                  cabinetId: { in: viresIds },
                  createdAt: { gte: rep.timeRangeStart, lte: rep.timeRangeEnd },
                },
              })
            : 0;
    
          const totalBybit = bybitIds.length
            ? await ctx.db.bybitOrderInfo.count({
                where: {
                  bybitCabinetId: { in: bybitIds },
                  dateTime: {
                    gte: dayjs(rep.timeRangeStart).subtract(3, 'hour').toDate(),
                    lte: dayjs(rep.timeRangeEnd  ).subtract(3, 'hour').toDate(),
                  },
                },
              })
            : 0;
    
          const matchedVires = new Set(
            rep.viresClipMatches.map((m) => m.viresTransactionId),
          ).size;
          const matchedBybit = new Set(
            rep.viresClipMatches.map((m) => m.bybitOrderInfoId),
          ).size;
    
          /* расчёт stats (только возвращаем) */
          const stat = calcBasic(rep.viresClipMatches);
    
          return {
            ...rep,
            parsedCabinetConfigs       : cfg,
            ...stat,
            totalViresTransactions     : totalVires,
            totalBybitTransactions     : totalBybit,
            matchedViresCount          : matchedVires,
            matchedBybitCount          : matchedBybit,
            unmatchedViresTransactions : totalVires - matchedVires,
            unmatchedBybitTransactions : totalBybit - matchedBybit,
          };
        }),
    
      /* ── update meta (без stats) ── */
      updateMatchViresReport: publicProcedure
        .input(MatchViresReportInput.required({ id: true }))
        .mutation(async ({ ctx, input }) => {
          const cfgJSON = input.cabinetConfigs
            ? JSON.stringify(input.cabinetConfigs)
            : undefined;
    
          return ctx.db.matchViresReport.update({
            where: { id: input.id },
            data : {
              notes         : input.notes || input.name,
              reportDate    : dayjs(input.reportDate   ).utc().toDate(),
              timeRangeStart: dayjs(input.timeRangeStart).utc().toDate(),
              timeRangeEnd  : dayjs(input.timeRangeEnd  ).utc().toDate(),
              idexCabinets  : cfgJSON,
            },
          });
        }),
    
      /* ── delete ── */
      deleteMatchViresReport: publicProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
          await ctx.db.viresClipMatch.deleteMany({
            where: { matchViresReportId: input.id },
          });
          await ctx.db.matchViresReport.delete({ where: { id: input.id } });
          return { success: true };
        }),
    
      /* ── Bybit list (not matched) ── */
      getBybitTransactionsForReport: publicProcedure
        .input(
          z.object({
            reportId     : z.number().positive(),
            page         : z.number().min(1).default(1),
            limit        : z.number().min(1).max(50).default(10),
            search       : z.string().optional(),
          }),
        )
        .query(async ({ ctx, input }) => {
          const rep = await ctx.db.matchViresReport.findUnique({
            where : { id: input.reportId },
            select: { timeRangeStart: true, timeRangeEnd: true, idexCabinets: true },
          });
          if (!rep) throw new Error('Отчёт не найден');
    
          let bybitIds: number[] = [];
          try {
            bybitIds = rep.idexCabinets
              ? JSON.parse(rep.idexCabinets)
                  .filter((c: any) => c.cabinetType === 'bybit')
                  .map((c: any) => c.cabinetId)
              : [];
          } catch {}
    
          if (bybitIds.length === 0)
            return {
              transactions : [],
              totalCount   : 0,
              totalPages   : 0,
              currentPage  : 1,
              matchedCount : 0,
              unmatchedCount: 0,
            };
    
          const matched = await ctx.db.viresClipMatch.findMany({
            where : { matchViresReportId: input.reportId },
            select: { bybitOrderInfoId: true },
          });
          const matchedIds = matched.map((m) => m.bybitOrderInfoId);
    
          const where: Prisma.BybitOrderInfoWhereInput = {
            id            : matchedIds.length ? { notIn: matchedIds } : undefined,
            bybitCabinetId: { in: bybitIds },
            dateTime      : {
              gte: dayjs(rep.timeRangeStart).subtract(3, 'hour').toDate(),
              lte: dayjs(rep.timeRangeEnd  ).subtract(3, 'hour').toDate(),
            },
          };
    
          if (input.search?.trim()) {
            const q = input.search.trim();
            where.OR = [
              { orderNo: { contains: q } },
              { phoneNumbers: { has: q } },
            ];
          }
    
          const total = await ctx.db.bybitOrderInfo.count({ where });
          const skip  = (input.page - 1) * input.limit;
    
          const rows = await ctx.db.bybitOrderInfo.findMany({
            where,
            skip,
            take: input.limit,
            orderBy: { dateTime: 'desc' },
            include: { BybitCabinet: { select: { bybitEmail: true } } },
          });
    
          return {
            transactions : rows.map((t) => ({
              ...t,
              email: t.BybitCabinet?.bybitEmail || 'Unknown',
              
            })),
            totalCount   : total,
            totalPages   : Math.ceil(total / input.limit),
            currentPage  : input.page,
            matchedCount : matchedIds.length,
            unmatchedCount: total,
          };
        }),
    
      /* ── Vires list (not matched) ── */
      getViresTransactionsForReport: publicProcedure
        .input(
          z.object({
            reportId     : z.number().positive(),
            page         : z.number().min(1).default(1),
            limit        : z.number().min(1).max(50).default(10),
            search       : z.string().optional(),
          }),
        )
        .query(async ({ ctx, input }) => {
          const rep = await ctx.db.matchViresReport.findUnique({
            where : { id: input.reportId },
            select: { timeRangeStart: true, timeRangeEnd: true, idexCabinets: true },
          });
          if (!rep) throw new Error('Отчёт не найден');
    
          let viresIds: number[] = [];
          try {
            viresIds = rep.idexCabinets
              ? JSON.parse(rep.idexCabinets)
                  .filter((c: any) => c.cabinetType === 'vires' || !c.cabinetType)
                  .map((c: any) => c.cabinetId)
              : [];
          } catch {}
    
          if (viresIds.length === 0)
            return {
              transactions : [],
              totalCount   : 0,
              totalPages   : 0,
              currentPage  : 1,
              matchedCount : 0,
              unmatchedCount: 0,
            };
    
          const matched = await ctx.db.viresClipMatch.findMany({
            where : { matchViresReportId: input.reportId },
            select: { viresTransactionId: true },
          });
          const matchedIds = matched.map((m) => m.viresTransactionId);
    
          const where: Prisma.ViresTransactionPayinWhereInput = {
            id        : matchedIds.length ? { notIn: matchedIds } : undefined,
            cabinetId : { in: viresIds },
            createdAt : { gte: rep.timeRangeStart, lte: rep.timeRangeEnd },
          };
    
          if (input.search?.trim()) {
            const q = input.search.trim();
            where.OR = [
              { card: { contains: q } },
              { fio : { contains: q } },
              { bank: { contains: q } },
            ];
          }
    
          const total = await ctx.db.viresTransactionPayin.count({ where });
          const skip  = (input.page - 1) * input.limit;
    
          const rows = await ctx.db.viresTransactionPayin.findMany({
            where,
            skip,
            take: input.limit,
            orderBy: { createdAt: 'desc' },
            include: { cabinet: { select: { name: true, login: true } } },
          });
    
          return {
            transactions : rows.map((t) => ({
              ...t,
              cabinetName: t.cabinet?.name || t.cabinet?.login || `ID ${t.cabinetId}`,
            })),
            totalCount   : total,
            totalPages   : Math.ceil(total / input.limit),
            currentPage  : input.page,
            matchedCount : matchedIds.length,
            unmatchedCount: total,
          };
        }),
    
      /* ── matched list ── */
      getMatchedTransactionsForReport: publicProcedure
        .input(
          z.object({
            reportId     : z.number().positive(),
            page         : z.number().min(1).default(1),
            limit        : z.number().min(1).max(100).default(20),
          }),
        )
        .query(async ({ ctx, input }) => {
          const skip  = (input.page - 1) * input.limit;
          const total = await ctx.db.viresClipMatch.count({
            where: { matchViresReportId: input.reportId },
          });
    
          const rows = await ctx.db.viresClipMatch.findMany({
            where: { matchViresReportId: input.reportId },
            skip,
            take: input.limit,
            orderBy: { createdAt: 'desc' },
            include: {
              bybitTransaction: true,
              viresTransaction: true,
            },
          });
    
          return {
            matches     : rows,
            totalCount  : total,
            totalPages  : Math.ceil(total / input.limit),
            currentPage : input.page,
          };
        }),
    
      /* ── auto-match ── */
      matchTransactionsAutomatically: publicProcedure
        .input(
          z.object({
            reportId: z.number().positive(),
            userId  : z.number().optional(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          const report = await ctx.db.matchViresReport.findUnique({
            where: { id: input.reportId },
          });
          if (!report) return { success: false, message: 'Отчёт не найден', stats: null };
    
          let cfg: any[] = [];
          try { cfg = report.idexCabinets ? JSON.parse(report.idexCabinets as string) : []; } catch {}
    
          const bybitIds = cfg.filter((c) => c.cabinetType === 'bybit').map((c) => c.cabinetId);
          const viresIds = cfg.filter((c) => c.cabinetType === 'vires' || !c.cabinetType).map((c) => c.cabinetId);
    
          if (!bybitIds.length || !viresIds.length)
            return { success: false, message: 'Нужно выбрать Bybit и Vires', stats: null };
    
          const [viresList, bybitList] = await Promise.all([
            ctx.db.viresTransactionPayin.findMany({
              where: {
                cabinetId: { in: viresIds },
                createdAt: { gte: report.timeRangeStart, lte: report.timeRangeEnd },
                NOT: { ViresClipMatch: { some: { matchViresReportId: report.id } } },
              },
            }),
            ctx.db.bybitOrderInfo.findMany({
              where: {
                bybitCabinetId: { in: bybitIds },
                dateTime: {
                  gte: dayjs(report.timeRangeStart).subtract(3, 'hour').toDate(),
                  lte: dayjs(report.timeRangeEnd  ).subtract(3, 'hour').toDate(),
                },
                NOT: { ViresClipMatch: { some: { matchViresReportId: report.id } } },
              },
            }),
          ]);
    
          const usedV = new Set<number>();
          const usedB = new Set<number>();
          const batch: Prisma.ViresClipMatchCreateManyInput[] = [];
    
          for (const v of viresList) {
            if (usedV.has(v.id)) continue;
            const phone = normPhone(v.card);
            if (!phone) continue;
    
            let best: { b?: typeof bybitList[0]; diff?: number } = {};
            for (const b of bybitList) {
              if (usedB.has(b.id)) continue;
              if (!(b.phoneNumbers ?? []).map(normPhone).includes(phone)) continue;
    
              const diff = diffMin(v.createdAt, dayjs(b.dateTime).add(3, 'hour').toDate());
              if (diff > MIN_WIN) continue;
              if (!best.b || diff < (best.diff ?? Infinity)) best = { b, diff };
            }
    
            if (best.b) {
              usedV.add(v.id);
              usedB.add(best.b.id);
              const m = metrics(best.b, v);
    
              batch.push({
                matchViresReportId: report.id,
                viresTransactionId: v.id,
                bybitOrderInfoId  : best.b.id,
                bybitTransactionId: best.b.id, // legacy
                timeDifference    : Math.round((best.diff ?? 0) * 60),
                grossExpense      : m.grossExpense,
                grossIncome       : m.grossIncome,
                grossProfit       : m.grossProfit,
                profitPercentage  : m.profitPercentage,
                userId            : input.userId || report.userId,
              });
            }
          }
    
          if (!batch.length)
            return { success: true, message: 'Новых сопоставлений нет', stats: null };
    
          await ctx.db.viresClipMatch.createMany({ data: batch, skipDuplicates: true });
          const all = await ctx.db.viresClipMatch.findMany({
            where: { matchViresReportId: report.id },
          });
          const bStat = calcBasic(all);
    
          await ctx.db.matchViresReport.update({
            where: { id: report.id },
            data : bStat,
          });
    
          return { success: true, message: `Создано ${batch.length}`, stats: bStat };
        }),
    
      /* ── manual match ── */
      matchTransactionManually: publicProcedure
        .input(
          z.object({
            reportId            : z.number().positive(),
            viresTransactionUuid: z.string(),
            bybitOrderInfoId    : z.number().positive(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          const [vires, bybit, report] = await Promise.all([
            ctx.db.viresTransactionPayin.findUnique({ where: { uuid: input.viresTransactionUuid } }),
            ctx.db.bybitOrderInfo.findUnique({ where: { id: input.bybitOrderInfoId } }),
            ctx.db.matchViresReport.findUnique({ where: { id: input.reportId } }),
          ]);
          if (!vires || !bybit || !report) throw new Error('Данные не найдены');
    
          const phone = normPhone(vires.card);
          if (!phone || !(bybit.phoneNumbers ?? []).map(normPhone).includes(phone))
            throw new Error('Телефон не совпадает');
    
          const diff = diffMin(vires.createdAt, dayjs(bybit.dateTime).add(3, 'hour').toDate());
          if (diff > MIN_WIN) throw new Error('Время вне окна');
    
          const exists = await ctx.db.viresClipMatch.findFirst({
            where: {
              matchViresReportId: report.id,
              OR: [
                { viresTransactionId: vires.id },
                { bybitOrderInfoId: bybit.id },
              ],
            },
          });
          if (exists) throw new Error('Уже сопоставлено');
    
          const m = metrics(bybit, vires);
    
          await ctx.db.viresClipMatch.create({
            data: {
              matchViresReportId: report.id,
              viresTransactionId: vires.id,
              bybitOrderInfoId  : bybit.id,
              bybitTransactionId: bybit.id,
              timeDifference    : diff * 60,
              grossExpense      : m.grossExpense,
              grossIncome       : m.grossIncome,
              grossProfit       : m.grossProfit,
              profitPercentage  : m.profitPercentage,
              userId            : report.userId,
            },
          });
    
          const all = await ctx.db.viresClipMatch.findMany({
            where: { matchViresReportId: report.id },
          });
          await ctx.db.matchViresReport.update({
            where: { id: report.id },
            data : calcBasic(all),
          });
    
          return { success: true };
        }),
    
      /* ── un-match ── */
      unmatchTransaction: publicProcedure
        .input(z.object({ matchId: z.number().positive(), reportId: z.number().positive() }))
        .mutation(async ({ ctx, input }) => {
          await ctx.db.viresClipMatch.delete({ where: { id: input.matchId } });
          const all = await ctx.db.viresClipMatch.findMany({
            where: { matchViresReportId: input.reportId },
          });
          await ctx.db.matchViresReport.update({
            where: { id: input.reportId },
            data : calcBasic(all),
          });
          return { success: true };
        }),
    });
    