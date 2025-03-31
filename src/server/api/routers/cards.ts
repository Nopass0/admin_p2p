import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const cardsRouter = createTRPCRouter({
  getAll: publicProcedure
    .input(z.object({
      page: z.number().int().default(1),
      pageSize: z.number().int().default(10),
      searchQuery: z.string().optional(),
      sortBy: z.string().optional(),
      sortDirection: z.enum(["asc", "desc"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, pageSize, searchQuery, sortBy, sortDirection } = input;
      const skip = (page - 1) * pageSize;

      const whereClause = searchQuery ? {
        OR: [
          { provider: { contains: searchQuery, mode: "insensitive" } },
          { bank: { contains: searchQuery, mode: "insensitive" } },
          { cardNumber: { contains: searchQuery, mode: "insensitive" } },
          { comment: { contains: searchQuery, mode: "insensitive" } },
        ],
      } : {};

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
            balances: {
              orderBy: {
                date: "desc"
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
      status: z.string().default("active"),
      picachu: z.string().optional(),
      initialBalance: z.number().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { initialBalance, ...cardData } = input;
      
      const card = await ctx.db.card.create({
        data: cardData,
      });

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
      status: z.string().optional(),
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
});
