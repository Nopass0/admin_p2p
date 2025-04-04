import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";
import { Prisma } from "@prisma/client";

// Определяем схему валидации для валюты
const currencySchema = z.enum(["RUB", "USDT"]).default("RUB");

export const shiftReportsRouter = createTRPCRouter({
  // Создание финансовой записи
  createFinRow: publicProcedure
    .input(z.object({
      date: z.date().default(() => new Date()),
      time: z.string().default(() => {
        const now = new Date();
        return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      }),
      shift: z.enum(['morning', 'evening']),
      startBalanceRUB: z.number(),
      endBalanceRUB: z.number(),
      startBalanceUSDT: z.number().optional(),
      endBalanceUSDT: z.number().optional(),
      employeePayments: z.array(z.object({
        employeeId: z.string(),
        amount: z.string(),
        currency: currencySchema
      })).optional(),
      comment: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Создаем финансовую запись
        const newFinRow = await ctx.db.finRow.create({
          data: {
            date: input.date,
            time: input.time,
            shift: input.shift,
            startBalanceRUB: input.startBalanceRUB,
            endBalanceRUB: input.endBalanceRUB,
            startBalanceUSDT: input.startBalanceUSDT || 0,
            endBalanceUSDT: input.endBalanceUSDT || 0,
            comment: input.comment
          }
        });
        
        // Если есть выплаты сотрудникам, создаем их
        if (input.employeePayments && input.employeePayments.length > 0) {
          for (const payment of input.employeePayments) {
            await ctx.db.employeeSalaryPayment.create({
              data: {
                employeeId: parseInt(payment.employeeId),
                amount: parseFloat(payment.amount),
                currency: payment.currency,
                paymentDate: input.date,
                finRowId: newFinRow.id
              }
            });
          }
        }
        
        return { 
          success: true, 
          message: "Финансовая запись успешно создана", 
          finRow: newFinRow 
        };
      } catch (error) {
        console.error("Ошибка при создании финансовой записи:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при создании финансовой записи", 
          finRow: null 
        };
      }
    }),
    
  // Получение записей смен с пагинацией и фильтрами
  getAllShiftReports: publicProcedure
    .input(z.object({ 
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().default(10),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      shift: z.enum(['morning', 'evening']).optional(),
      employeeId: z.number().int().positive().optional(),
      currency: currencySchema.optional()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const { page, pageSize, startDate, endDate, shift, employeeId, currency } = input;
        
        // Базовый фильтр
        let where: Prisma.ShiftReportWhereInput = {};
        
        // Добавляем фильтры
        if (startDate && endDate) {
          where.date = {
            gte: startDate,
            lte: endDate
          };
        } else if (startDate) {
          where.date = {
            gte: startDate
          };
        } else if (endDate) {
          where.date = {
            lte: endDate
          };
        }
        
        if (shift) {
          where.shift = shift;
        }
        
        if (employeeId) {
          where.employeeId = employeeId;
        }
        
        if (currency) {
          where.currency = currency;
        }
          
        // Получаем общее количество записей для пагинации
        const totalRows = await ctx.db.shiftReport.count({ where });
        
        // Рассчитываем общее количество страниц
        const totalPages = Math.ceil(totalRows / pageSize);
        
        // Получаем записи с пагинацией
        const shiftReports = await ctx.db.shiftReport.findMany({
          where,
          include: {
            employee: true,
            expenses: true
          },
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { date: 'desc' },
        });

        return { 
          success: true, 
          shiftReports, 
          pagination: {
            totalRows,
            totalPages,
            currentPage: page,
            pageSize
          }
        };
      } catch (error) {
        console.error("Ошибка при получении записей смен:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при получении записей смен", 
          shiftReports: [],
          pagination: {
            totalRows: 0,
            totalPages: 0,
            currentPage: input.page,
            pageSize: input.pageSize
          }
        };
      }
    }),

  // Получение конкретной записи смены по ID
  getShiftReportById: publicProcedure
    .input(z.object({ 
      shiftReportId: z.number().int().positive() 
    }))
    .query(async ({ ctx, input }) => {
      try {
        const shiftReport = await ctx.db.shiftReport.findUnique({
          where: { id: input.shiftReportId },
          include: {
            employee: true,
            expenses: true
          },
        });

        if (!shiftReport) {
          return { 
            success: false, 
            message: "Запись смены не найдена", 
            shiftReport: null 
          };
        }

        return { 
          success: true, 
          shiftReport 
        };
      } catch (error) {
        console.error("Ошибка при получении записи смены:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при получении записи смены", 
          shiftReport: null 
        };
      }
    }),

  // Создание новой записи смены
  createShiftReport: publicProcedure
    .input(z.object({ 
      date: z.date().default(() => new Date()),
      time: z.string().default(() => {
        const now = new Date();
        return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      }),
      shift: z.enum(['morning', 'evening']),
      startBalance: z.number(),
      endBalance: z.number(),
      employeeId: z.number().int().positive().optional(),
      usdtAmount: z.number().optional(),
      currency: currencySchema,
      comment: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Создаем новую запись смены
        const newShiftReport = await ctx.db.shiftReport.create({
          data: {
            date: input.date,
            time: input.time,
            shift: input.shift,
            startBalance: input.startBalance,
            endBalance: input.endBalance,
            employeeId: input.employeeId,
            usdtAmount: input.usdtAmount || 0,
            currency: input.currency,
            comment: input.comment || null
          },
        });

        // Если указан сотрудник и сумма выплаты, добавляем запись в таблицу зарплат
        if (input.employeeId && input.usdtAmount && input.usdtAmount > 0) {
          await ctx.db.salaryPayment.create({
            data: {
              salaryId: input.employeeId,
              amount: input.usdtAmount,
              currency: input.currency,
              paymentDate: input.date,
              comment: `Выплата за смену (${input.shift === 'morning' ? 'утро' : 'вечер'})`
            }
          });
        }

        return { 
          success: true, 
          message: "Запись смены успешно создана", 
          shiftReport: newShiftReport 
        };
      } catch (error) {
        console.error("Ошибка при создании записи смены:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при создании записи смены", 
          shiftReport: null 
        };
      }
    }),

  // Обновление записи смены
  updateShiftReport: publicProcedure
    .input(z.object({ 
      id: z.number().int().positive(),
      date: z.date(),
      time: z.string(),
      shift: z.enum(['morning', 'evening']),
      startBalance: z.number(),
      endBalance: z.number(),
      employeeId: z.number().int().positive().optional(),
      usdtAmount: z.number().optional(),
      currency: currencySchema,
      comment: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const updatedShiftReport = await ctx.db.shiftReport.update({
          where: { id: input.id },
          data: {
            date: input.date,
            time: input.time,
            shift: input.shift,
            startBalance: input.startBalance,
            endBalance: input.endBalance,
            employeeId: input.employeeId,
            usdtAmount: input.usdtAmount || 0,
            currency: input.currency,
            comment: input.comment || null
          },
          include: { 
            employee: true,
            expenses: true
          }
        });

        return { 
          success: true, 
          message: "Запись смены успешно обновлена", 
          shiftReport: updatedShiftReport 
        };
      } catch (error) {
        console.error("Ошибка при обновлении записи смены:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при обновлении записи смены", 
          shiftReport: null 
        };
      }
    }),

  // Удаление записи смены
  deleteShiftReport: publicProcedure
    .input(z.object({ 
      shiftReportId: z.number().int().positive() 
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверяем существование записи
        const shiftReport = await ctx.db.shiftReport.findUnique({
          where: { id: input.shiftReportId }
        });
        
        if (!shiftReport) {
          return { 
            success: false, 
            message: "Запись смены не найдена" 
          };
        }
        
        // Удаляем запись
        await ctx.db.shiftReport.delete({
          where: { id: input.shiftReportId }
        });
        
        return { 
          success: true, 
          message: "Запись смены успешно удалена" 
        };
      } catch (error) {
        console.error("Ошибка при удалении записи смены:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при удалении записи смены" 
        };
      }
    }),

  // Получение расходов с фильтрами
  getExpenses: publicProcedure
    .input(z.object({ 
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().default(10),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      expenseType: z.enum(['fixed', 'variable']).optional(),
      currency: currencySchema.optional()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const { page, pageSize, startDate, endDate, expenseType, currency } = input;
        
        // Базовый фильтр
        let where: Prisma.ShiftReportExpenseWhereInput = {};
        
        // Добавляем фильтры
        if (startDate && endDate) {
          where.date = {
            gte: startDate,
            lte: endDate
          };
        } else if (startDate) {
          where.date = {
            gte: startDate
          };
        } else if (endDate) {
          where.date = {
            lte: endDate
          };
        }
        
        if (expenseType) {
          where.expenseType = expenseType;
        }
        
        if (currency) {
          where.currency = currency;
        }
          
        // Получаем общее количество расходов для пагинации
        const totalExpenses = await ctx.db.shiftReportExpense.count({ where });
        
        // Рассчитываем общее количество страниц
        const totalPages = Math.ceil(totalExpenses / pageSize);
        
        // Получаем расходы с пагинацией
        const expenses = await ctx.db.shiftReportExpense.findMany({
          where,
          include: {
            shiftReport: true
          },
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { date: 'desc' },
        });

        return { 
          success: true, 
          expenses, 
          pagination: {
            totalExpenses,
            totalPages,
            currentPage: page,
            pageSize
          }
        };
      } catch (error) {
        console.error("Ошибка при получении расходов:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при получении расходов", 
          expenses: [],
          pagination: {
            totalExpenses: 0,
            totalPages: 0,
            currentPage: input.page,
            pageSize: input.pageSize
          }
        };
      }
    }),

  // Создание нового расхода
  createExpense: publicProcedure
    .input(z.object({ 
      shiftReportId: z.number().int().positive().optional(),
      expenseType: z.enum(['fixed', 'variable']),
      amount: z.number().positive(),
      currency: currencySchema,
      date: z.date().default(() => new Date()),
      time: z.string().default(() => {
        const now = new Date();
        return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      }),
      period: z.string().optional(), // Для постоянных расходов (ежемесячно, еженедельно и т.д.)
      description: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Создаем новый расход
        const newExpense = await ctx.db.shiftReportExpense.create({
          data: {
            shiftReportId: input.shiftReportId,
            expenseType: input.expenseType,
            amount: input.amount,
            currency: input.currency,
            date: input.date,
            time: input.time,
            period: input.period || null,
            description: input.description || null
          },
        });

        return { 
          success: true, 
          message: "Расход успешно добавлен", 
          expense: newExpense 
        };
      } catch (error) {
        console.error("Ошибка при создании расхода:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при создании расхода", 
          expense: null 
        };
      }
    }),

  // Обновление расхода
  updateExpense: publicProcedure
    .input(z.object({ 
      id: z.number().int().positive(),
      shiftReportId: z.number().int().positive().optional(),
      expenseType: z.enum(['fixed', 'variable']),
      amount: z.number().positive(),
      currency: currencySchema,
      date: z.date(),
      time: z.string(),
      period: z.string().optional(),
      description: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const updatedExpense = await ctx.db.shiftReportExpense.update({
          where: { id: input.id },
          data: {
            shiftReportId: input.shiftReportId,
            expenseType: input.expenseType,
            amount: input.amount,
            currency: input.currency,
            date: input.date,
            time: input.time,
            period: input.period || null,
            description: input.description || null
          },
          include: { shiftReport: true }
        });

        return { 
          success: true, 
          message: "Расход успешно обновлен", 
          expense: updatedExpense 
        };
      } catch (error) {
        console.error("Ошибка при обновлении расхода:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при обновлении расхода", 
          expense: null 
        };
      }
    }),

  // Удаление расхода
  deleteExpense: publicProcedure
    .input(z.object({ 
      expenseId: z.number().int().positive() 
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверяем существование расхода
        const expense = await ctx.db.shiftReportExpense.findUnique({
          where: { id: input.expenseId }
        });
        
        if (!expense) {
          return { 
            success: false, 
            message: "Расход не найден" 
          };
        }
        
        // Удаляем расход
        await ctx.db.shiftReportExpense.delete({
          where: { id: input.expenseId }
        });
        
        return { 
          success: true, 
          message: "Расход успешно удален" 
        };
      } catch (error) {
        console.error("Ошибка при удалении расхода:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при удалении расхода" 
        };
      }
    }),

  // Получение сводной информации о доходах/расходах за период
  getSummaryReport: publicProcedure
    .input(z.object({ 
      startDate: z.date(),
      endDate: z.date(),
      includeFixed: z.boolean().default(true),
      includeVariable: z.boolean().default(true),
      includeSalary: z.boolean().default(true),
      currency: currencySchema.optional()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const { startDate, endDate, includeFixed, includeVariable, includeSalary, currency } = input;
        
        // Базовый фильтр по датам для записей смен
        let shiftReportsWhere: Prisma.ShiftReportWhereInput = {
          date: {
            gte: startDate,
            lte: endDate
          }
        };
        
        // Добавляем фильтр по валюте, если он указан
        if (currency) {
          shiftReportsWhere.currency = currency;
        }
        
        // Получаем все записи смен за период
        const shiftReports = await ctx.db.shiftReport.findMany({
          where: shiftReportsWhere,
          include: {
            expenses: true
          }
        });
        
        // Получаем все расходы за период
        let expensesWhere: Prisma.ShiftReportExpenseWhereInput = {
          date: {
            gte: startDate,
            lte: endDate
          }
        };
        
        // Фильтруем по типам расходов, если указаны параметры
        let expenseTypes = [];
        if (includeFixed) expenseTypes.push('fixed');
        if (includeVariable) expenseTypes.push('variable');
        
        if (expenseTypes.length > 0) {
          expensesWhere.expenseType = {
            in: expenseTypes as any
          };
        }
        
        // Добавляем фильтр по валюте, если он указан
        if (currency) {
          expensesWhere.currency = currency;
        }
        
        const allExpenses = await ctx.db.shiftReportExpense.findMany({
          where: expensesWhere
        });
        
        // Получаем выплаты по зарплатам за период, если включены
        let salaryExpenses = 0;
        if (includeSalary) {
          let salaryWhere: Prisma.EmployeeSalaryPaymentWhereInput = {
            paymentDate: {
              gte: startDate,
              lte: endDate
            }
          };
          
          // Добавляем фильтр по валюте, если он указан
          if (currency) {
            salaryWhere.currency = currency;
          }
          
          const salaryPayments = await ctx.db.salaryPayment.findMany({
            where: salaryWhere
          });
          
          salaryExpenses = salaryPayments.reduce((sum, payment) => sum + payment.amount, 0);
        }
        
        // Считаем общую сумму доходов (разница между конечным и начальным балансом для всех смен)
        const totalIncome = shiftReports.reduce((sum, row) => sum + (row.endBalance - row.startBalance), 0);
        
        // Считаем расходы по типам
        const fixedExpenses = allExpenses
          .filter(expense => expense.expenseType === 'fixed')
          .reduce((sum, expense) => sum + expense.amount, 0);
          
        const variableExpenses = allExpenses
          .filter(expense => expense.expenseType === 'variable')
          .reduce((sum, expense) => sum + expense.amount, 0);
        
        // Считаем общие расходы
        const totalExpenses = fixedExpenses + variableExpenses + (includeSalary ? salaryExpenses : 0);
        
        // Считаем прибыль
        const profit = totalIncome - totalExpenses;
        
        return { 
          success: true, 
          report: {
            period: {
              startDate,
              endDate
            },
            currency: currency || "ALL",
            income: {
              total: totalIncome
            },
            expenses: {
              fixed: fixedExpenses,
              variable: variableExpenses,
              salary: salaryExpenses,
              total: totalExpenses
            },
            profit
          }
        };
      } catch (error) {
        console.error("Ошибка при формировании отчета:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при формировании отчета", 
          report: null 
        };
      }
    }),
});