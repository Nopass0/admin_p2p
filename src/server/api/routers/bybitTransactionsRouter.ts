import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { BybitParser } from "@/utils/bybit-parser";

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

  // Загрузка транзакций из XLS файла

uploadBybitTransactions: publicProcedure
  .input(
    z.object({
      userId: z.number().int().positive(),
      fileBase64: z.string(), // XLS файл в формате base64
    })
  )
  .mutation(async ({ ctx, input }) => {
    try {
      const { userId, fileBase64 } = input;
      
      // Декодируем base64 в буфер
      const fileBuffer = Buffer.from(fileBase64, 'base64');
      
      // Парсим XLS файл
      const parsedData = await BybitParser.parseXLSBuffer(fileBuffer);
      const { transactions, summary } = parsedData;
      
      // Счетчики для статистики
      let addedCount = 0;
      let skippedCount = 0;
      
      // Обрабатываем каждую транзакцию
      for (const tx of transactions) {
        // Проверяем существование записи перед созданием
        const existingTransaction = await ctx.db.bybitTransaction.findFirst({
          where: {
            orderNo: tx.orderNo,
            userId: userId
          }
        });
        
        // Если транзакция уже существует, пропускаем её
        if (existingTransaction) {
          skippedCount++;
          continue;
        }
        
        // Создаем новую транзакцию, если она не существует
        await ctx.db.bybitTransaction.create({
          data: {
            userId,
            orderNo: tx.orderNo,
            dateTime: tx.dateTime,
            type: tx.type,
            asset: tx.asset,
            amount: tx.amount,
            totalPrice: tx.totalPrice,
            unitPrice: tx.unitPrice,
            counterparty: tx.counterparty || null,
            status: tx.status,
            originalData: tx.originalData || {}
          }
        });
        
        // Увеличиваем счетчик добавленных транзакций
        addedCount++;
      }
      
      return {
        success: true,
        summary: {
          ...summary,
          addedTransactions: addedCount,
          skippedTransactions: skippedCount,
          totalProcessed: transactions.length
        }
      };
    } catch (error) {
      console.error("Ошибка при загрузке транзакций Bybit:", error);
      return {
        success: false,
        message: `Произошла ошибка при загрузке транзакций: ${error.message}`,
        summary: {
          addedTransactions: 0,
          skippedTransactions: 0,
          totalProcessed: 0
        }
      };
    }
  }),
});