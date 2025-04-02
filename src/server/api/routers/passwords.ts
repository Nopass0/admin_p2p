import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const passwordsRouter = createTRPCRouter({
  // Получение всех паролей с фильтрацией и поиском
  getAll: publicProcedure
    .input(z.object({
      searchQuery: z.string().optional(),
      skip: z.number().int().nonnegative().optional(),
      take: z.number().int().positive().optional(),
      orderBy: z.enum(["name", "login", "createdAt", "updatedAt"]).optional(),
      orderDirection: z.enum(["asc", "desc"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { searchQuery, skip = 0, take = 50, orderBy = "createdAt", orderDirection = "desc" } = input;
      
      let where = {};
      
      if (searchQuery) {
        where = {
          OR: [
            { name: { contains: searchQuery, mode: 'insensitive' } },
            { login: { contains: searchQuery, mode: 'insensitive' } },
            { comment: { contains: searchQuery, mode: 'insensitive' } },
            { password: { contains: searchQuery, mode: 'insensitive' } },
          ],
        };
      }
      
      const [passwords, totalCount] = await Promise.all([
        ctx.db.password.findMany({
          where,
          skip,
          take,
          orderBy: { [orderBy]: orderDirection },
        }),
        ctx.db.password.count({ where }),
      ]);
      
      return {
        passwords,
        totalCount,
      };
    }),
    
  // Получение одного пароля по ID
  getById: publicProcedure
    .input(z.object({
      id: z.number().int().positive(),
    }))
    .query(async ({ ctx, input }) => {
      const password = await ctx.db.password.findUnique({
        where: { id: input.id },
      });
      
      if (!password) {
        throw new Error("Пароль не найден");
      }
      
      return password;
    }),
    
  // Создание нового пароля
  create: publicProcedure
    .input(z.object({
      name: z.string().min(1, "Название обязательно"),
      login: z.string().optional(),
      password: z.string().min(1, "Пароль обязателен"),
      comment: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const password = await ctx.db.password.create({
        data: input,
      });
      
      return password;
    }),
    
  // Обновление пароля
  update: publicProcedure
    .input(z.object({
      id: z.number().int().positive(),
      name: z.string().min(1, "Название обязательно"),
      login: z.string().optional(),
      password: z.string().min(1, "Пароль обязателен"),
      comment: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      
      const password = await ctx.db.password.update({
        where: { id },
        data,
      });
      
      return password;
    }),
    
  // Удаление пароля
  delete: publicProcedure
    .input(z.object({
      id: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.password.delete({
        where: { id: input.id },
      });
      
      return { success: true };
    }),
});
