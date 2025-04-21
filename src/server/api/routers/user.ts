import { z } from "zod";
import { publicProcedure, createTRPCRouter } from "../trpc";

export const userRouter = createTRPCRouter({
  getUsers: publicProcedure
    .query(async ({ ctx }) => {
      // Получаем список пользователей из базы данных
      const users = await ctx.db.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
        },
        orderBy: {
          name: 'asc',
        },
      });
      return users;
    }),
});
