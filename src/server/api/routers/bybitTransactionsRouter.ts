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
      
      // Проверка валидности base64
      if (!fileBase64 || fileBase64.trim() === '') {
        throw new Error("Пустая строка base64");
      }
      
      // Очистка строки base64 от возможных префиксов
      let cleanBase64 = fileBase64;
      if (fileBase64.includes(';base64,')) {
        cleanBase64 = fileBase64.split(';base64,')[1];
      }
      
      // Декодируем base64 в буфер с обработкой ошибок
      let fileBuffer;
      try {
        fileBuffer = Buffer.from(cleanBase64, 'base64');
        
        // Проверка, что буфер не пустой
        if (fileBuffer.length === 0) {
          throw new Error("Получен пустой буфер после декодирования base64");
        }
        
        // Проверка разумного размера файла
        const MAX_SIZE = 10 * 1024 * 1024; // 10MB
        if (fileBuffer.length > MAX_SIZE) {
          throw new Error(`Файл слишком большой: ${(fileBuffer.length / (1024 * 1024)).toFixed(2)}MB`);
        }
      } catch (decodeError) {
        console.error("Ошибка декодирования base64:", decodeError);
        throw new Error("Не удалось декодировать файл из формата base64");
      }
      
      // Парсим XLS файл с дополнительной обработкой ошибок
      let parsedData;
      try {
        parsedData = await BybitParser.parseXLSBuffer(fileBuffer);
      } catch (parseError) {
        console.error("Ошибка парсинга XLS:", parseError);
        throw new Error(`Не удалось обработать файл: ${parseError.message}`);
      }
      
      const { transactions, summary } = parsedData;
      
      // Проверка наличия транзакций
      if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
        return {
          success: false,
          message: "В файле не найдено транзакций для обработки",
          summary: {
            addedTransactions: 0,
            skippedTransactions: 0,
            errorTransactions: 0,
            totalProcessed: 0
          }
        };
      }
      
      // Счетчики для статистики
      let addedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      
      // Используем batch операции для оптимизации
      const batchSize = 50; // Обрабатываем по 50 транзакций за раз
      
      for (let i = 0; i < transactions.length; i += batchSize) {
        const batch = transactions.slice(i, i + batchSize);
        
        for (const tx of batch) {
          try {
            // Проверяем наличие необходимых полей
            if (!tx.orderNo) {
              errorCount++;
              continue;
            }
            
            // Используем findFirst вместо создания для каждой записи
            const existingTransaction = await ctx.db.bybitTransaction.findFirst({
              where: {
                orderNo: tx.orderNo,
                userId: userId
              },
              select: { id: true } // Выбираем только ID для оптимизации
            });
            
            // Если транзакция уже существует, пропускаем её
            if (existingTransaction) {
              skippedCount++;
              continue;
            }
            
            // Создаем новую транзакцию
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
            
            addedCount++;
          } catch (txError) {
            errorCount++;
            console.error("Ошибка при обработке транзакции:", txError);
          }
        }
      }
      
      return {
        success: true,
        summary: {
          ...summary,
          addedTransactions: addedCount,
          skippedTransactions: skippedCount,
          errorTransactions: errorCount,
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
          errorTransactions: 0,
          totalProcessed: 0
        }
      };
    }
  }),
});