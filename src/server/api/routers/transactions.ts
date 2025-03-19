import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";

export const transactionsRouter = createTRPCRouter({
  // Получение транзакций пользователя с пагинацией
  getUserTransactions: publicProcedure
    .input(z.object({ 
      userId: z.number().int().positive(),
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().default(10),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      type: z.string().optional(),
      status: z.string().optional(),
      asset: z.string().optional()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const { userId, page, pageSize, startDate, endDate, type, status, asset } = input;
        
        // Базовый фильтр по пользователю
        let where: any = { userId };
        
        // Добавляем фильтры по датам, если они указаны
        if (startDate && endDate) {
          where.dateTime = {
            gte: new Date(startDate),
            lte: new Date(endDate),
          };
        } else if (startDate) {
          where.dateTime = { gte: new Date(startDate) };
        } else if (endDate) {
          where.dateTime = { lte: new Date(endDate) };
        }
        
        // Добавляем фильтр по типу транзакции, если указан
        if (type) {
          where.type = type;
        }
        
        // Добавляем фильтр по статусу транзакции, если указан
        if (status) {
          where.status = status;
        }
        
        // Добавляем фильтр по активу, если указан
        if (asset) {
          where.asset = asset;
        }
        
        // Получаем общее количество транзакций для пагинации
        const totalTransactions = await ctx.db.transaction.count({ where });
        
        // Рассчитываем общее количество страниц
        const totalPages = Math.ceil(totalTransactions / pageSize);
        
        // Получаем транзакции с пагинацией
        const transactions = await ctx.db.transaction.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { dateTime: 'desc' },
          include: {
            matches: {
              include: {
                idexTransaction: true
              }
            }
          }
        });

        return { 
          success: true, 
          transactions, 
          pagination: {
            totalTransactions,
            totalPages,
            currentPage: page,
            pageSize
          }
        };
      } catch (error) {
        console.error("Ошибка при получении транзакций пользователя:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при получении транзакций пользователя", 
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

  // Получение статистики по транзакциям пользователя
  getUserTransactionStats: publicProcedure
    .input(z.object({ 
      userId: z.number().int().positive(),
      startDate: z.string().optional(),
      endDate: z.string().optional()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const { userId, startDate, endDate } = input;
        
        // Базовый фильтр по пользователю
        let where: any = { userId };
        
        // Добавляем фильтры по датам, если они указаны
        if (startDate && endDate) {
          where.dateTime = {
            gte: new Date(startDate),
            lte: new Date(endDate),
          };
        } else if (startDate) {
          where.dateTime = { gte: new Date(startDate) };
        } else if (endDate) {
          where.dateTime = { lte: new Date(endDate) };
        }
        
        // Получаем все транзакции пользователя с указанными фильтрами
        const transactions = await ctx.db.transaction.findMany({
          where,
          include: {
            matches: true
          }
        });
        
        // Рассчитываем статистику
        const stats = {
          totalTransactions: transactions.length,
          totalAmount: 0,
          totalMatchedTransactions: 0,
          totalProfit: 0,
          profitPercentage: 0,
          assetStats: {} as Record<string, { 
            count: number, 
            totalAmount: number, 
            matchedCount: number, 
            profit: number 
          }>,
          typeStats: {
            buy: { count: 0, totalAmount: 0 },
            sell: { count: 0, totalAmount: 0 }
          },
          statusStats: {} as Record<string, number>
        };
        
        // Обрабатываем каждую транзакцию для сбора статистики
        for (const transaction of transactions) {
          // Обновляем общую сумму
          stats.totalAmount += transaction.totalPrice;
          
          // Обновляем статистику по активам
          if (!stats.assetStats[transaction.asset]) {
            stats.assetStats[transaction.asset] = { 
              count: 0, 
              totalAmount: 0, 
              matchedCount: 0, 
              profit: 0 
            };
          }
          stats.assetStats[transaction.asset].count++;
          stats.assetStats[transaction.asset].totalAmount += transaction.totalPrice;
          
          // Обновляем статистику по типам (покупка/продажа)
          if (transaction.type.toLowerCase() === "buy") {
            stats.typeStats.buy.count++;
            stats.typeStats.buy.totalAmount += transaction.totalPrice;
          } else if (transaction.type.toLowerCase() === "sell") {
            stats.typeStats.sell.count++;
            stats.typeStats.sell.totalAmount += transaction.totalPrice;
          }
          
          // Обновляем статистику по статусам
          if (!stats.statusStats[transaction.status]) {
            stats.statusStats[transaction.status] = 0;
          }
          stats.statusStats[transaction.status]++;
          
          // Обновляем статистику по сматченным транзакциям
          if (transaction.matches && transaction.matches.length > 0) {
            stats.totalMatchedTransactions++;
            
            // Проверяем наличие статистики для данного актива
            if (stats.assetStats[transaction.asset]) {
              stats.assetStats[transaction.asset].matchedCount++;
              
              // Суммируем прибыль от всех матчей
              for (const match of transaction.matches) {
                if (match.grossProfit !== undefined) {
                  stats.totalProfit += match.grossProfit;
                }
                
                // Проверяем наличие asset в assetStats
                if (stats.assetStats[transaction.asset]) {
                  if (match.grossProfit !== undefined) {
                    stats.assetStats[transaction.asset].profit += match.grossProfit;
                  }
                }
              }
            }
          }
        }
        
        // Рассчитываем процент прибыли
        if (stats.totalAmount > 0) {
          stats.profitPercentage = (stats.totalProfit / stats.totalAmount) * 100;
        }
        
        return { 
          success: true, 
          stats 
        };
      } catch (error) {
        console.error("Ошибка при получении статистики транзакций:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при получении статистики транзакций", 
          stats: null 
        };
      }
    }),

  // Получение всех матчей для пользователя
  getUserMatches: publicProcedure
    .input(z.object({ 
      userId: z.number().int().positive(),
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().default(10),
      startDate: z.string().optional(),
      endDate: z.string().optional()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const { userId, page, pageSize, startDate, endDate } = input;
        
        // Транзакции пользователя с заданными фильтрами
        let transactionWhere: any = { userId };
        
        // Добавляем фильтры по датам для транзакций
        if (startDate && endDate) {
          transactionWhere.dateTime = {
            gte: new Date(startDate),
            lte: new Date(endDate),
          };
        } else if (startDate) {
          transactionWhere.dateTime = { gte: new Date(startDate) };
        } else if (endDate) {
          transactionWhere.dateTime = { lte: new Date(endDate) };
        }
        
        // Получаем ID транзакций пользователя, соответствующих фильтрам
        const userTransactions = await ctx.db.transaction.findMany({
          where: transactionWhere,
          select: { id: true }
        });
        
        const transactionIds = userTransactions.map(t => t.id);
        
        // Базовый фильтр по ID транзакций
        let matchWhere: any = {
          transactionId: { in: transactionIds }
        };
        
        // Получаем общее количество матчей
        const totalMatches = await ctx.db.match.count({ where: matchWhere });
        
        // Рассчитываем общее количество страниц
        const totalPages = Math.ceil(totalMatches / pageSize);
        
        // Получаем матчи с пагинацией
        const matches = await ctx.db.match.findMany({
          where: matchWhere,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
          include: {
            transaction: true,
            idexTransaction: true
          }
        });

        return { 
          success: true, 
          matches, 
          pagination: {
            totalMatches,
            totalPages,
            currentPage: page,
            pageSize
          }
        };
      } catch (error) {
        console.error("Ошибка при получении матчей пользователя:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при получении матчей пользователя", 
          matches: [],
          pagination: {
            totalMatches: 0,
            totalPages: 0,
            currentPage: input.page,
            pageSize: input.pageSize
          }
        };
      }
    }),
});
