import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

const CardStatusEnum = z.enum(["ACTIVE", "WARNING", "BLOCKED"]);

export const cardsRouter = createTRPCRouter({
  getAll: publicProcedure
    .input(z.object({
      page: z.number().int().default(1),
      pageSize: z.number().int().default(10),
      searchQuery: z.string().optional(),
      sortBy: z.string().optional(),
      sortDirection: z.enum(["asc", "desc"]).optional(),
      // Filters
      provider: z.string().optional(),
      bank: z.string().optional(),
      status: CardStatusEnum.optional(),
      collectorName: z.string().optional(),
      picachu: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { 
        page, 
        pageSize, 
        searchQuery, 
        sortBy, 
        sortDirection,
        provider,
        bank,
        status,
        collectorName,
        picachu
      } = input;
      
      const skip = (page - 1) * pageSize;

      // Base where clause
      let whereClause: any = {};

      // Apply search query if provided
      if (searchQuery) {
        whereClause.OR = [
          { provider: { contains: searchQuery, mode: "insensitive" } },
          { bank: { contains: searchQuery, mode: "insensitive" } },
          { cardNumber: { contains: searchQuery, mode: "insensitive" } },
          { comment: { contains: searchQuery, mode: "insensitive" } },
          { phoneNumber: { contains: searchQuery, mode: "insensitive" } },
          { terminalPin: { contains: searchQuery, mode: "insensitive" } },
          { picachu: { contains: searchQuery, mode: "insensitive" } },
        ];
      }

      // Apply filters
      if (provider) {
        whereClause.provider = { contains: provider, mode: "insensitive" };
      }

      if (bank) {
        whereClause.bank = { contains: bank, mode: "insensitive" };
      }

      if (status) {
        whereClause.status = status;
      }

      if (picachu) {
        whereClause.picachu = { contains: picachu, mode: "insensitive" };
      }

      // Collector filter requires joining with pourings
      let cardIdsWithCollector;
      if (collectorName) {
        const pouringsWithCollector = await ctx.db.cardPouring.findMany({
          where: {
            collectorName: { contains: collectorName, mode: "insensitive" }
          },
          select: {
            cardId: true
          }
        });
        
        cardIdsWithCollector = pouringsWithCollector.map(p => p.cardId);
        
        if (cardIdsWithCollector.length > 0) {
          whereClause.id = { in: cardIdsWithCollector };
        } else {
          // If no cards match the collector, return empty result
          return {
            cards: [],
            totalPages: 0,
            totalCount: 0,
          };
        }
      }

      const orderBy = sortBy ? {
        [sortBy]: sortDirection ?? "asc",
      } : { createdAt: "desc" };

      const [cards, totalCount] = await Promise.all([
        ctx.db.card.findMany({
          where: whereClause,
          orderBy,
          skip,
          take: pageSize,
          include: {
            // Get latest balance
            balances: {
              orderBy: {
                date: "desc"
              },
              take: 1
            },
            // Get latest pouring
            pourings: {
              orderBy: {
                pouringDate: "desc"
              },
              take: 1
            }
          }
        }),
        ctx.db.card.count({
          where: whereClause,
        }),
      ]);

      return {
        cards,
        totalPages: Math.ceil(totalCount / pageSize),
        totalCount,
      };
    }),

  getById: publicProcedure
    .input(z.object({
      id: z.number().int(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.card.findUnique({
        where: { id: input.id },
        include: {
          balances: {
            orderBy: {
              date: "desc"
            }
          },
          pourings: {
            orderBy: {
              pouringDate: "desc"
            }
          }
        }
      });
    }),

  create: publicProcedure
    .input(z.object({
      externalId: z.number().int(),
      provider: z.string().min(1),
      cardNumber: z.string().min(1),
      bank: z.string().min(1),
      phoneNumber: z.string().min(1),
      appPin: z.number().int(),
      terminalPin: z.string().min(1),
      comment: z.string().optional(),
      status: CardStatusEnum.default("ACTIVE"),
      picachu: z.string().optional(),
      initialBalance: z.number().optional(),
      // Initial pouring data if provided
      pouringAmount: z.number().optional(),
      initialAmount: z.number().optional(),
      initialDate: z.date().optional(),
      collectorName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { 
        initialBalance, 
        pouringAmount, 
        initialAmount, 
        initialDate, 
        collectorName,
        ...cardData 
      } = input;
      
      // Create the card
      const card = await ctx.db.card.create({
        data: cardData,
      });

      // Create initial balance if provided
      if (initialBalance !== undefined) {
        await ctx.db.cardBalance.create({
          data: {
            cardId: card.id,
            date: new Date(),
            startBalance: initialBalance,
            endBalance: initialBalance
          }
        });
      }

      // Create initial pouring if all required data is provided
      if (pouringAmount !== undefined && initialAmount !== undefined) {
        await ctx.db.cardPouring.create({
          data: {
            cardId: card.id,
            pouringDate: new Date(),
            initialAmount,
            initialDate: initialDate || new Date(),
            pouringAmount,
            status: card.status,
            collectorName,
          }
        });
      }

      return card;
    }),

  update: publicProcedure
    .input(z.object({
      id: z.number().int(),
      externalId: z.number().int().optional(),
      provider: z.string().min(1).optional(),
      cardNumber: z.string().min(1).optional(),
      bank: z.string().min(1).optional(),
      phoneNumber: z.string().min(1).optional(),
      appPin: z.number().int().optional(),
      terminalPin: z.string().min(1).optional(),
      comment: z.string().optional(),
      status: CardStatusEnum.optional(),
      picachu: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.card.update({
        where: { id },
        data,
      });
    }),

  delete: publicProcedure
    .input(z.object({
      id: z.number().int(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.card.delete({
        where: { id: input.id },
      });
    }),

  updateBalance: publicProcedure
    .input(z.object({
      cardId: z.number().int(),
      date: z.date(),
      startBalance: z.number(),
      endBalance: z.number()
    }))
    .mutation(async ({ ctx, input }) => {
      const { cardId, date, startBalance, endBalance } = input;
      
      const existingBalance = await ctx.db.cardBalance.findUnique({
        where: {
          cardId_date: {
            cardId,
            date
          }
        }
      });

      if (existingBalance) {
        return ctx.db.cardBalance.update({
          where: {
            id: existingBalance.id
          },
          data: {
            startBalance,
            endBalance
          }
        });
      } else {
        return ctx.db.cardBalance.create({
          data: {
            cardId,
            date,
            startBalance,
            endBalance
          }
        });
      }
    }),
    
  getCardBalances: publicProcedure
    .input(z.object({
      cardId: z.number().int(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.cardBalance.findMany({
        where: {
          cardId: input.cardId
        },
        orderBy: {
          date: "desc"
        }
      });
    }),
    
  createBalance: publicProcedure
    .input(z.object({
      cardId: z.number().int(),
      date: z.date(),
      startBalance: z.number(),
      endBalance: z.number()
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.cardBalance.create({
        data: input
      });
    }),
    
  deleteBalance: publicProcedure
    .input(z.object({
      id: z.number().int(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.cardBalance.delete({
        where: { id: input.id },
      });
    }),
    
  // New endpoint to manage card pourings
  createPouring: publicProcedure
    .input(z.object({
      cardId: z.number().int(),
      pouringDate: z.date(),
      initialAmount: z.number(),
      initialDate: z.date(),
      finalAmount: z.number().optional(),
      finalDate: z.date().optional(),
      pouringAmount: z.number(),
      withdrawalAmount: z.number().optional(),
      withdrawalDate: z.date().optional(),
      collectorName: z.string().optional(),
      status: CardStatusEnum.default("ACTIVE"),
      comment: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.cardPouring.create({
        data: input
      });
    }),

  updatePouring: publicProcedure
    .input(z.object({
      id: z.number().int(),
      pouringDate: z.date().optional(),
      initialAmount: z.number().optional(),
      initialDate: z.date().optional(),
      finalAmount: z.number().optional(),
      finalDate: z.date().optional(),
      pouringAmount: z.number().optional(),
      withdrawalAmount: z.number().optional(),
      withdrawalDate: z.date().optional(),
      collectorName: z.string().optional(),
      status: CardStatusEnum.optional(),
      comment: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.cardPouring.update({
        where: { id },
        data,
      });
    }),

  deletePouring: publicProcedure
    .input(z.object({
      id: z.number().int(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.cardPouring.delete({
        where: { id: input.id },
      });
    }),
    
  // Get unique values for filters
  getFilterOptions: publicProcedure
    .query(async ({ ctx }) => {
      const [providers, banks, collectorNames, picachus] = await Promise.all([
        ctx.db.card.findMany({
          select: { provider: true },
          distinct: ['provider'],
        }),
        ctx.db.card.findMany({
          select: { bank: true },
          distinct: ['bank'],
        }),
        ctx.db.cardPouring.findMany({
          where: { collectorName: { not: null } },
          select: { collectorName: true },
          distinct: ['collectorName'],
        }),
        ctx.db.card.findMany({
          where: { picachu: { not: null } },
          select: { picachu: true },
          distinct: ['picachu'],
        }),
      ]);

      return {
        providers: providers.map(p => p.provider),
        banks: banks.map(b => b.bank),
        collectorNames: collectorNames.map(c => c.collectorName).filter(Boolean),
        picachus: picachus.map(p => p.picachu).filter(Boolean),
      };
    }),
});