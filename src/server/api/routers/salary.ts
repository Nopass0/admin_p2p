import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";
import { Prisma } from "@prisma/client";

export const salaryRouter = createTRPCRouter({
  // Получение списка всех сотрудников с пагинацией и суммами за период
  getAllEmployees: publicProcedure
    .input(z.object({ 
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().default(10),
      searchQuery: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const { page, pageSize, searchQuery, startDate, endDate } = input;
        
        // Базовый фильтр для сотрудников
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
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
        });

        // Подготавливаем фильтр по датам для выплат и долгов
        const dateFilter = {};
        if (startDate || endDate) {
          if (startDate) {
            dateFilter['gte'] = new Date(startDate);
          }
          if (endDate) {
            dateFilter['lte'] = new Date(endDate);
          }
        }

        // Для каждого сотрудника получаем суммы выплат и долгов за период
        const employeesWithDetails = await Promise.all(
          employees.map(async (employee) => {
            // Получаем выплаты за период
            const payments = await ctx.db.salaryPayment.findMany({
              where: {
                salaryId: employee.id,
                ...(Object.keys(dateFilter).length > 0 ? { paymentDate: dateFilter } : {})
              },
              orderBy: { paymentDate: 'desc' },
            });
            
            // Суммируем выплаты
            const totalPayments = payments.reduce((sum, payment) => sum + payment.amount, 0);
            
            // Получаем долги за период
            const debts = await ctx.db.salaryDebt.findMany({
              where: {
                salaryId: employee.id,
                isPaid: false,
                ...(Object.keys(dateFilter).length > 0 ? { debtDate: dateFilter } : {})
              },
              orderBy: { debtDate: 'desc' },
            });
            
            // Суммируем долги
            const totalDebts = debts.reduce((sum, debt) => sum + debt.amount, 0);
            
            // Последняя выплата для отображения даты
            const lastPayment = payments.length > 0 ? payments[0] : null;

            return {
              ...employee,
              payments: [{
                id: lastPayment?.id || 0,
                paymentDate: lastPayment?.paymentDate || null,
                amount: totalPayments,
                totalPayments,
                paymentsCount: payments.length
              }],
              debts,
              totalDebts
            };
          })
        );

        return { 
          success: true, 
          employees: employeesWithDetails, 
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
            },
            debts: {
              orderBy: { debtDate: 'desc' }
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
      isActive: z.boolean().default(true),
      comment: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...data } = input;
        
        // Обновляем данные сотрудника
        const updatedEmployee = await ctx.db.salary.update({
          where: { id },
          data
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
          message: "Произошла ошибка при обновлении данных сотрудника" 
        };
      }
    }),

  // Удаление сотрудника
  deleteEmployee: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Обновляем данные сотрудника перед удалением
        await ctx.db.salary.update({
          where: { id: input.id },
          data: { isActive: false }
        });

        // Удаляем сотрудника
        const deletedEmployee = await ctx.db.salary.delete({
          where: { id: input.id },
          include: { 
            payments: true,
            debts: true
          }
        });
        return { 
          success: true, 
          message: "Сотрудник успешно удален", 
          employee: deletedEmployee 
        };
      } catch (error) {
        console.error("Ошибка при удалении сотрудника:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при удалении сотрудника", 
          employee: null 
        };
      }
    }),

  // Получение всех выплат с пагинацией и фильтрацией по датам
  getAllPayments: publicProcedure
    .input(z.object({ 
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().default(10),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      employeeId: z.number().int().positive().optional()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const { page, pageSize, startDate, endDate, employeeId } = input;
        
        // Базовый фильтр
        let where: Prisma.SalaryPaymentWhereInput = {};
        
        // Добавляем фильтры по датам, если указаны
        if (startDate || endDate) {
          where.paymentDate = {};
          if (startDate) where.paymentDate.gte = startDate;
          if (endDate) where.paymentDate.lte = endDate;
        }
        
        // Фильтр по сотруднику, если указан
        if (employeeId) {
          where.salaryId = employeeId;
        }
          
        // Получаем общее количество выплат для пагинации
        const totalPayments = await ctx.db.salaryPayment.count({ where });

        // Получаем общую сумму выплат по фильтру
        const paymentsSum = await ctx.db.salaryPayment.aggregate({
          where,
          _sum: {
            amount: true
          }
        });
        
        // Рассчитываем общее количество страниц
        const totalPages = Math.ceil(totalPayments / pageSize);
        
        // Получаем выплаты с пагинацией
        const payments = await ctx.db.salaryPayment.findMany({
          where,
          include: {
            salary: true
          },
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { paymentDate: 'desc' },
        });

        return { 
          success: true, 
          payments,
          totalSum: paymentsSum._sum.amount || 0,
          pagination: {
            totalItems: totalPayments,
            totalPages,
            currentPage: page
          }
        };
      } catch (error) {
        console.error("Ошибка при получении выплат:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при получении выплат", 
          payments: [],
          totalSum: 0,
          pagination: {
            totalItems: 0,
            totalPages: 0,
            currentPage: input.page
          }
        };
      }
    }),
  
  // Получение всех выплат для сотрудника с фильтрацией по датам
  getEmployeePayments: publicProcedure
    .input(z.object({ 
      employeeId: z.number().int().positive(),
      startDate: z.date().optional(),
      endDate: z.date().optional()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const { employeeId, startDate, endDate } = input;
        
        // Базовый фильтр
        let where: Prisma.SalaryPaymentWhereInput = {
          salaryId: employeeId
        };
        
        // Добавляем фильтры по датам, если указаны
        if (startDate || endDate) {
          where.paymentDate = {};
          if (startDate) where.paymentDate.gte = startDate;
          if (endDate) where.paymentDate.lte = endDate;
        }
        
        // Получаем выплаты
        const payments = await ctx.db.salaryPayment.findMany({
          where,
          orderBy: { paymentDate: 'desc' },
        });

        // Получаем общую сумму выплат
        const totalSum = await ctx.db.salaryPayment.aggregate({
          where,
          _sum: {
            amount: true
          }
        });

        return { 
          success: true, 
          payments,
          totalSum: totalSum._sum.amount || 0
        };
      } catch (error) {
        console.error("Ошибка при получении выплат сотрудника:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при получении выплат сотрудника", 
          payments: [],
          totalSum: 0
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
    
  // Обновление выплаты
  updatePayment: publicProcedure
    .input(z.object({ 
      paymentId: z.number().int().positive(),
      amount: z.number().positive(),
      paymentDate: z.date(),
      comment: z.string().optional()
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
            message: "Выплата не найдена", 
            payment: null 
          };
        }

        // Обновляем выплату
        const updatedPayment = await ctx.db.salaryPayment.update({
          where: { id: input.paymentId },
          data: {
            amount: input.amount,
            paymentDate: input.paymentDate,
            comment: input.comment || null
          },
        });

        return { 
          success: true, 
          message: "Выплата успешно обновлена", 
          payment: updatedPayment 
        };
      } catch (error) {
        console.error("Ошибка при обновлении выплаты:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при обновлении выплаты", 
          payment: null 
        };
      }
    }),

  // НОВЫЕ ЭНДПОИНТЫ ДЛЯ РАБОТЫ С ДОЛГАМИ

  // Получение долгов сотрудника
  getEmployeeDebts: publicProcedure
    .input(z.object({ 
      employeeId: z.number().int().positive() 
    }))
    .query(async ({ ctx, input }) => {
      try {
        const debts = await ctx.db.salaryDebt.findMany({
          where: { salaryId: input.employeeId },
          orderBy: { debtDate: 'desc' },
        });

        // Получаем общую сумму долгов
        const totalDebt = await ctx.db.salaryDebt.aggregate({
          where: { 
            salaryId: input.employeeId,
            isPaid: false 
          },
          _sum: {
            amount: true
          }
        });

        return { 
          success: true, 
          debts,
          totalDebt: totalDebt._sum.amount || 0
        };
      } catch (error) {
        console.error("Ошибка при получении долгов сотрудника:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при получении долгов сотрудника", 
          debts: [],
          totalDebt: 0
        };
      }
    }),

  // Добавление нового долга
  addDebt: publicProcedure
    .input(z.object({ 
      salaryId: z.number().int().positive(),
      amount: z.number().positive(),
      debtDate: z.date(),
      description: z.string().optional()
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
            debt: null 
          };
        }

        // Создаем новый долг
        const newDebt = await ctx.db.salaryDebt.create({
          data: {
            salaryId: input.salaryId,
            amount: input.amount,
            debtDate: input.debtDate,
            description: input.description || null,
            isPaid: false
          },
        });

        return { 
          success: true, 
          message: "Долг успешно добавлен", 
          debt: newDebt 
        };
      } catch (error) {
        console.error("Ошибка при добавлении долга:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при добавлении долга", 
          debt: null 
        };
      }
    }),

  // Обновление долга (например, отметить как оплаченный)
  updateDebt: publicProcedure
    .input(z.object({ 
      debtId: z.number().int().positive(),
      amount: z.number().positive().optional(),
      debtDate: z.date().optional(),
      description: z.string().optional(),
      isPaid: z.boolean().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { debtId, ...updateData } = input;
        
        // Обновляем данные о долге
        const updatedDebt = await ctx.db.salaryDebt.update({
          where: { id: debtId },
          data: updateData,
        });

        return { 
          success: true, 
          message: "Данные о долге успешно обновлены", 
          debt: updatedDebt 
        };
      } catch (error) {
        console.error("Ошибка при обновлении данных о долге:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при обновлении данных о долге", 
          debt: null 
        };
      }
    }),

  // Удаление долга
  deleteDebt: publicProcedure
    .input(z.object({ 
      debtId: z.number().int().positive()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверяем существование долга
        const debt = await ctx.db.salaryDebt.findUnique({
          where: { id: input.debtId }
        });

        if (!debt) {
          return { 
            success: false, 
            message: "Долг не найден" 
          };
        }

        // Удаляем долг
        await ctx.db.salaryDebt.delete({
          where: { id: input.debtId }
        });

        return { 
          success: true, 
          message: "Долг успешно удален"
        };
      } catch (error) {
        console.error("Ошибка при удалении долга:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при удалении долга"
        };
      }
    }),
});