import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import axios from 'axios';
import dayjs from "dayjs";

// Определение типа контекста для процедур
type Context = { db: any };

// Конфигурация API IDEX
const BASE_URL = 'https://panel.gate.cx';
const MAX_RETRIES = 5;
const BASE_DELAY = 1000;
const DEFAULT_PAGES_TO_FETCH = 25;

interface Cookie {
  domain: string;
  expirationDate: number;
  hostOnly: boolean;
  httpOnly: boolean;
  name: string;
  path: string;
  sameSite?: string;
  secure: boolean;
  session: boolean;
  storeId?: string;
  value: string;
}

interface Transaction {
  id: string;
  payment_method_id: string;
  wallet: string;
  amount: any;
  total: any;
  status: number;
  approved_at?: string;
  expired_at?: string;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

export const idexRouter = createTRPCRouter({
  // Получение всех кабинетов с пагинацией
  getAllCabinets: publicProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      perPage: z.number().int().positive().default(10),
      startDate: z.string().optional(),
      endDate: z.string().optional()
    }))
    .query(async ({ input, ctx }: { input: { page: number; perPage: number; startDate?: string; endDate?: string }; ctx: Context }) => {
      try {
        const { page, perPage, startDate, endDate } = input;
        const skip = (page - 1) * perPage;
        
        // Преобразуем даты с учетом таймзоны
        const startDateTime = startDate ? dayjs(startDate).utc().add(3, 'hour').toISOString() : undefined;
        const endDateTime = endDate ? dayjs(endDate).utc().add(3, 'hour').toISOString() : undefined;
        
        let where = {};
        
        // Add date filter if both dates are provided
        if (startDate && endDate) {
          where = {
            transactions: {
              some: {
                approvedAt: {
                  gte: startDateTime,
                  lte: endDateTime
                }
              }
            }
          };
        }
        
        // Use withRetry for database operations to handle connection issues
        const [cabinets, totalCount] = await Promise.all([
          withRetry(() => ctx.db.idexCabinet.findMany({
            where,
            skip,
            take: perPage,
            orderBy: {
              idexId: 'asc'
            },
            include: {
              _count: {
                select: {
                  transactions: {
                    where: startDate && endDate ? {
                      approvedAt: {
                        gte: startDateTime,
                        lte: endDateTime
                      }
                    } : undefined
                  }
                }
              }
            }
          })),
          withRetry(() => ctx.db.idexCabinet.count({ where }))
        ]);
        const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
        
        return {
          cabinets,
          totalCount,
          totalPages,
          currentPage: page
        };
      } catch (error) {
        console.error("Error fetching cabinets:", error);
        return {
          cabinets: [],
          totalCount: 0,
          totalPages: 1,
          currentPage: 1,
          error: "Failed to fetch cabinets. Database connection error."
        };
      }
    }),
  
  // Получение конкретного кабинета по ID
  getCabinetById: publicProcedure
    .input(z.object({
      id: z.number().int().positive(),
    }))
    .query(async ({ input, ctx }: { input: { id: number }; ctx: Context }) => {
      const cabinet = await ctx.db.idexCabinet.findUnique({
        where: { id: input.id },
        include: {
          _count: {
            select: {
              transactions: true
            }
          }
        }
      });
      
      if (!cabinet) {
        return {
          success: false,
          message: "Кабинет не найден"
        };
      }
      
      return {
        success: true,
        cabinet
      };
    }),
  
  // Создание нового кабинета
  createCabinet: publicProcedure
    .input(z.object({
      idexId: z.number().int().positive(),
      login: z.string().min(1),
      password: z.string().min(1)
    }))
    .mutation(async ({ input, ctx }: { input: { idexId: number; login: string; password: string }; ctx: Context }) => {
      const { idexId, login, password } = input;
      
      // Проверяем существует ли кабинет с такими данными
      const existingCabinet = await ctx.db.idexCabinet.findFirst({
        where: {
          OR: [
            { idexId },
            { login }
          ]
        }
      });
      
      if (existingCabinet) {
        if (existingCabinet.idexId === idexId) {
          throw new Error(`Кабинет с IDEX ID ${idexId} уже существует`);
        } else {
          throw new Error(`Кабинет с логином ${login} уже существует`);
        }
      }
      
      // Проверяем валидность учетных данных, пытаясь авторизоваться
      try {
        await login({ login, password });
        console.log(`Успешная авторизация для кабинета ${login}`);
      } catch (error: any) {
        throw new Error(`Ошибка авторизации: ${error.message}`);
      }
      
      const cabinet = await ctx.db.idexCabinet.create({
        data: {
          idexId,
          login,
          password
        }
      });
      
      return {
        success: true,
        cabinet
      };
    }),
  
  // Удаление кабинета
  deleteCabinet: publicProcedure
    .input(z.object({
      id: z.number().int().positive()
    }))
    .mutation(async ({ input, ctx }: { input: { id: number }; ctx: Context }) => {
      const cabinet = await ctx.db.idexCabinet.findUnique({
        where: { id: input.id },
        include: {
          _count: {
            select: {
              transactions: true
            }
          }
        }
      });
      
      if (!cabinet) {
        throw new Error("Кабинет не найден");
      }
      
      // Если у кабинета есть транзакции, спрашиваем подтверждение (на клиенте)
      
      // Удаляем кабинет
      await ctx.db.idexCabinet.delete({
        where: { id: input.id }
      });
      
      return {
        success: true,
        message: "Кабинет успешно удален"
      };
    }),
  
  // Получение транзакций кабинета с пагинацией и фильтрацией
  getCabinetTransactions: publicProcedure
    .input(z.object({
      cabinetId: z.number().int().positive(),
      page: z.number().int().positive().default(1),
      perPage: z.number().int().positive().default(10),
      timeFilter: z.union([
        z.object({
          preset: z.enum([
            "last12h",
            "last24h", 
            "today", 
            "yesterday", 
            "thisWeek", 
            "last2days", 
            "thisMonth"
          ])
        }),
        z.object({
          startDate: z.string().optional(),
          endDate: z.string().optional()
        })
      ]).optional(),
      status: z.string().optional(),
      searchQuery: z.string().optional()
    }))
    .query(async ({ input, ctx }: { 
      input: { 
        cabinetId: number; 
        page: number; 
        perPage: number; 
        timeFilter?: { 
          preset?: string; 
          startDate?: string; 
          endDate?: string; 
        }; 
        status?: string; 
        searchQuery?: string; 
      }; 
      ctx: Context 
    }) => {
      const { cabinetId, page, perPage, timeFilter, status, searchQuery } = input;
      const skip = (page - 1) * perPage;
      
      // Строим условие where с учетом фильтров
      const whereCondition: any = { cabinetId };
      
      // Обрабатываем фильтр статуса
      if (status && status !== "") {
        whereCondition.status = parseInt(status);
      }
      
      // Обрабатываем фильтр поиска
      if (searchQuery && searchQuery !== "") {
        whereCondition.OR = [
          { id: { equals: Number(searchQuery) || undefined } },
          { externalId: { equals: searchQuery } },
          { paymentMethodId: { equals: searchQuery } },
        ];
      }
      
      // Обрабатываем фильтр времени
      if (timeFilter) {
        const dateFilter: any = {};
        
        if ('preset' in timeFilter) {
          const now = new Date();
          let startDate: Date;
          const endDate = new Date();
          
          switch (timeFilter.preset) {
            case 'last12h':
              startDate = new Date(now.getTime() - 12 * 60 * 60 * 1000);
              break;
            case 'last24h':
              startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
              break;
            case 'today':
              startDate = new Date(now.setHours(0, 0, 0, 0));
              break;
            case 'yesterday':
              startDate = new Date(now.setHours(0, 0, 0, 0));
              startDate.setDate(startDate.getDate() - 1);
              endDate.setHours(0, 0, 0, 0);
              break;
            case 'thisWeek':
              startDate = new Date(now);
              startDate.setDate(now.getDate() - now.getDay());
              startDate.setHours(0, 0, 0, 0);
              break;
            case 'last2days':
              startDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
              break;
            case 'thisMonth':
              startDate = new Date(now.getFullYear(), now.getMonth(), 1);
              break;
            default:
              startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // По умолчанию last24h
          }
          
          whereCondition.approvedAt = {
            gte: startDate.toISOString(),
            lte: endDate.toISOString()
          };
        } else {
          if (timeFilter.startDate || timeFilter.endDate) {
            whereCondition.approvedAt = {};
            
            if (timeFilter.startDate) {
              whereCondition.approvedAt.gte = new Date(timeFilter.startDate).toISOString();
            }
            
            if (timeFilter.endDate) {
              whereCondition.approvedAt.lte = new Date(timeFilter.endDate).toISOString();
            }
          }
        }
      }
      
      // Получаем количество транзакций
      const totalCount = await ctx.db.idexTransaction.count({
        where: whereCondition
      });
      
      // Вычисляем общее количество страниц
      const totalPages = Math.max(1, Math.ceil(totalCount / perPage));

      const transactions_ = await ctx.db.idexTransaction.findMany({
        where: whereCondition,
        select: {
          amount: true,
          total: true
        }
      });
      
      const result = transactions_.reduce((acc: any, transaction: any) => {
        try {
          // Parse amount field
          const amount = typeof transaction.amount === 'string' 
            ? JSON.parse(transaction.amount) 
            : transaction.amount;
            
          // Parse total field
          const total = typeof transaction.total === 'string'
            ? JSON.parse(transaction.total)
            : transaction.total;
            
          // Extract values
          const amountRub = amount?.trader?.["643"] || 0;
          const amountUsdt = amount?.trader?.["000001"] || 0;
          const totalRub = total?.trader?.["643"] || 0;
          const totalUsdt = total?.trader?.["000001"] || 0;
          
          return {
            amountRub: acc.amountRub + parseFloat(amountRub),
            amountUsdt: acc.amountUsdt + parseFloat(amountUsdt),
            totalRub: acc.totalRub + parseFloat(totalRub),
            totalUsdt: acc.totalUsdt + parseFloat(totalUsdt)
          };
        } catch (e) {
          console.error("Error parsing transaction fields:", e);
          return acc;
        }
      }, { amountRub: 0, amountUsdt: 0, totalRub: 0, totalUsdt: 0 });
      
      // Получаем транзакции с пагинацией
      const transactions = await ctx.db.idexTransaction.findMany({
        where: whereCondition,
        orderBy: {
          approvedAt: 'desc'
        },
        skip,
        take: perPage
      });
      
      return {
        transactions,
        totalCount,
        totalPages,
        currentPage: page,
        totalAmountRub: result.amountRub,
        totalAmountUsdt: result.amountUsdt,
        totalTotalRub: result.totalRub,
        totalTotalUsdt: result.totalUsdt
      };
    }),
  
  // Создание запроса на синхронизацию всех кабинетов
  createSyncAllCabinetsOrder: publicProcedure
    .input(z.object({
      pages: z.number().int().min(1).max(100).default(10)
    }))
    .mutation(async ({ input, ctx }: { 
      input: { 
        pages: number; 
      }; 
      ctx: Context 
    }) => {
      try {
        // Получаем все кабинеты
        const cabinets = await ctx.db.idexCabinet.findMany();
        
        if (cabinets.length === 0) {
          return {
            success: false,
            message: "Нет кабинетов для синхронизации"
          };
        }
        
        // Создаем запись о синхронизации
        const syncOrder = await ctx.db.idexSyncOrder.create({
          data: {
            cabinetId: null, // null означает все кабинеты
            status: "PENDING",
            pages: [input.pages], // Сохраняем количество страниц как массив
            processed: {}, // Пустой объект для будущего заполнения результатами
          }
        });
        
        return {
          success: true,
          orderId: syncOrder.id,
          message: `Запрос на синхронизацию всех кабинетов добавлен в очередь. ID запроса: ${syncOrder.id}`
        };
      } catch (error: any) {
        console.error("Ошибка создания запроса синхронизации:", error);
        throw new Error(`Ошибка создания запроса: ${error.message}`);
      }
    }),

  // Создание запроса на синхронизацию конкретного кабинета
  createSyncCabinetOrder: publicProcedure
    .input(z.object({
      cabinetId: z.number().int().positive(),
      pages: z.number().int().min(1).max(100).default(10)
    }))
    .mutation(async ({ input, ctx }: { 
      input: { 
        cabinetId: number; 
        pages: number; 
      }; 
      ctx: Context 
    }) => {
      try {
        const cabinet = await ctx.db.idexCabinet.findUnique({
          where: { id: input.cabinetId }
        });
        
        if (!cabinet) {
          throw new Error("Кабинет не найден");
        }
        
        // Создаем запись о синхронизации
        const syncOrder = await ctx.db.idexSyncOrder.create({
          data: {
            cabinetId: input.cabinetId,
            status: "PENDING",
            pages: [input.pages],
            processed: {},
          }
        });
        
        return {
          success: true,
          orderId: syncOrder.id,
          message: `Запрос на синхронизацию кабинета #${cabinet.idexId} добавлен в очередь. ID запроса: ${syncOrder.id}`
        };
      } catch (error: any) {
        console.error(`Ошибка создания запроса синхронизации кабинета ID ${input.cabinetId}:`, error);
        throw new Error(`Ошибка создания запроса: ${error.message}`);
      }
    }),

  // Получение истории синхронизаций с пагинацией
  getSyncHistory: publicProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      perPage: z.number().int().positive().default(10),
      status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED"]).optional(),
    }))
    .query(async ({ input, ctx }: { 
      input: { 
        page: number; 
        perPage: number; 
        status?: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED"; 
      }; 
      ctx: Context 
    }) => {
      try {
        const { page, perPage, status } = input;
        const skip = (page - 1) * perPage;
        
        // Условия фильтрации
        const where: any = {};
        if (status) {
          where.status = status;
        }
        
        // Получение общего количества записей
        const totalCount = await ctx.db.idexSyncOrder.count({ where });
        const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
        
        // Получение записей с пагинацией
        const syncOrders = await ctx.db.idexSyncOrder.findMany({
          where,
          orderBy: {
            createdAt: 'desc' // Сортировка от новых к старым
          },
          skip,
          take: perPage,
          include: {
            cabinet: true // Включаем данные о кабинете
          }
        });
        
        return {
          syncOrders,
          totalCount,
          totalPages,
          currentPage: page
        };
      } catch (error: any) {
        console.error("Ошибка получения истории синхронизаций:", error);
        throw new Error(`Ошибка получения истории: ${error.message}`);
      }
    }),

  // Получение детальной информации о конкретном запросе синхронизации
  getSyncOrderDetails: publicProcedure
    .input(z.object({
      orderId: z.number().int().positive()
    }))
    .query(async ({ input, ctx }: { 
      input: { 
        orderId: number; 
      }; 
      ctx: Context 
    }) => {
      try {
        const syncOrder = await ctx.db.idexSyncOrder.findUnique({
          where: { id: input.orderId },
          include: {
            cabinet: true
          }
        });
        
        if (!syncOrder) {
          throw new Error("Запрос на синхронизацию не найден");
        }
        
        return {
          success: true,
          order: syncOrder
        };
      } catch (error: any) {
        console.error(`Ошибка получения информации о запросе ID ${input.orderId}:`, error);
        throw new Error(`Ошибка получения информации: ${error.message}`);
      }
    }),

  // Синхронизация всех кабинетов
  syncAllCabinets: publicProcedure
    .input(z.object({
      pages: z.number().int().min(1).max(100).default(10)
    }))
    .mutation(async ({ input, ctx }: { 
      input: { 
        pages: number; 
      }; 
      ctx: Context 
    }) => {
      try {
        // Создаем запись о синхронизации
        const syncOrder = await ctx.db.idexSyncOrder.create({
          data: {
            cabinetId: null, // null означает все кабинеты
            status: "PENDING",
            pages: [input.pages],
            processed: {},
          }
        });
        
        return {
          success: true,
          orderId: syncOrder.id,
          message: `Запрос на синхронизацию всех кабинетов добавлен в очередь. ID запроса: ${syncOrder.id}`
        };
      } catch (error: any) {
        console.error("Ошибка создания запроса синхронизации:", error);
        throw new Error(`Ошибка создания запроса: ${error.message}`);
      }
    }),

  // Синхронизация конкретного кабинета
  syncCabinetById: publicProcedure
    .input(z.object({
      cabinetId: z.number().int().positive(),
      pages: z.number().int().min(1).max(100).default(10)
    }))
    .mutation(async ({ input, ctx }: { 
      input: { 
        cabinetId: number; 
        pages: number; 
      }; 
      ctx: Context 
    }) => {
      try {
        const cabinet = await ctx.db.idexCabinet.findUnique({
          where: { id: input.cabinetId }
        });
        
        if (!cabinet) {
          throw new Error("Кабинет не найден");
        }
        
        // Создаем запись о синхронизации
        const syncOrder = await ctx.db.idexSyncOrder.create({
          data: {
            cabinetId: input.cabinetId,
            status: "PENDING",
            pages: [input.pages],
            processed: {},
          }
        });
        
        return {
          success: true,
          orderId: syncOrder.id,
          message: `Запрос на синхронизацию кабинета #${cabinet.idexId} добавлен в очередь. ID запроса: ${syncOrder.id}`
        };
      } catch (error: any) {
        console.error(`Ошибка создания запроса синхронизации кабинета ID ${input.cabinetId}:`, error);
        throw new Error(`Ошибка создания запроса: ${error.message}`);
      }
    }),
    
  // Получение статистики
  getIdexStats: publicProcedure
    .query(async ({ ctx }: { ctx: Context }) => {
      try {
        // Получаем общее количество кабинетов
        const totalCabinets = await ctx.db.idexCabinet.count();
        
        // Получаем общее количество транзакций
        const totalTransactions = await ctx.db.idexTransaction.count();
        
        // Получаем статистику по статусам транзакций
        const statusStats = await ctx.db.idexTransaction.groupBy({
          by: ['status'],
          _count: {
            _all: true
          }
        });
        
        // Получаем последнюю синхронизированную транзакцию
        const lastTransaction = await ctx.db.idexTransaction.findFirst({
          orderBy: {
            updatedAt: 'desc'
          },
          select: {
            updatedAt: true,
            cabinetId: true,
            cabinet: {
              select: {
                login: true
              }
            }
          }
        });
        
        return {
          totalCabinets,
          totalTransactions,
          statusStats: statusStats.map(stat => ({
            status: stat.status,
            count: stat._count._all
          })),
          lastSync: lastTransaction ? {
            date: lastTransaction.updatedAt,
            cabinetId: lastTransaction.cabinetId,
            cabinetLogin: lastTransaction.cabinet.login
          } : null
        };
      } catch (error: any) {
        console.error("Ошибка получения статистики IDEX:", error);
        throw new Error(`Ошибка получения статистики: ${error.message}`);
      }
    }),
    
  // Сопоставление транзакции IDEX с системной транзакцией
  matchTransaction: publicProcedure
    .input(z.object({
      idexTransactionId: z.number().int().positive(),
      systemTransactionId: z.number().int().positive()
    }))
    .mutation(async ({ input, ctx }: { 
      input: { 
        idexTransactionId: number; 
        systemTransactionId: number; 
      }; 
      ctx: Context 
    }) => {
      try {
        // Проверяем, существует ли IDEX транзакция
        const idexTransaction = await ctx.db.idexTransaction.findUnique({
          where: { id: input.idexTransactionId }
        });
        
        if (!idexTransaction) {
          throw new Error("IDEX транзакция не найдена");
        }
        
        // Проверяем, существует ли системная транзакция
        const systemTransaction = await ctx.db.transaction.findUnique({
          where: { id: input.systemTransactionId }
        });
        
        if (!systemTransaction) {
          throw new Error("Системная транзакция не найдена");
        }
        
        // Проверяем, не сопоставлена ли уже IDEX транзакция
        const existingMatch = await ctx.db.match.findFirst({
          where: { idexTransactionId: input.idexTransactionId }
        });
        
        if (existingMatch) {
          throw new Error("IDEX транзакция уже сопоставлена");
        }
        
        // Проверяем, не сопоставлена ли уже системная транзакция
        const existingSystemMatch = await ctx.db.match.findFirst({
          where: { transactionId: input.systemTransactionId }
        });
        
        if (existingSystemMatch) {
          throw new Error("Системная транзакция уже сопоставлена");
        }
        
        // Рассчитываем разницу во времени в секундах
        const approvedAt = idexTransaction.approvedAt ? new Date(idexTransaction.approvedAt) : new Date();
        const dateTime = systemTransaction.dateTime;
        const timeDifference = Math.round(Math.abs(approvedAt.getTime() - dateTime.getTime()) / 1000);
        
        // Рассчитываем финансовые показатели
        const COMMISSION = 1.009; // Комиссия 0.9%
        const amount = systemTransaction.amount || 0;
        const grossExpense = amount * COMMISSION;
        
        // Парсим поле total для получения суммы
        let totalUsdt = 0;
        try {
          // Проверяем, является ли total строкой JSON
          if (typeof idexTransaction.total === 'string') {
            const totalJson = JSON.parse(idexTransaction.total);
            totalUsdt = parseFloat(totalJson.trader?.["000001"] || 0);
          } else {
            // Если total уже является объектом
            totalUsdt = parseFloat(idexTransaction.total.trader?.["000001"] || 0);
          }
        } catch (error) {
          console.error('Ошибка при парсинге JSON поля total:', error);
        }
        
        const grossIncome = totalUsdt;
        const grossProfit = grossIncome - grossExpense;
        const profitPercentage = grossExpense ? (grossProfit / grossExpense) * 100 : 0;
        
        // Создаем запись о сопоставлении
        const match = await ctx.db.match.create({
          data: {
            idexTransactionId: input.idexTransactionId,
            transactionId: input.systemTransactionId,
            timeDifference,
            grossExpense,
            grossIncome,
            grossProfit,
            profitPercentage
          }
        });
        
        return {
          success: true,
          match
        };
      } catch (error: any) {
        console.error("Ошибка сопоставления транзакций:", error);
        throw new Error(`Ошибка сопоставления: ${error.message}`);
      }
    }),
    
  // Отмена сопоставления транзакции
  unmatchTransaction: publicProcedure
    .input(z.object({
      idexTransactionId: z.number().int().positive()
    }))
    .mutation(async ({ input, ctx }: { 
      input: { 
        idexTransactionId: number; 
      }; 
      ctx: Context 
    }) => {
      try {
        // Проверяем, существует ли сопоставление
        const match = await ctx.db.match.findFirst({
          where: { idexTransactionId: input.idexTransactionId }
        });
        
        if (!match) {
          throw new Error("Сопоставление не найдено");
        }
        
        // Удаляем сопоставление
        await ctx.db.match.delete({
          where: { id: match.id }
        });
        
        return {
          success: true,
          message: "Сопоставление успешно отменено"
        };
      } catch (error: any) {
        console.error("Ошибка отмены сопоставления:", error);
        throw new Error(`Ошибка отмены сопоставления: ${error.message}`);
      }
    })
});

// Вспомогательные функции для работы с API IDEX

/**
 * Авторизовывается в IDEX и получает куки для доступа
 * @param credentials Учетные данные для авторизации
 * @returns Куки для доступа к API IDEX
 */
async function login(credentials: { login: string; password: string }): Promise<Cookie[]> {
  const loginUrl = `${BASE_URL}/api/v1/auth/basic/login`;
  
  let retryCount = 0;
  let delay = BASE_DELAY;
  
  while (true) {
    try {
      const response = await axios.post(loginUrl, credentials);
      
      if (response.status === 200) {
        const cookies = response.headers['set-cookie'] || [];
        
        if (cookies.length === 0) {
          throw new Error('Не получены куки после авторизации');
        }
        
        const result: Cookie[] = [];
        
        for (const cookieStr of cookies) {
          const cookieParts = cookieStr.split(';')[0].split('=');
          const name = cookieParts[0];
          const value = cookieParts.slice(1).join('=');
          
          if (name === 'sid' || name === 'rsid') {
            const cookie: Cookie = {
              domain: '.panel.gate.cx',
              expirationDate: Date.now() / 1000 + 86400, // Время жизни 1 день
              hostOnly: false,
              httpOnly: true,
              name,
              path: '/',
              secure: true,
              session: false,
              value
            };
            
            result.push(cookie);
          }
        }
        
        if (result.length < 2) {
          throw new Error('Отсутствуют необходимые куки (sid и/или rsid)');
        }
        
        return result;
      } else if (response.status === 429) {
        // Слишком много запросов
        if (retryCount >= MAX_RETRIES) {
          throw new Error('Превышено максимальное количество попыток. Последний статус: 429 Too Many Requests');
        }
        
        const retryAfter = parseInt(response.headers['retry-after'] || String(delay));
        console.warn(`Ограничение скорости (429). Ожидание ${retryAfter}мс перед повторной попыткой. Попытка ${retryCount + 1}/${MAX_RETRIES}`);
        
        await new Promise(resolve => setTimeout(resolve, retryAfter));
        
        retryCount++;
        delay *= 2; // Экспоненциальное увеличение задержки
      } else {
        throw new Error(`Авторизация не удалась со статусом: ${response.status}`);
      }
    } catch (error: any) {
      if (error.response?.status === 429) {
        // Обработка случая, когда axios выбрасывает ошибку вместо возврата ответа
        if (retryCount >= MAX_RETRIES) {
          throw new Error('Превышено максимальное количество попыток. Последний статус: 429 Too Many Requests');
        }
        
        const retryAfter = parseInt(error.response.headers['retry-after'] || String(delay));
        console.warn(`Ограничение скорости (429). Ожидание ${retryAfter}мс перед повторной попыткой. Попытка ${retryCount + 1}/${MAX_RETRIES}`);
        
        await new Promise(resolve => setTimeout(resolve, retryAfter));
        
        retryCount++;
        delay *= 2; // Экспоненциальное увеличение задержки
      } else {
        throw error;
      }
    }
  }
}

/**
 * Получает страницу транзакций из IDEX API
 * @param cookies Куки для авторизации
 * @param page Номер страницы
 * @returns Массив транзакций
 */
async function fetchTransactionsPage(cookies: Cookie[], page: number): Promise<Transaction[]> {
  const cookieStr = cookies
    .map(c => `${c.name}=${c.value}`)
    .join('; ');
  
  const transactionsUrl = `${BASE_URL}/api/v1/payments/payouts?filters%5Bstatus%5D%5B%5D=2&filters%5Bstatus%5D%5B%5D=3&filters%5Bstatus%5D%5B%5D=7&filters%5Bstatus%5D%5B%5D=8&filters%5Bstatus%5D%5B%5D=9&page=${page}`;
  
  let retryCount = 0;
  let delay = BASE_DELAY;
  
  while (true) {
    try {
      const response = await axios.get(transactionsUrl, {
        headers: {
          Cookie: cookieStr
        }
      });
      
      if (response.status === 200) {
        const json = response.data;
        
        let data;
        if (Array.isArray(json.data)) {
          data = json.data;
        } else if (json.response?.payouts?.data && Array.isArray(json.response.payouts.data)) {
          data = json.response.payouts.data;
        } else {
          throw new Error('Неожиданная структура ответа');
        }
        
        return data as Transaction[];
      } else if (response.status === 429) {
        // Слишком много запросов
        if (retryCount >= MAX_RETRIES) {
          throw new Error('Превышено максимальное количество попыток. Последний статус: 429 Too Many Requests');
        }
        
        const retryAfter = parseInt(response.headers['retry-after'] || String(delay));
        console.warn(`Ограничение скорости (429). Ожидание ${retryAfter}мс перед повторной попыткой. Попытка ${retryCount + 1}/${MAX_RETRIES}`);
        
        await new Promise(resolve => setTimeout(resolve, retryAfter));
        
        retryCount++;
        delay *= 2; // Экспоненциальное увеличение задержки
      } else {
        throw new Error(`Не удалось получить транзакции: ${response.status}`);
      }
    } catch (error: any) {
      if (error.response?.status === 429) {
        // Обработка случая, когда axios выбрасывает ошибку вместо возврата ответа
        if (retryCount >= MAX_RETRIES) {
          throw new Error('Превышено максимальное количество попыток. Последний статус: 429 Too Many Requests');
        }
        
        const retryAfter = parseInt(error.response.headers['retry-after'] || String(delay));
        console.warn(`Ограничение скорости (429). Ожидание ${retryAfter}мс перед повторной попыткой. Попытка ${retryCount + 1}/${MAX_RETRIES}`);
        
        await new Promise(resolve => setTimeout(resolve, retryAfter));
        
        retryCount++;
        delay *= 2; // Экспоненциальное увеличение задержки
      } else {
        throw error;
      }
    }
  }
}

/**
 * Получает все транзакции из IDEX API
 * @param cookies Куки для авторизации
 * @param pages Количество страниц для получения
 * @returns Массив транзакций
 */
async function fetchTransactions(cookies: Cookie[], pages: number = DEFAULT_PAGES_TO_FETCH, db: any): Promise<Transaction[]> {
  const allTransactions: Transaction[] = [];
  
  for (let page = 1; page <= pages; page++) {
    console.info(`Получение страницы ${page} из ${pages}`);
    
    // Добавляем задержку между запросами страниц для предотвращения ограничения скорости
    if (page > 1) {
      await new Promise(resolve => setTimeout(resolve, BASE_DELAY));
    }
    
    try {
      const transactions = await fetchTransactionsPage(cookies, page);
      console.info(`Найдено ${transactions.length} транзакций на странице ${page}`);
      
      // Проверяем, есть ли транзакции уже в базе данных
      if (transactions.length > 0) {
        const externalIds = transactions.map(t => t.id);
        const existingTransactions = await withRetry(() => db.idexTransaction.findMany({
          where: {
            externalId: { in: externalIds }
          },
          select: { externalId: true }
        }));
        
        const existingIds = new Set(existingTransactions.map(t => t.externalId));
        const newTransactions = transactions.filter(t => !existingIds.has(t.id));
        
        console.info(`Найдено ${newTransactions.length} новых транзакций на странице ${page}`);
        allTransactions.push(...newTransactions);
        
        // Если все транзакции на странице уже есть в базе данных, прекращаем получение
        if (newTransactions.length === 0) {
          console.info(`Все транзакции на странице ${page} уже существуют в базе данных. Прекращаем получение.`);
          break;
        }
      }
      
    } catch (error) {
      console.warn(`Ошибка получения страницы ${page}: ${error}`);
      // Продолжаем со следующей страницей вместо полного прерывания
    }
  }
  
  return allTransactions;
}

/**
 * Сохраняет транзакции в базу данных
 * @param transactions Массив транзакций
 * @param cabinetId ID кабинета
 * @param db Экземпляр Prisma клиента
 */
async function saveTransactions(transactions: Transaction[], cabinetId: number, db: any): Promise<any[]> {
  // Получаем существующие транзакции для этого кабинета
  const existingTransactions = await withRetry(() => db.idexTransaction.findMany({
    where: { cabinetId },
    select: { externalId: true, cabinetId: true }
  }));

  console.info(`Найдено ${existingTransactions.length} существующих транзакций для кабинета ${cabinetId}`);
  
  // Создаем набор уникальных идентификаторов [externalId, cabinetId]
  const existingPairs = new Set(
    existingTransactions.map(t => `${t.externalId.toString()}_${t.cabinetId}`)
  );

  // Фильтруем транзакции, которые уже существуют в БД
  const newTransactions = transactions.filter(t => !existingPairs.has(`${t.id}_${cabinetId}`));
  
  if (newTransactions.length === 0) {
    console.info(`Нет новых транзакций для сохранения для кабинета ${cabinetId}`);
    return [];
  }
  
  // Сохраняем новые транзакции
  const savedTransactions = await Promise.all(
    newTransactions.map(async transaction => {
      const { id, payment_method_id, wallet, amount, total, status, approved_at, expired_at, created_at, updated_at, ...extraData } = transaction;
      
      return withRetry(() => db.idexTransaction.create({
        data: {
          externalId: BigInt(id),
          paymentMethodId: BigInt(payment_method_id),
          wallet,
          amount,
          total,
          status,
          approvedAt: approved_at ? new Date(new Date(approved_at).getTime() + 3 * 60 * 60 * 1000).toISOString() : null,
          expiredAt: expired_at ? new Date(new Date(expired_at).getTime() + 3 * 60 * 60 * 1000).toISOString() : null,
          createdAtExternal: created_at,
          updatedAtExternal: updated_at,
          extraData: extraData as any,
          cabinetId
        }
      }));
    })
  );
  
  console.info(`Сохранено ${savedTransactions.length} новых транзакций для кабинета ${cabinetId} (всего: ${existingTransactions.length + savedTransactions.length})`);
  return savedTransactions;
}

/**
 * Выполняет функцию с автоматическим повтором при ошибках подключения к базе данных
 * @param fn Функция для выполнения
 * @param retries Количество повторных попыток
 * @param delay Задержка между попытками в мс
 * @returns Результат выполнения функции
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (
      retries > 0 && 
      error?.code === 'P1001' && // Код ошибки соединения с базой данных Prisma
      error?.message?.includes("Can't reach database server")
    ) {
      console.info(`Проблема с подключением к базе данных. Повторная попытка через ${delay}мс. Осталось попыток: ${retries}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 1.5); // Увеличиваем задержку при каждой новой попытке
    }
    throw error;
  }
}

/**
 * Синхронизирует транзакции для одного кабинета
 * @param cabinet Кабинет IDEX
 * @param pages Количество страниц для получения
 * @param db Экземпляр Prisma клиента
 */
async function syncCabinetTransactions(cabinet: any, pages: number = DEFAULT_PAGES_TO_FETCH, db: any): Promise<any[]> {
  console.info(`Обработка кабинета ${cabinet.login}`);
  
  const cookies = await login({
    login: cabinet.login,
    password: cabinet.password
  });
  
  console.info(`Успешная авторизация для кабинета ${cabinet.login}`);
  
  // Добавляем задержку перед запросом транзакций
  await new Promise(resolve => setTimeout(resolve, BASE_DELAY));
  
  const transactions = await fetchTransactions(cookies, pages, db);
  const savedTransactions = await saveTransactions(transactions, cabinet.id, db);
  
  console.info(`Обработаны транзакции для кабинета ${cabinet.login}`);
  
  return transactions;
}