import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";
import { Prisma } from "@prisma/client";

export const bybitTransactionsRouter = createTRPCRouter({
  // Получение транзакций Bybit для пользователя с фильтрацией
  getUserBybitTransactions: publicProcedure
    .input(z.object({
      userId: z.number().int().positive(),
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().default(10),
      searchQuery: z.string().optional(),
      startDate: z.date().nullable().optional(),
      endDate: z.date().nullable().optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const { userId, page, pageSize, searchQuery, startDate, endDate } = input;
        
        // Базовый фильтр
        let where: Prisma.BybitTransactionWhereInput = { userId };
        
        // Добавляем фильтр по диапазону дат, если указан
        if (startDate || endDate) {
          where.dateTime = {};
          
          if (startDate) {
            where.dateTime.gte = startDate;
          }
          
          if (endDate) {
            // Устанавливаем время на конец дня для конечной даты
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            where.dateTime.lte = endOfDay;
          }
        }
        
        // Добавляем поиск по всем текстовым полям, если указан searchQuery
        if (searchQuery) {
          // Пытаемся распарсить searchQuery как число для поиска по числовым полям
          const numericValue = parseFloat(searchQuery);
          const isNumeric = !isNaN(numericValue);
          
          const stringSearchConditions: Prisma.BybitTransactionWhereInput[] = [
            { orderNo: { contains: searchQuery, mode: 'insensitive' as Prisma.QueryMode } },
            { type: { contains: searchQuery, mode: 'insensitive' as Prisma.QueryMode } },
            { asset: { contains: searchQuery, mode: 'insensitive' as Prisma.QueryMode } },
            { counterparty: { contains: searchQuery, mode: 'insensitive' as Prisma.QueryMode } },
            { status: { contains: searchQuery, mode: 'insensitive' as Prisma.QueryMode } },
          ];
          
          // Если searchQuery можно преобразовать в число, добавляем поиск по числовым полям
          const numericSearchConditions: Prisma.BybitTransactionWhereInput[] = isNumeric 
            ? [
                { amount: { equals: numericValue } },
                { totalPrice: { equals: numericValue } },
                { unitPrice: { equals: numericValue } },
              ] 
            : [];
          
          where.OR = [...stringSearchConditions, ...numericSearchConditions];
        }
        
        // Получаем общее количество транзакций для пагинации
        const totalTransactions = await ctx.db.bybitTransaction.count({ where });
        
        // Рассчитываем общее количество страниц
        const totalPages = Math.ceil(totalTransactions / pageSize);
        
        // Получаем транзакции с пагинацией
        const transactions = await ctx.db.bybitTransaction.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { dateTime: 'desc' },
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
        console.error("Ошибка при получении транзакций Bybit:", error);
        return {
          success: false,
          message: "Произошла ошибка при получении транзакций Bybit",
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
});