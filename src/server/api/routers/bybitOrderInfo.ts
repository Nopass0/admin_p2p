import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const bybitOrderInfoRouter = createTRPCRouter({
  // Create
  create: publicProcedure
    .input(z.object({
      orderNo: z.string(),
      userId: z.number().int().positive(),
      phoneNumbers: z.array(z.string())
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const bybitOrderInfo = await ctx.db.bybitOrderInfo.create({
          data: {
            orderNo: input.orderNo,
            userId: input.userId,
            phoneNumbers: input.phoneNumbers,
            updatedAt: new Date()
          }
        });
        return { success: true, data: bybitOrderInfo };
      } catch (error) {
        console.error("Ошибка при создании информации о заказе Bybit:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Не удалось создать информацию о заказе Bybit"
        });
      }
    }),

  // Read (get by id)
  getById: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const bybitOrderInfo = await ctx.db.bybitOrderInfo.findUnique({
        where: { id: input.id },
        include: {
          User: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
      
      if (!bybitOrderInfo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Информация о заказе Bybit не найдена"
        });
      }
      
      return {
        ...bybitOrderInfo,
        userId: bybitOrderInfo.userId,
        userName: bybitOrderInfo.User.name
      };
    }),

  // Read (get all)
  getAll: publicProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().default(10),
      searchQuery: z.string().optional()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const { page, pageSize, searchQuery } = input;
        
        if (!ctx.db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Соединение с базой данных недоступно"
          });
        }

        let where = {};
        
        if (searchQuery) {
          where = {
            OR: [
              { orderNo: { contains: searchQuery, mode: 'insensitive' } },
              { User: { name: { contains: searchQuery, mode: 'insensitive' } } }
            ]
          };
        }
        
        const [bybitOrderInfos, totalCount] = await Promise.all([
          ctx.db.bybitOrderInfo.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            include: {
              User: {
                select: {
                  id: true,
                  name: true
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          }),
          ctx.db.bybitOrderInfo.count({ where })
        ]);
        
        return {
          items: bybitOrderInfos.map(item => ({
            ...item,
            userId: item.userId,
            userName: item.User.name
          })),
          totalCount,
          pageCount: Math.ceil(totalCount / pageSize)
        };
      } catch (error) {
        console.error("Ошибка при получении информации о заказах Bybit:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Ошибка при получении данных"
        });
      }
    }),

  // Update
  update: publicProcedure
    .input(z.object({
      id: z.number().int().positive(),
      orderNo: z.string().optional(),
      phoneNumbers: z.array(z.string()).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const bybitOrderInfo = await ctx.db.bybitOrderInfo.update({
          where: { id: input.id },
          data: {
            ...(input.orderNo && { orderNo: input.orderNo }),
            ...(input.phoneNumbers && { phoneNumbers: input.phoneNumbers }),
            updatedAt: new Date()
          }
        });
        return { success: true, data: bybitOrderInfo };
      } catch (error) {
        console.error("Ошибка при обновлении информации о заказе Bybit:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Не удалось обновить информацию о заказе Bybit"
        });
      }
    }),

  // Delete
  delete: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.bybitOrderInfo.delete({
          where: { id: input.id }
        });
        return { success: true };
      } catch (error) {
        console.error("Ошибка при удалении информации о заказе Bybit:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Не удалось удалить информацию о заказе Bybit"
        });
      }
    })
});
