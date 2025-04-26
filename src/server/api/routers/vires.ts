import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { PasswordType } from "@prisma/client";

export const viresRouter = createTRPCRouter({
  // Получить все кабинеты
  getAll: publicProcedure.query(async ({ ctx }) => {
    const cabinets = await ctx.db.viresCabinet.findMany({
      include: {
        User: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            ViresTransactionPayin: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return cabinets;
  }),

  // Получить кабинет по ID
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const cabinet = await ctx.db.viresCabinet.findUnique({
        where: { id: input.id },
        include: {
          User: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              ViresTransactionPayin: true,
            },
          },
        },
      });

      return cabinet;
    }),

  // Создать новый кабинет
  create: publicProcedure
    .input(
      z.object({
        name: z.string().optional(),
        login: z.string(),
        password: z.string(),
        userId: z.number(),
        comment: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const cabinet = await ctx.db.viresCabinet.create({
        data: {
          name: input.name,
          login: input.login,
          password: input.password,
          type: PasswordType.BYBIT,
          userId: input.userId,
          comment: input.comment,
          lastUpdate: new Date(),
        },
      });

      return cabinet;
    }),

  // Обновить кабинет
  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        login: z.string(),
        password: z.string(),
        userId: z.number(),
        comment: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const cabinet = await ctx.db.viresCabinet.update({
        where: { id: input.id },
        data: {
          name: input.name,
          login: input.login,
          password: input.password,
          userId: input.userId,
          comment: input.comment,
          lastUpdate: new Date(),
        },
      });

      return cabinet;
    }),

  // Удалить кабинет
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const cabinet = await ctx.db.viresCabinet.delete({
        where: { id: input.id },
      });

      return cabinet;
    }),

  // Получить все транзакции кабинета
  getTransactions: publicProcedure
    .input(
      z.object({
        cabinetId: z.number(),
        page: z.number().default(1),
        pageSize: z.number().default(10),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = {
        cabinetId: input.cabinetId,
        ...(input.startDate && input.endDate
          ? {
              createdAt: {
                gte: input.startDate,
                lte: input.endDate,
              },
            }
          : {}),
      };

      const [transactions, totalCount] = await Promise.all([
        ctx.db.viresTransactionPayin.findMany({
          where,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          orderBy: {
            createdAt: "desc",
          },
        }),
        ctx.db.viresTransactionPayin.count({ where }),
      ]);

      return {
        transactions,
        totalCount,
        totalPages: Math.ceil(totalCount / input.pageSize),
      };
    }),

  // Получить транзакции по периоду для всех кабинетов
  getTransactionsByPeriod: publicProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const cabinets = await ctx.db.viresCabinet.findMany({
        include: {
          User: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              ViresTransactionPayin: {
                where: {
                  createdAt: {
                    gte: input.startDate,
                    lte: input.endDate,
                  },
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return cabinets;
    }),

  // Получить всех пользователей для выпадающего списка
  getUsers: publicProcedure.query(async ({ ctx }) => {
    const users = await ctx.db.user.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return users;
  }),
});
