import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";

export const workSessionsRouter = createTRPCRouter({
  getUserWorkSessions: publicProcedure
    .input(z.object({
      userId: z.number().int().positive(),
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().default(10),
      startDate: z.string().optional().transform(str => str ? new Date(str) : undefined),
      endDate: z.string().optional().transform(str => str ? new Date(str) : undefined),
      includeActive: z.boolean().default(true)
    }))
    .query(async ({ ctx, input }) => {
      try {
        const { userId, page, pageSize, startDate, endDate, includeActive } = input;
        
        // Build where clause based on inputs
        let where: any = { userId };
        
        if (startDate || endDate) {
          where.startTime = {};
          if (startDate) where.startTime.gte = startDate;
          if (endDate) where.startTime.lte = endDate;
        }
        
        if (!includeActive) {
          where.endTime = { not: null };
        }
        
        // Count total sessions
        const totalSessions = await ctx.db.workSession.count({ where });
        
        // Calculate total pages
        const totalPages = Math.ceil(totalSessions / pageSize);
        
        // Fetch work sessions with pagination
        const workSessions = await ctx.db.workSession.findMany({
          where,
          include: {
            idexCabinets: true,
            user: true,

          },
          orderBy: { startTime: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        });
        
        return {
          success: true,
          workSessions,
          pagination: {
            totalSessions,
            totalPages,
            currentPage: page,
            pageSize
          }
        };
      } catch (error) {
        console.error("Ошибка при получении рабочих сессий пользователя:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при получении рабочих сессий", 
          workSessions: [],
          pagination: {
            totalSessions: 0,
            totalPages: 0,
            currentPage: input.page,
            pageSize: input.pageSize
          }
        };
      }
    }),
});