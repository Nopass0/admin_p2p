import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";
import { Prisma, SalarySection } from "@prisma/client";
import dayjs from "dayjs";

// Определяем схему валидации для валюты
const currencySchema = z.enum(["RUB", "USDT"]).nullable().default("RUB");

// Определяем схему валидации для секции
const sectionSchema = z.enum([SalarySection.PAYMENTS, SalarySection.TRACTOR]).default(SalarySection.PAYMENTS);

export const financeRouter = createTRPCRouter({
  // Получение финансовых записей с пагинацией и фильтрами
  getAllFinRows: publicProcedure
    .input(z.object({ 
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().default(10),
      startDate: z.union([z.date(), z.null()]).optional(),
      endDate: z.union([z.date(), z.null()]).optional(),
      shift: z.enum(['morning', 'evening']).nullable().optional(),
      employeeId: z.number().int().positive().nullable().optional(),
      currency: currencySchema.nullable().optional(),
      section: z.enum([SalarySection.PAYMENTS, SalarySection.TRACTOR]).nullable().optional(),
      allSections: z.boolean().default(false)
    }))
    .query(async ({ ctx, input }) => {
      try {
        const { page, pageSize, startDate, endDate, shift, employeeId, currency, section, allSections } = input;
        
        // Базовый фильтр
        let where: Prisma.FinRowWhereInput = {};
        
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
        
        // Фильтрация по секции
        if (!allSections && section) {
          where.section = section;
        }
          
        // Получаем общее количество записей для пагинации
        const totalRows = await ctx.db.finRow.count({ where });
        
        // Рассчитываем общее количество страниц
        const totalPages = Math.ceil(totalRows / pageSize);
        
        // Получаем записи с пагинацией
        const finRows = await ctx.db.finRow.findMany({
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
          finRows, 
          pagination: {
            totalRows,
            totalPages,
            currentPage: page,
            pageSize
          }
        };
      } catch (error) {
        console.error("Ошибка при получении финансовых записей:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при получении финансовых записей", 
          finRows: [],
          pagination: {
            totalRows: 0,
            totalPages: 0,
            currentPage: input.page,
            pageSize: input.pageSize
          }
        };
      }
    }),

  // Получение конкретной финансовой записи по ID
  getFinRowById: publicProcedure
    .input(z.object({ 
      finRowId: z.number().int().positive() 
    }))
    .query(async ({ ctx, input }) => {
      try {
        const finRow = await ctx.db.finRow.findUnique({
          where: { id: input.finRowId },
          include: {
            employee: true,
            expenses: true
          },
        });

        if (!finRow) {
          return { 
            success: false, 
            message: "Финансовая запись не найдена", 
            finRow: null 
          };
        }

        return { 
          success: true, 
          finRow 
        };
      } catch (error) {
        console.error("Ошибка при получении финансовой записи:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при получении финансовой записи", 
          finRow: null 
        };
      }
    }),

  // Создание новой финансовой записи (отчета смены)
  createFinRow: publicProcedure
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
      comment: z.string().optional(),
      exchangeRate: z.number().positive().optional(),

      section: sectionSchema
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Создаем новую финансовую запись
        const newFinRow = await ctx.db.finRow.create({
          data: {
            date: input.date,
            time: input.time,
            shift: input.shift,
            startBalance: input.startBalance,
            endBalance: input.endBalance,
            employeeId: input.employeeId,
            usdtAmount: input.usdtAmount || 0,
            currency: input.currency || "RUB",
            exchangeRate: input.exchangeRate || null,

            section: input.section,
            comment: input.comment || null
          },
        });

        // Если указан сотрудник и сумма выплаты, добавляем запись в таблицу зарплат
        if (input.employeeId && input.usdtAmount && input.usdtAmount > 0) {
          await ctx.db.salaryPayment.create({
            data: {
              salaryId: input.employeeId,
              amount: input.usdtAmount,
              currency: input.currency || "RUB",
              paymentDate: input.date,
              comment: `Выплата за смену (${input.shift === 'morning' ? 'утро' : 'вечер'})`
            }
          });
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

  // Обновление финансовой записи
  updateFinRow: publicProcedure
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
      comment: z.string().optional(),
      section: sectionSchema
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const updatedFinRow = await ctx.db.finRow.update({
          where: { id: input.id },
          data: {
            date: input.date,
            time: input.time,
            shift: input.shift,
            startBalance: input.startBalance,
            endBalance: input.endBalance,
            employeeId: input.employeeId,
            usdtAmount: input.usdtAmount || 0,
            currency: input.currency || "RUB",
            exchangeRate: input.exchangeRate || null,
            section: input.section,
            comment: input.comment || null
          },
          include: { 
            employee: true,
            expenses: true
          }
        });

        return { 
          success: true, 
          message: "Финансовая запись успешно обновлена", 
          finRow: updatedFinRow 
        };
      } catch (error) {
        console.error("Ошибка при обновлении финансовой записи:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при обновлении финансовой записи", 
          finRow: null 
        };
      }
    }),

  // Удаление финансовой записи
  deleteFinRow: publicProcedure
    .input(z.object({ 
      finRowId: z.number().int().positive() 
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверяем существование записи
        const finRow = await ctx.db.finRow.findUnique({
          where: { id: input.finRowId }
        });
        
        if (!finRow) {
          return { 
            success: false, 
            message: "Финансовая запись не найдена" 
          };
        }
        
        // Удаляем запись
        await ctx.db.finRow.delete({
          where: { id: input.finRowId }
        });
        
        return { 
          success: true, 
          message: "Финансовая запись успешно удалена" 
        };
      } catch (error) {
        console.error("Ошибка при удалении финансовой записи:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при удалении финансовой записи" 
        };
      }
    }),

  // Получение расходов с фильтрами
  getExpenses: publicProcedure
    .input(z.object({ 
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().default(10),
      startDate: z.union([z.date(), z.null()]).optional(),
      endDate: z.union([z.date(), z.null()]).optional(),
      expenseType: z.enum(['fixed', 'variable']).optional(),
      currency: currencySchema.nullable().optional(),
      section: z.enum([SalarySection.PAYMENTS, SalarySection.TRACTOR]).nullable().optional()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const { page, pageSize, startDate, endDate, expenseType, currency, section } = input;
        
        // Базовый фильтр
        let where: Prisma.FinRowExpenseWhereInput = {};
        
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
        
        // Фильтрация по секции
        if (section) {
          where.section = section;
        }
          
        // Получаем общее количество расходов для пагинации
        const totalExpenses = await ctx.db.finRowExpense.count({ where });
        
        // Рассчитываем общее количество страниц
        const totalPages = Math.ceil(totalExpenses / pageSize);
        
        // Получаем расходы с пагинацией
        const expenses = await ctx.db.finRowExpense.findMany({
          where,
          include: {
            finRow: true
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
      finRowId: z.number().int().positive().optional(),
      expenseType: z.enum(['fixed', 'variable']),
      amount: z.number().positive(),
      currency: currencySchema,
      date: z.date().default(() => new Date()),
      time: z.string().min(1).default(() => {
        const now = new Date();
        return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      }),
      period: z.string().optional(), // Для постоянных расходов (ежемесячно, еженедельно и т.д.)
      description: z.string().optional(),
      section: sectionSchema.optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Создаем новый расход
        const newExpense = await ctx.db.finRowExpense.create({
          data: {
            finRowId: input.finRowId,
            expenseType: input.expenseType,
            amount: input.amount,
            currency: input.currency,
            date: input.date,
            time: input.time,
            period: input.period || null,
            description: input.description || null,
            section: input.section || null
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
      finRowId: z.number().int().positive().optional(),
      expenseType: z.enum(['fixed', 'variable']),
      amount: z.number().positive(),
      currency: currencySchema,
      date: z.date().default(() => new Date()),
      time: z.string(),
      period: z.string().optional(),
      description: z.string().optional(),
      section: sectionSchema.optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const updatedExpense = await ctx.db.finRowExpense.update({
          where: { id: input.id },
          data: {
            finRowId: input.finRowId,
            expenseType: input.expenseType,
            amount: input.amount,
            currency: input.currency,
            date: input.date,
            time: input.time,
            period: input.period || null,
            description: input.description || null,
            section: input.section || null
          },
          include: { finRow: true }
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
        const expense = await ctx.db.finRowExpense.findUnique({
          where: { id: input.expenseId }
        });
        
        if (!expense) {
          return { 
            success: false, 
            message: "Расход не найден" 
          };
        }
        
        // Удаляем расход
        await ctx.db.finRowExpense.delete({
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
      currency: currencySchema.optional(),
      section: z.enum([SalarySection.PAYMENTS, SalarySection.TRACTOR]).optional()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const { startDate, endDate, includeFixed, includeVariable, includeSalary, currency, section } = input;
        
        const globalStartDateTime = dayjs(startDate).utc().toDate();
        const globalEndDateTime = dayjs(endDate).utc().toDate();  

        let bybitMatchProfitsUSDT = 0;
        let bybitMatchProfitsRUB = 0;
        
        // Query bybit matches within the date range - include the related transaction data
        const bybitMatches = await ctx.db.bybitMatch.findMany({
          where: {
            bybitTransaction: {
              dateTime: {
                gte: globalStartDateTime,
                lte: globalEndDateTime
              }
            },
            idexTransaction: {
              approvedAt: {
                gte: globalStartDateTime.toISOString(),
                lte: globalEndDateTime.toISOString()
              },
          
            }
          },
          include: {
            bybitTransaction: true,
            idexTransaction: true
          }
        });
                
        // Разделение профитов по валютам - use the transaction currency
        bybitMatches.forEach(match => {
          // Get currency from bybitTransaction or default to USDT based on business logic
          // Bybit transactions are typically in USDT, but you might need to adjust this logic
          const currency = match.bybitTransaction?.currency || 'USDT'; 
          
          if (currency === 'USDT') {
            bybitMatchProfitsUSDT += match.grossProfit;
          } else if (currency === 'RUB') {
            bybitMatchProfitsRUB += match.grossProfit;
          }
        });

        // Базовый фильтр по датам для финансовых записей
        let finRowsWhere: Prisma.FinRowWhereInput = {
          date: {
            gte: startDate,
            lte: endDate
          }
        };
        
        // Добавляем фильтр по валюте, если он указан
        if (currency) {
          finRowsWhere.currency = currency;
        }
        
        // Добавляем фильтр по секции, если он указан
        if (section) {
          finRowsWhere.section = section;
        }
        
        // Получаем все финансовые записи за период
        const finRows = await ctx.db.finRow.findMany({
          where: finRowsWhere,
          include: {
            expenses: true
          }
        });
        
        // Разделение финансовых записей по валютам
        const finRowsUSDT = finRows.filter(row => row.currency === 'USDT');
        const finRowsRUB = finRows.filter(row => row.currency === 'RUB');
        
        // Получаем все расходы за период
        let expensesWhere: Prisma.FinRowExpenseWhereInput = {
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
        
        const allExpenses = await ctx.db.finRowExpense.findMany({
          where: expensesWhere
        });
        
        // Разделение расходов по валютам
        const expensesUSDT = allExpenses.filter(expense => expense.currency === 'USDT');
        const expensesRUB = allExpenses.filter(expense => expense.currency === 'RUB');
        
        // Получаем выплаты по зарплатам за период, если включены
        let salaryExpensesUSDT = 0;
        let salaryExpensesRUB = 0;
        
        if (includeSalary) {
          let salaryWhere: Prisma.SalaryPaymentWhereInput = {
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
            where: salaryWhere,
            include: {
              salary: true
            }
          });
          
          // Разделение зарплат по валютам с учетом фильтра по секции
          if (section) {
            const filteredPayments = salaryPayments.filter(payment => payment.salary.section === section);
            salaryExpensesUSDT = filteredPayments
              .filter(payment => payment.currency === 'USDT')
              .reduce((sum, payment) => sum + payment.amount, 0);
            salaryExpensesRUB = filteredPayments
              .filter(payment => payment.currency === 'RUB')
              .reduce((sum, payment) => sum + payment.amount, 0);
          } else {
            salaryExpensesUSDT = salaryPayments
              .filter(payment => payment.currency === 'USDT')
              .reduce((sum, payment) => sum + payment.amount, 0);
            salaryExpensesRUB = salaryPayments
              .filter(payment => payment.currency === 'RUB')
              .reduce((sum, payment) => sum + payment.amount, 0);
          }
        }
        
        // Считаем общую сумму доходов по валютам
        const totalIncomeUSDT = finRowsUSDT.reduce((sum, row) => sum + (row.endBalance - row.startBalance), 0) + bybitMatchProfitsUSDT;
        const totalIncomeRUB = finRowsRUB.reduce((sum, row) => sum + (row.endBalance - row.startBalance), 0) + bybitMatchProfitsRUB;
        
        // Считаем расходы по типам и валютам
        const fixedExpensesUSDT = expensesUSDT
          .filter(expense => expense.expenseType === 'fixed')
          .reduce((sum, expense) => sum + expense.amount, 0);
        const fixedExpensesRUB = expensesRUB
          .filter(expense => expense.expenseType === 'fixed')
          .reduce((sum, expense) => sum + expense.amount, 0);
          
        const variableExpensesUSDT = expensesUSDT
          .filter(expense => expense.expenseType === 'variable')
          .reduce((sum, expense) => sum + expense.amount, 0);
        const variableExpensesRUB = expensesRUB
          .filter(expense => expense.expenseType === 'variable')
          .reduce((sum, expense) => sum + expense.amount, 0);
        
        // Считаем общие расходы по валютам
        const totalExpensesUSDT = fixedExpensesUSDT + variableExpensesUSDT + (includeSalary ? salaryExpensesUSDT : 0);
        const totalExpensesRUB = fixedExpensesRUB + variableExpensesRUB + (includeSalary ? salaryExpensesRUB : 0);
        
        // Считаем прибыль по валютам
        const profitUSDT = totalIncomeUSDT - totalExpensesUSDT;
        const profitRUB = totalIncomeRUB - totalExpensesRUB;
        
        return { 
          success: true, 
          report: {
            period: {
              startDate,
              endDate
            },
            currency: currency || "ALL",
            section: section,
            income: {
              USDT: {
                total: totalIncomeUSDT,
                finRowIncome: finRowsUSDT.reduce((sum, row) => sum + (row.endBalance - row.startBalance), 0),
                bybitMatchProfits: bybitMatchProfitsUSDT
              },
              RUB: {
                total: totalIncomeRUB,
                finRowIncome: finRowsRUB.reduce((sum, row) => sum + (row.endBalance - row.startBalance), 0),
                bybitMatchProfits: bybitMatchProfitsRUB
              }
            },
            expenses: {
              USDT: {
                fixed: fixedExpensesUSDT,
                variable: variableExpensesUSDT,
                salary: salaryExpensesUSDT,
                total: totalExpensesUSDT
              },
              RUB: {
                fixed: fixedExpensesRUB,
                variable: variableExpensesRUB,
                salary: salaryExpensesRUB,
                total: totalExpensesRUB
              }
            },
            profit: {
              USDT: profitUSDT,
              RUB: profitRUB
            }
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