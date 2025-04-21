import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";
import { Prisma } from "@prisma/client";

export const usersRouter = createTRPCRouter({
  // Простое получение списка всех пользователей без пагинации
  getUsers: publicProcedure
    .query(async ({ ctx }) => {
      try {
        const users = await ctx.db.user.findMany({
          select: {
            id: true,
            name: true,
            passCode: true,
            isActive: true,
          },
          orderBy: { name: 'asc' },
        });
        return users;
      } catch (error) {
        console.error("Ошибка при получении списка пользователей:", error);
        return [];
      }
    }),
    
  // Получение списка всех пользователей с пагинацией
  getAllUsers: publicProcedure
    .input(z.object({ 
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().default(10),
      searchQuery: z.string().optional()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const { page, pageSize, searchQuery } = input;
        
        // Базовый фильтр
        let where: Prisma.UserWhereInput = {};
        
        // Добавляем поиск по имени и паскоду, если указан searchQuery
        if (searchQuery) {
          where = {
            OR: [
              { name: { contains: searchQuery, mode: 'insensitive' as Prisma.QueryMode } },
              { passCode: { contains: searchQuery, mode: 'insensitive' as Prisma.QueryMode } }
            ]
          };
        }
          
        // Получаем общее количество пользователей для пагинации
        const totalUsers = await ctx.db.user.count({ where });
        
        // Рассчитываем общее количество страниц
        const totalPages = Math.ceil(totalUsers / pageSize);
        
        // Получаем пользователей с пагинацией
        const users = await ctx.db.user.findMany({
          where,
          include: {
            telegramAccounts: true,
          },
          //skip: (page - 1) * pageSize,
          //take: pageSize,
          orderBy: { createdAt: 'desc' },
        });

        return { 
          success: true, 
          users, 
          pagination: {
            totalUsers,
            totalPages,
            currentPage: page,
            pageSize
          }
        };
      } catch (error) {
        console.error("Ошибка при получении списка пользователей:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при получении списка пользователей", 
          users: [],
          pagination: {
            totalUsers: 0,
            totalPages: 0,
            currentPage: input.page,
            pageSize: input.pageSize
          }
        };
      }
    }),


  // Получение информации о конкретном пользователе
  getUserById: publicProcedure
    .input(z.object({ 
      userId: z.number().int().positive() 
    }))
    .query(async ({ ctx, input }) => {
      try {
        const user = await ctx.db.user.findUnique({
          where: { id: input.userId },
          include: {
            telegramAccounts: true,
            transactions: {
              take: 5,
              orderBy: { dateTime: 'desc' }
            },
            workSessions: {
              take: 5,
              orderBy: { startTime: 'desc' }
            },
            reportNotifications: {
              take: 5,
              orderBy: { notificationTime: 'desc' }
            }
          },
        });

        if (!user) {
          return { 
            success: false, 
            message: "Пользователь не найден", 
            user: null 
          };
        }

        return { 
          success: true, 
          user 
        };
      } catch (error) {
        console.error("Ошибка при получении данных пользователя:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при получении данных пользователя", 
          user: null 
        };
      }
    }),

  // Создание нового пользователя
  createUser: publicProcedure
    .input(z.object({ 
      name: z.string().min(1, "Имя пользователя обязательно") 
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Генерируем код доступа (6 цифр)
        const passCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Создаем нового пользователя
        const newUser = await ctx.db.user.create({
          data: {
            name: input.name,
            passCode,
            isActive: true
          },
        });

        return { 
          success: true, 
          message: "Пользователь успешно создан", 
          user: newUser 
        };
      } catch (error) {
        console.error("Ошибка при создании пользователя:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при создании пользователя", 
          user: null 
        };
      }
    }),

  // Обновление данных пользователя
  updateUser: publicProcedure
    .input(z.object({ 
      userId: z.number().int().positive(),
      name: z.string().min(1, "Имя пользователя обязательно"),
      isActive: z.boolean()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const updatedUser = await ctx.db.user.update({
          where: { id: input.userId },
          data: {
            name: input.name,
            isActive: input.isActive
          },
          include: { telegramAccounts: true }
        });

        return { 
          success: true, 
          message: "Данные пользователя успешно обновлены", 
          user: updatedUser 
        };
      } catch (error) {
        console.error("Ошибка при обновлении данных пользователя:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при обновлении данных пользователя", 
          user: null 
        };
      }
    }),

  // Установка статуса активности пользователя
  setUserActiveStatus: publicProcedure
    .input(z.object({ 
      userId: z.number().int().positive(),
      isActive: z.boolean()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const updatedUser = await ctx.db.user.update({
          where: { id: input.userId },
          data: { isActive: input.isActive },
          include: { telegramAccounts: true }
        });

        return { 
          success: true, 
          message: input.isActive ? "Пользователь активирован" : "Пользователь деактивирован", 
          user: updatedUser 
        };
      } catch (error) {
        console.error("Ошибка при изменении статуса пользователя:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при изменении статуса пользователя", 
          user: null 
        };
      }
    }),

  // Генерация нового кода доступа для пользователя
  regeneratePassCode: publicProcedure
    .input(z.object({
      userId: z.number().int().positive()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Генерируем новый пасскод (6 цифр)
        const newPassCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Обновляем пользователя с новым пасскодом
        const updatedUser = await ctx.db.user.update({
          where: { id: input.userId },
          data: { passCode: newPassCode },
          include: {
            telegramAccounts: true,
          }
        });
        
        return { 
          success: true, 
          user: updatedUser 
        };
      } catch (error) {
        console.error("Ошибка при генерации нового кода доступа:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при генерации нового кода доступа", 
          user: null 
        };
      }
    }),
    
  // Добавление телеграм-аккаунта пользователю
  addTelegramAccount: publicProcedure
    .input(z.object({
      userId: z.number().int().positive(),
      telegramId: z.string().min(1, "Telegram ID обязателен"),
      username: z.string().nullish(),
      firstName: z.string().nullish(),
      lastName: z.string().nullish()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверяем существование пользователя
        const user = await ctx.db.user.findUnique({
          where: { id: input.userId }
        });
        
        if (!user) {
          return { 
            success: false, 
            message: "Пользователь не найден",
            account: null
          };
        }
        
        // Проверяем, существует ли уже аккаунт с таким telegramId
        const existingAccount = await ctx.db.telegramAccount.findFirst({
          where: { telegramId: input.telegramId }
        });
        
        if (existingAccount) {
          return { 
            success: false, 
            message: "Аккаунт с таким Telegram ID уже существует",
            account: null
          };
        }
        
        // Создаем новый телеграм-аккаунт
        const newAccount = await ctx.db.telegramAccount.create({
          data: {
            userId: input.userId,
            telegramId: input.telegramId,
            username: input.username,
            firstName: input.firstName,
            lastName: input.lastName
          }
        });
        
        return { 
          success: true, 
          account: newAccount 
        };
      } catch (error) {
        console.error("Ошибка при добавлении телеграм-аккаунта:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при добавлении телеграм-аккаунта", 
          account: null 
        };
      }
    }),
    
  // Удаление телеграм-аккаунта
  removeTelegramAccount: publicProcedure
    .input(z.object({
      accountId: z.number().int().positive()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверяем существование аккаунта
        const account = await ctx.db.telegramAccount.findUnique({
          where: { id: input.accountId }
        });
        
        if (!account) {
          return { 
            success: false, 
            message: "Аккаунт не найден" 
          };
        }
        
        // Удаляем аккаунт
        await ctx.db.telegramAccount.delete({
          where: { id: input.accountId }
        });
        
        return { 
          success: true, 
          message: "Телеграм-аккаунт успешно удален" 
        };
      } catch (error) {
        console.error("Ошибка при удалении телеграм-аккаунта:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при удалении телеграм-аккаунта" 
        };
      }
    }),

  // Удаление пользователя
  deleteUser: publicProcedure
    .input(z.object({ 
      userId: z.number().int().positive() 
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверяем существование пользователя
        const user = await ctx.db.user.findUnique({
          where: { id: input.userId }
        });
        
        if (!user) {
          return { 
            success: false, 
            message: "Пользователь не найден" 
          };
        }
        
        // Удаляем пользователя
        await ctx.db.user.delete({
          where: { id: input.userId }
        });
        
        return { 
          success: true, 
          message: "Пользователь успешно удален" 
        };
      } catch (error) {
        console.error("Ошибка при удалении пользователя:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при удалении пользователя" 
        };
      }
    }),

  // Обновление API ключей Bybit пользователя
  updateBybitApiKeys: publicProcedure
    .input(z.object({
      userId: z.number().int().positive(),
      bybitApiToken: z.string().nullish(),
      bybitApiSecret: z.string().nullish()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверяем существование пользователя
        const user = await ctx.db.user.findUnique({
          where: { id: input.userId }
        });
        
        if (!user) {
          return { 
            success: false, 
            message: "Пользователь не найден",
            user: null
          };
        }
        
        // Обновляем API ключи Bybit
        const updatedUser = await ctx.db.user.update({
          where: { id: input.userId },
          data: {
            bybitApiToken: input.bybitApiToken,
            bybitApiSecret: input.bybitApiSecret,
            // При изменении ключей сбрасываем статус синхронизации
            lastBybitSyncStatus: input.bybitApiToken ? "не синхронизировано" : null
          }
        });
        
        return { 
          success: true, 
          message: "API ключи Bybit успешно обновлены",
          user: updatedUser
        };
      } catch (error) {
        console.error("Ошибка при обновлении API ключей Bybit:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при обновлении API ключей Bybit", 
          user: null 
        };
      }
    }),
});
