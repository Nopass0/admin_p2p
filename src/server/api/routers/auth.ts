import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";
import crypto from "crypto";

export const authRouter = createTRPCRouter({
  // Процедура для проверки кода доступа
  verifyPassCode: publicProcedure
    .input(z.object({ 
      passCode: z.string().min(4, "Код доступа должен содержать минимум 4 символа") 
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Ищем пользователя по коду доступа
        const user = await ctx.db.user.findUnique({
          where: { passCode: input.passCode },
          include: { 
            telegramAccounts: true 
          },
        });

        if (!user) {
          return { 
            success: false, 
            message: "Неверный код доступа", 
            user: null, 
            isAdmin: false,
            adminData: null,
            token: null
          };
        }

        // Проверяем является ли пользователь активным
        if (!user.isActive) {
          return { 
            success: false, 
            message: "Учетная запись пользователя деактивирована", 
            user: null, 
            isAdmin: false,
            adminData: null,
            token: null
          };
        }

        // Проверяем, есть ли у пользователя телеграм-аккаунты
        if (!user.telegramAccounts.length) {
          return { 
            success: false, 
            message: "У данного пользователя отсутствуют привязанные Telegram-аккаунты", 
            user: null, 
            isAdmin: false,
            adminData: null,
            token: null
          };
        }

        // Проверяем, является ли хотя бы один из телеграм-аккаунтов пользователя админом
        let isAdmin = false;
        let adminData = null;

        // Проверяем каждый телеграм-аккаунт пользователя
        for (const account of user.telegramAccounts) {
          const admin = await ctx.db.admin.findUnique({
            where: { telegramId: account.telegramId }
          });

          if (admin) {
            isAdmin = true;
            adminData = admin;
            break;
          }
        }

        // Генерируем токен авторизации
        const token = crypto.createHash('sha256').update(user.id.toString() + Date.now().toString()).digest('hex');

        return { 
          success: true, 
          message: "Авторизация успешна", 
          user,
          isAdmin,
          adminData,
          token
        };
      } catch (error) {
        console.error("Ошибка при проверке кода доступа:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при проверке кода доступа", 
          user: null,
          isAdmin: false,
          adminData: null,
          token: null
        };
      }
    }),

  // Процедура для генерации нового кода доступа
  regeneratePassCode: publicProcedure
    .input(z.object({ 
      userId: z.number().int().positive() 
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Генерируем новый код доступа (6 цифр)
        const newPassCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Обновляем код доступа пользователя
        const updatedUser = await ctx.db.user.update({
          where: { id: input.userId },
          data: { passCode: newPassCode },
          include: { telegramAccounts: true }
        });

        return { 
          success: true, 
          message: "Код доступа успешно обновлен", 
          user: updatedUser 
        };
      } catch (error) {
        console.error("Ошибка при генерации кода доступа:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при генерации кода доступа" 
        };
      }
    }),

  // Процедура для получения текущего пользователя
  getCurrentUser: publicProcedure
    .input(z.object({ 
      userId: z.number().int().positive() 
    }))
    .query(async ({ ctx, input }) => {
      try {
        const user = await ctx.db.user.findUnique({
          where: { id: input.userId },
          include: { telegramAccounts: true }
        });

        if (!user) {
          return { 
            success: false, 
            message: "Пользователь не найден" 
          };
        }

        // Проверяем является ли пользователь админом
        let isAdmin = false;
        let adminData = null;

        for (const account of user.telegramAccounts) {
          const admin = await ctx.db.admin.findUnique({
            where: { telegramId: account.telegramId }
          });

          if (admin) {
            isAdmin = true;
            adminData = admin;
            break;
          }
        }

        return { 
          success: true, 
          user, 
          isAdmin,
          adminData
        };
      } catch (error) {
        console.error("Ошибка при получении данных пользователя:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при получении данных пользователя" 
        };
      }
    }),
});
