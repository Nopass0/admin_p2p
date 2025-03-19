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

    getUnmatchedIdexTransactions: publicProcedure
  .input(z.object({
    startDate: z.string(),
    endDate: z.string(),
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().default(10),
    searchQuery: z.string().optional()
  }))
  .query(async ({ ctx, input }) => {
    try {
      const { startDate, endDate, page, pageSize, searchQuery } = input;
      const startDateTime = dayjs(startDate).toDate();
      const endDateTime = dayjs(endDate).toDate();
      
      // Filter for IDEX transactions with approvedAt in the date range
      // and not already matched
      const where = {
        approvedAt: {
          gte: startDateTime.toISOString(),
          lte: endDateTime.toISOString()
        },
        matches: {
          none: {}
        }
      };
      
      // Add search filter if provided
      if (searchQuery) {
        where.OR = [
          { externalId: { contains: searchQuery } },
          { wallet: { contains: searchQuery } }
        ];
      }
      
      // Get unmatched IDEX transactions
      const transactions = await ctx.db.idexTransaction.findMany({
        where,
        orderBy: {
          approvedAt: 'desc'
        },
        skip: (page - 1) * pageSize,
        take: pageSize
      });
      
      // Count total for pagination
      const totalTransactions = await ctx.db.idexTransaction.count({
        where
      });
      
      return {
        success: true,
        transactions,
        pagination: {
          totalTransactions,
          totalPages: Math.ceil(totalTransactions / pageSize) || 1,
          currentPage: page,
          pageSize
        }
      };
    } catch (error) {
      console.error("Error getting unmatched IDEX transactions:", error);
      return {
        success: false,
        message: "Failed to get unmatched IDEX transactions",
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

// Get unmatched user wallet transactions
getUnmatchedUserTransactions: publicProcedure
  .input(z.object({
    userId: z.number().int().positive().nullable(),
    startDate: z.string(),
    endDate: z.string(),
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().default(10),
    searchQuery: z.string().optional()
  }))
  .query(async ({ ctx, input }) => {
    try {
      const { userId, startDate, endDate, page, pageSize, searchQuery } = input;
      const startDateTime = dayjs(startDate).toDate();
      const endDateTime = dayjs(endDate).toDate();
      
      // Base filter for date range and no matches
      let where = {
        dateTime: {
          gte: startDateTime,
          lte: endDateTime
        },
        matches: {
          none: {}
        }
      };
      
      // Add user filter if provided
      if (userId) {
        where.userId = userId;
      }
      
      // Add search filter if provided
      if (searchQuery) {
        where.OR = [
          { externalId: { contains: searchQuery } },
          { orderNo: { contains: searchQuery } },
          { counterparty: { contains: searchQuery } },
          { totalPrice: { equals: parseFloat(searchQuery) || undefined } }
        ];
      }
      
      // Get unmatched user transactions
      const transactions = await ctx.db.transaction.findMany({
        where,
        include: {
          user: true
        },
        orderBy: {
          dateTime: 'desc'
        },
        skip: (page - 1) * pageSize,
        take: pageSize
      });
      
      // Count total for pagination
      const totalTransactions = await ctx.db.transaction.count({
        where
      });
      
      return {
        success: true,
        transactions,
        pagination: {
          totalTransactions,
          totalPages: Math.ceil(totalTransactions / pageSize) || 1,
          currentPage: page,
          pageSize
        }
      };
    } catch (error) {
      console.error("Error getting unmatched user transactions:", error);
      return {
        success: false,
        message: "Failed to get unmatched user transactions",
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

// Create a manual match between IDEX and user transactions
createManualMatch: publicProcedure
  .input(z.object({
    idexTransactionId: z.number().int().positive(),
    transactionId: z.number().int().positive()
  }))
  .mutation(async ({ ctx, input }) => {
    try {
      const { idexTransactionId, transactionId } = input;
      
      // Check if either transaction is already matched
      const existingIdexMatch = await ctx.db.match.findFirst({
        where: { idexTransactionId }
      });
      
      if (existingIdexMatch) {
        return {
          success: false,
          message: "IDEX транзакция уже сопоставлена с другой транзакцией"
        };
      }
      
      const existingTransactionMatch = await ctx.db.match.findFirst({
        where: { transactionId }
      });
      
      if (existingTransactionMatch) {
        return {
          success: false,
          message: "Транзакция кошелька уже сопоставлена с другой IDEX транзакцией"
        };
      }
      
      // Get both transactions for match metrics calculation
      const idexTransaction = await ctx.db.idexTransaction.findUnique({
        where: { id: idexTransactionId }
      });
      
      const transaction = await ctx.db.transaction.findUnique({
        where: { id: transactionId }
      });
      
      if (!idexTransaction || !transaction) {
        return {
          success: false,
          message: "Одна или обе транзакции не найдены"
        };
      }
      
      // Calculate time difference
      let timeDifference = 0;
      if (idexTransaction.approvedAt && transaction.dateTime) {
        const timeDiffMinutes = getTimeDifferenceInMinutes(
          idexTransaction.approvedAt,
          transaction.dateTime.toISOString()
        );
        timeDifference = Math.round(timeDiffMinutes * 60); // Convert to seconds
      }
      
      // Calculate match metrics
      const metrics = calculateMatchMetrics(transaction, idexTransaction);
      
      // Create the match
      const match = await ctx.db.match.create({
        data: {
          idexTransactionId,
          transactionId,
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
      console.error("Error creating manual match:", error);
      return {
        success: false,
        message: "Произошла ошибка при создании ручного сопоставления"
      };
    }
  }),

// Delete a match
deleteMatch: publicProcedure
  .input(z.object({
    matchId: z.number().int().positive()
  }))
  .mutation(async ({ ctx, input }) => {
    try {
      const { matchId } = input;
      
      // Check if match exists
      const match = await ctx.db.match.findUnique({
        where: { id: matchId }
      });
      
      if (!match) {
        return {
          success: false,
          message: "Сопоставление не найдено"
        };
      }
      
      // Delete the match
      await ctx.db.match.delete({
        where: { id: matchId }
      });
      
      return {
        success: true,
        message: "Сопоставление успешно удалено"
      };
    } catch (error) {
      console.error("Error deleting match:", error);
      return {
        success: false,
        message: "Произошла ошибка при удалении сопоставления"
      };
    }
  }),

// Enhanced getAllMatches to support search
getAllMatches: publicProcedure
  .input(z.object({
    startDate: z.string(),
    endDate: z.string(),
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().default(10),
    searchQuery: z.string().optional()
  }))
  .query(async ({ ctx, input }) => {
    try {
      const { startDate, endDate, page, pageSize, searchQuery } = input;
      const startDateTime = dayjs(startDate).toDate();
      const endDateTime = dayjs(endDate).toDate();
      
      // Base filter for date range
      let where = {
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
      
      // Add search filter if provided
      if (searchQuery) {
        where = {
          AND: [
            where,
            {
              OR: [
                { transaction: { user: { name: { contains: searchQuery, mode: 'insensitive' } } } },
                { idexTransaction: { externalId: { equals: BigInt(searchQuery) || undefined } } },
                { transaction: { totalPrice: { equals: parseFloat(searchQuery) || undefined } } }
              ]
            }
          ]
        };
      }
      
      // Get matches with filters
      const matches = await ctx.db.match.findMany({
        where,
        include: {
          idexTransaction: true,
          transaction: {
            include: {
              user: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: (page - 1) * pageSize,
        take: pageSize
      });
      
      // Count total for pagination
      const totalMatches = await ctx.db.match.count({
        where
      });
      
      // Calculate total statistics
      const allMatches = await ctx.db.match.findMany({
        where
      });
      
      const stats = calculateTotalStats(allMatches);
      
      return {
        success: true,
        matches,
        stats,
        pagination: {
          totalMatches,
          totalPages: Math.ceil(totalMatches / pageSize) || 1,
          currentPage: page,
          pageSize
        }
      };
    } catch (error) {
      console.error("Error getting all matches:", error);
      return {
        success: false,
        message: "Failed to get all matches",
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
