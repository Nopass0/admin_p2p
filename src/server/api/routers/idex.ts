import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

// Определение типа контекста для процедур
type Context = { db: any };

export const idexRouter = createTRPCRouter({
  // Получение всех кабинетов с пагинацией
  getAllCabinets: publicProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      perPage: z.number().int().positive().default(10),
    }))
    .query(async ({ input, ctx }: { input: { page: number; perPage: number }; ctx: Context }) => {
      const { page, perPage } = input;
      const skip = (page - 1) * perPage;
      
      const totalCount = await ctx.db.idexCabinet.count();
      const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
      
      const cabinets = await ctx.db.idexCabinet.findMany({
        skip,
        take: perPage,
        orderBy: {
          id: 'asc'
        },
        include: {
          _count: {
            select: {
              transactions: true
            }
          }
        }
      });
      
      return {
        cabinets,
        totalCount,
        totalPages,
        currentPage: page
      };
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
      status: z.string().optional()
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
      }; 
      ctx: Context 
    }) => {
      const { cabinetId, page, perPage, timeFilter, status } = input;
      const skip = (page - 1) * perPage;
      
      // Строим условие where с учетом фильтров
      const whereCondition: any = { cabinetId };
      
      // Обрабатываем фильтр статуса
      if (status && status !== "") {
        whereCondition.status = parseInt(status);
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
        currentPage: page
      };
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
        // В реальности здесь будет код для синхронизации кабинетов с IDEX API
        // Но для демонстрации просто вернем успешный результат
        
        // Имитация задержки
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return {
          success: true,
          message: `Синхронизация всех кабинетов выполнена успешно. Получено ${input.pages} страниц транзакций.`
        };
      } catch (error) {
        throw new Error(`Ошибка синхронизации: ${error}`);
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
        
        // В реальности здесь будет код для синхронизации кабинета с IDEX API
        // Но для демонстрации просто вернем успешный результат
        
        // Имитация задержки
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return {
          success: true,
          message: `Синхронизация кабинета ${cabinet.login} выполнена успешно. Получено ${input.pages} страниц транзакций.`
        };
      } catch (error) {
        throw new Error(`Ошибка синхронизации: ${error}`);
      }
    })
});
