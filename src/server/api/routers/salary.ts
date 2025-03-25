import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";
import { Prisma } from "@prisma/client";

export const salaryRouter = createTRPCRouter({
  // Получение списка всех сотрудников с пагинацией
  getAllEmployees: publicProcedure
    .input(z.object({ 
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().default(10),
      searchQuery: z.string().optional()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const { page, pageSize, searchQuery } = input;
        
        // Базовый фильтр
        let where: Prisma.SalaryWhereInput = {};
        
        // Добавляем поиск по имени и должности, если указан searchQuery
        if (searchQuery) {
          where = {
            OR: [
              { fullName: { contains: searchQuery, mode: 'insensitive' as Prisma.QueryMode } },
              { position: { contains: searchQuery, mode: 'insensitive' as Prisma.QueryMode } }
            ]
          };
        }
          
        // Получаем общее количество сотрудников для пагинации
        const totalEmployees = await ctx.db.salary.count({ where });
        
        // Рассчитываем общее количество страниц
        const totalPages = Math.ceil(totalEmployees / pageSize);
        
        // Получаем сотрудников с пагинацией
        const employees = await ctx.db.salary.findMany({
          where,
          include: {
            payments: {
              orderBy: { paymentDate: 'desc' },
              take: 1
            }
          },
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
        });

        return { 
          success: true, 
          employees, 
          pagination: {
            totalEmployees,
            totalPages,
            currentPage: page,
            pageSize
          }
        };
      } catch (error) {
        console.error("Ошибка при получении списка сотрудников:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при получении списка сотрудников", 
          employees: [],
          pagination: {
            totalEmployees: 0,
            totalPages: 0,
            currentPage: input.page,
            pageSize: input.pageSize
          }
        };
      }
    }),

  // Получение подробной информации о сотруднике
  getEmployeeById: publicProcedure
    .input(z.object({ 
      employeeId: z.number().int().positive() 
    }))
    .query(async ({ ctx, input }) => {
      try {
        const employee = await ctx.db.salary.findUnique({
          where: { id: input.employeeId },
          include: {
            payments: {
              orderBy: { paymentDate: 'desc' }
            }
          },
        });

        if (!employee) {
          return { 
            success: false, 
            message: "Сотрудник не найден", 
            employee: null 
          };
        }

        return { 
          success: true, 
          employee 
        };
      } catch (error) {
        console.error("Ошибка при получении данных сотрудника:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при получении данных сотрудника", 
          employee: null 
        };
      }
    }),

  // Создание нового сотрудника
  createEmployee: publicProcedure
    .input(z.object({ 
      fullName: z.string().min(1, "ФИО сотрудника обязательно"),
      position: z.string().min(1, "Должность обязательна"),
      startDate: z.date(),
      payday: z.number().int().min(1).max(31),
      paydayMonth: z.number().int().min(1).max(12).nullish(),
      fixedSalary: z.number().positive().nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Создаем нового сотрудника
        const newEmployee = await ctx.db.salary.create({
          data: {
            fullName: input.fullName,
            position: input.position,
            startDate: input.startDate,
            payday: input.payday,
            paydayMonth: input.paydayMonth,
            fixedSalary: input.fixedSalary,
            isActive: true
          },
        });

        return { 
          success: true, 
          message: "Сотрудник успешно добавлен", 
          employee: newEmployee 
        };
      } catch (error) {
        console.error("Ошибка при создании сотрудника:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при создании сотрудника", 
          employee: null 
        };
      }
    }),

  // Обновление данных сотрудника
  updateEmployee: publicProcedure
    .input(z.object({ 
      id: z.number().int().positive(),
      fullName: z.string().min(1, "ФИО сотрудника обязательно"),
      position: z.string().min(1, "Должность обязательна"),
      startDate: z.date(),
      payday: z.number().int().min(1).max(31),
      paydayMonth: z.number().int().min(1).max(12).nullish(),
      fixedSalary: z.number().positive().nullish(),
      isActive: z.boolean()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const updatedEmployee = await ctx.db.salary.update({
          where: { id: input.id },
          data: {
            fullName: input.fullName,
            position: input.position,
            startDate: input.startDate,
            payday: input.payday,
            paydayMonth: input.paydayMonth,
            fixedSalary: input.fixedSalary,
            isActive: input.isActive
          },
          include: { payments: true }
        });

        return { 
          success: true, 
          message: "Данные сотрудника успешно обновлены", 
          employee: updatedEmployee 
        };
      } catch (error) {
        console.error("Ошибка при обновлении данных сотрудника:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при обновлении данных сотрудника", 
          employee: null 
        };
      }
    }),

  // Получение всех выплат для сотрудника
  getEmployeePayments: publicProcedure
    .input(z.object({ 
      employeeId: z.number().int().positive() 
    }))
    .query(async ({ ctx, input }) => {
      try {
        const payments = await ctx.db.salaryPayment.findMany({
          where: { salaryId: input.employeeId },
          orderBy: { paymentDate: 'desc' },
        });

        return { 
          success: true, 
          payments 
        };
      } catch (error) {
        console.error("Ошибка при получении выплат сотрудника:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при получении выплат сотрудника", 
          payments: [] 
        };
      }
    }),

  // Добавление новой выплаты
  addPayment: publicProcedure
    .input(z.object({ 
      salaryId: z.number().int().positive(),
      amount: z.number().positive(),
      paymentDate: z.date(),
      comment: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверяем существование сотрудника
        const employee = await ctx.db.salary.findUnique({
          where: { id: input.salaryId }
        });

        if (!employee) {
          return { 
            success: false, 
            message: "Сотрудник не найден", 
            payment: null 
          };
        }

        // Создаем новую выплату
        const newPayment = await ctx.db.salaryPayment.create({
          data: {
            salaryId: input.salaryId,
            amount: input.amount,
            paymentDate: input.paymentDate,
            comment: input.comment || null
          },
        });

        return { 
          success: true, 
          message: "Выплата успешно добавлена", 
          payment: newPayment 
        };
      } catch (error) {
        console.error("Ошибка при добавлении выплаты:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при добавлении выплаты", 
          payment: null 
        };
      }
    }),

  // Удаление выплаты
  deletePayment: publicProcedure
    .input(z.object({ 
      paymentId: z.number().int().positive()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверяем существование выплаты
        const payment = await ctx.db.salaryPayment.findUnique({
          where: { id: input.paymentId }
        });

        if (!payment) {
          return { 
            success: false, 
            message: "Выплата не найдена" 
          };
        }

        // Удаляем выплату
        await ctx.db.salaryPayment.delete({
          where: { id: input.paymentId }
        });

        return { 
          success: true, 
          message: "Выплата успешно удалена"
        };
      } catch (error) {
        console.error("Ошибка при удалении выплаты:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при удалении выплаты"
        };
      }
    }),
});