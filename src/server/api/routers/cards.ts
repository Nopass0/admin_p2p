import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

const CardStatusEnum = z.enum(["ACTIVE", "WARNING", "BLOCKED"]);

// Helper function to safely convert any date input to a Date object
const parseDate = (date: string | Date | undefined): Date | undefined => {
  if (!date) return undefined;
  if (date instanceof Date) return date;
  try {
    return new Date(date);
  } catch (error) {
    console.error("Failed to parse date:", date, error);
    return undefined;
  }
};

export const cardsRouter = createTRPCRouter({
  getAll: publicProcedure
    .input(
      z.object({
        page: z.number().int().default(1),
        pageSize: z.number().int().default(10),
        searchQuery: z.string().optional(),
        sortBy: z.string().optional(),
        sortDirection: z.enum(["asc", "desc"]).optional(),
        // Filters
        provider: z.string().optional(),
        bank: z.string().optional(),
        status: CardStatusEnum.optional(),
        collectorName: z.string().optional(),
        picachu: z.string().optional(),
        inWork: z.boolean().optional(), // Новый фильтр "В работе"
        actor: z.string().optional(), // Новый фильтр "Актер"
      }),
    )
    .query(async ({ ctx, input }) => {
      const {
        page,
        pageSize,
        searchQuery,
        sortBy,
        sortDirection,
        provider,
        bank,
        status,
        collectorName,
        picachu,
        inWork, // Новое поле
        actor, // Новое поле
      } = input;

      const skip = (page - 1) * pageSize;

      // Base where clause
      let whereClause: any = {};

      // Apply search query if provided
      if (searchQuery) {
        whereClause.OR = [
          ...(isNaN(Number(searchQuery)) ? [] : [{ id: Number(searchQuery) }]),
          { provider: { contains: searchQuery, mode: "insensitive" } },
          { bank: { contains: searchQuery, mode: "insensitive" } },
          { cardNumber: { contains: searchQuery, mode: "insensitive" } },
          { comment: { contains: searchQuery, mode: "insensitive" } },
          { phoneNumber: { contains: searchQuery, mode: "insensitive" } },
          { terminalPin: { contains: searchQuery, mode: "insensitive" } },
          { picachu: { contains: searchQuery, mode: "insensitive" } },
          { actor: { contains: searchQuery, mode: "insensitive" } }, // Поиск по новому полю
        ];
      }

      // Apply filters
      if (provider) {
        whereClause.provider = { contains: provider, mode: "insensitive" };
      }

      if (bank) {
        whereClause.bank = { contains: bank, mode: "insensitive" };
      }

      if (status) {
        whereClause.status = status;
      }

      if (picachu) {
        whereClause.picachu = { contains: picachu, mode: "insensitive" };
      }

      // Новый фильтр по полю "В работе"
      if (inWork !== undefined) {
        whereClause.inWork = inWork;
      }

      // Новый фильтр по полю "Актер"
      if (actor) {
        whereClause.actor = { contains: actor, mode: "insensitive" };
      }

      // Collector filter requires joining with pourings
      let cardIdsWithCollector;
      if (collectorName) {
        const pouringsWithCollector = await ctx.db.cardPouring.findMany({
          where: {
            collectorName: { contains: collectorName, mode: "insensitive" },
          },
          select: {
            cardId: true,
          },
        });

        cardIdsWithCollector = pouringsWithCollector.map((p) => p.cardId);

        if (cardIdsWithCollector.length > 0) {
          whereClause.id = { in: cardIdsWithCollector };
        } else {
          // If no cards match the collector, return empty result
          return {
            cards: [],
            totalPages: 0,
            totalCount: 0,
            totalCardPrice: 0,
            paidCardsSum: 0,
            unpaidCardsSum: 0,
          };
        }
      }

      const orderBy = sortBy
        ? {
            [sortBy]: sortDirection ?? "asc",
          }
        : { createdAt: "desc" };

      const [cards, totalCount] = await Promise.all([
        ctx.db.card.findMany({
          where: whereClause,
          orderBy,
          skip,
          take: pageSize,
          include: {
            // Get latest balance
            balances: {
              orderBy: {
                date: "desc",
              },
              take: 1,
            },
            // Get latest pouring
            pourings: {
              orderBy: {
                pouringDate: "desc",
              },
              take: 1,
            },
          },
        }),
        ctx.db.card.count({
          where: whereClause,
        }),
      ]);

      // Calculate financial summaries
      const [totalPriceResult, paidResult, unpaidResult] = await Promise.all([
        // Total price of all cards matching the filter
        ctx.db.card.aggregate({
          where: whereClause,
          _sum: {
            cardPrice: true,
          },
        }),
        // Sum of paid cards
        ctx.db.card.aggregate({
          where: {
            ...whereClause,
            isPaid: true,
          },
          _sum: {
            cardPrice: true,
          },
        }),
        // Sum of unpaid cards
        ctx.db.card.aggregate({
          where: {
            ...whereClause,
            isPaid: false,
          },
          _sum: {
            cardPrice: true,
          },
        }),
      ]);

      return {
        cards,
        totalPages: Math.ceil(totalCount / pageSize),
        totalCount,
        totalCardPrice: totalPriceResult._sum.cardPrice || 0,
        paidCardsSum: paidResult._sum.cardPrice || 0,
        unpaidCardsSum: unpaidResult._sum.cardPrice || 0,
      };
    }),

  getById: publicProcedure
    .input(
      z.object({
        id: z.number().int(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.card.findUnique({
        where: { id: input.id },
        include: {
          balances: {
            orderBy: {
              date: "desc",
            },
          },
          pourings: {
            orderBy: {
              pouringDate: "desc",
            },
          },
        },
      });
    }),

  getStats: publicProcedure.query(async ({ ctx }) => {
    try {
      // Получение общего количества карт
      const totalCardCount = await ctx.db.card.count();

      // Получение суммы стоимости всех карт
      const totalPriceResult = await ctx.db.card.aggregate({
        _sum: {
          cardPrice: true,
        },
      });

      // Получение суммы оплаченных карт
      const paidCardsResult = await ctx.db.card.aggregate({
        where: {
          isPaid: true,
        },
        _sum: {
          cardPrice: true,
        },
      });

      // Получение суммы неоплаченных карт
      const unpaidCardsResult = await ctx.db.card.aggregate({
        where: {
          isPaid: false,
        },
        _sum: {
          cardPrice: true,
        },
      });

      // Количество карт в работе
      const inWorkCount = await ctx.db.card.count({
        where: {
          inWork: true,
        },
      });

      // НОВЫЕ РАСЧЕТЫ МЕТРИК -------------------------

      // Сумма всех балансов на начало пролива
      const initialBalancesResult = await ctx.db.cardPouring.aggregate({
        _sum: {
          initialAmount: true,
        },
      });

      // Сумма всех балансов на конец пролива
      const finalBalancesResult = await ctx.db.cardPouring.aggregate({
        where: {
          finalAmount: { not: null },
        },
        _sum: {
          finalAmount: true,
        },
      });

      // Общая сумма пролитого
      const totalPouredResult = await ctx.db.cardPouring.aggregate({
        _sum: {
          pouringAmount: true,
        },
      });

      // Сумма всех выплат
      const totalWithdrawalResult = await ctx.db.cardPouring.aggregate({
        where: {
          withdrawalAmount: { not: null },
        },
        _sum: {
          withdrawalAmount: true,
        },
      });

      return {
        totalCardCount,
        totalCardPrice: totalPriceResult._sum.cardPrice || 0,
        paidCardsSum: paidCardsResult._sum.cardPrice || 0,
        unpaidCardsSum: unpaidCardsResult._sum.cardPrice || 0,
        inWorkCount,
        // Новые метрики
        totalInitialBalance: initialBalancesResult._sum.initialAmount || 0,
        totalFinalBalance: finalBalancesResult._sum.finalAmount || 0,
        totalPouredAmount: totalPouredResult._sum.pouringAmount || 0,
        totalWithdrawalAmount: totalWithdrawalResult._sum.withdrawalAmount || 0,
      };
    } catch (error) {
      console.error("Error fetching card stats:", error);
      return {
        totalCardCount: 0,
        totalCardPrice: 0,
        paidCardsSum: 0,
        unpaidCardsSum: 0,
        inWorkCount: 0,
        totalInitialBalance: 0,
        totalFinalBalance: 0,
        totalPouredAmount: 0,
        totalWithdrawalAmount: 0,
      };
    }
  }),

  create: publicProcedure
    .input(
      z.object({
        externalId: z.number().int(),
        provider: z.string().min(1),
        cardNumber: z.string().min(1),
        bank: z.string().min(1),
        phoneNumber: z.string().min(1),
        appPin: z.number().int(),
        terminalPin: z.string().min(1),
        comment: z.string().optional(),
        status: CardStatusEnum.default("ACTIVE"),
        picachu: z.string().optional(),
        initialBalance: z.number().optional(),
        // Initial pouring data if provided
        pouringAmount: z.number().optional(),
        initialAmount: z.number().optional(),
        initialDate: z.string().optional(), // Accept string only, we'll parse it manually
        collectorName: z.string().optional(),
        cardPrice: z.number().optional(),
        isPaid: z.boolean().optional(),
        inWork: z.boolean().optional(), // Новое поле
        actor: z.string().optional(), // Новое поле
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const {
        initialBalance,
        pouringAmount,
        initialAmount,
        initialDate,
        collectorName,
        cardPrice,
        isPaid,
        inWork, // Новое поле
        actor, // Новое поле
        ...cardData
      } = input;

      // Create the card
      const card = await ctx.db.card.create({
        data: {
          ...cardData,
          cardPrice,
          isPaid,
          inWork: inWork ?? false, // По умолчанию не в работе
          actor, // Актер может быть null
        },
      });

      // Create initial balance if provided
      if (initialBalance !== undefined) {
        await ctx.db.cardBalance.create({
          data: {
            cardId: card.id,
            date: new Date(),
            startBalance: initialBalance,
            endBalance: initialBalance,
          },
        });
      }

      // Create initial pouring if all required data is provided
      if (pouringAmount !== undefined && initialAmount !== undefined) {
        // Safely parse the initialDate
        const parsedInitialDate = initialDate
          ? parseDate(initialDate)
          : new Date();

        await ctx.db.cardPouring.create({
          data: {
            cardId: card.id,
            pouringDate: new Date(),
            initialAmount,
            initialDate: parsedInitialDate,
            pouringAmount,
            status: card.status,
            collectorName,
          },
        });
      }

      return card;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.number().int(),
        externalId: z.number().int().optional(),
        provider: z.string().min(1).optional(),
        cardNumber: z.string().min(1).optional(),
        bank: z.string().min(1).optional(),
        phoneNumber: z.string().min(1).optional(),
        appPin: z.number().int().optional(),
        terminalPin: z.string().min(1).optional(),
        comment: z.string().optional(),
        status: CardStatusEnum.optional(),
        picachu: z.string().optional(),
        cardPrice: z.string().optional(),
        isPaid: z.boolean().optional(),
        inWork: z.boolean().optional(), // Новое поле
        actor: z.string().optional(), // Новое поле
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.card.update({
        where: { id },
        data: {
          ...data,
          cardPrice: data.cardPrice ? parseFloat(data.cardPrice) : null,
          isPaid: data.isPaid,
          inWork: data.inWork, // Новое поле
          actor: data.actor, // Новое поле
        },
      });
    }),

  delete: publicProcedure
    .input(
      z.object({
        id: z.number().int(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.card.delete({
        where: { id: input.id },
      });
    }),

  updateBalance: publicProcedure
    .input(
      z.object({
        cardId: z.number().int(),
        date: z.date(),
        startBalance: z.number(),
        endBalance: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { cardId, date, startBalance, endBalance } = input;

      const existingBalance = await ctx.db.cardBalance.findUnique({
        where: {
          cardId_date: {
            cardId,
            date,
          },
        },
      });

      if (existingBalance) {
        return ctx.db.cardBalance.update({
          where: {
            id: existingBalance.id,
          },
          data: {
            startBalance,
            endBalance,
          },
        });
      } else {
        return ctx.db.cardBalance.create({
          data: {
            cardId,
            date,
            startBalance,
            endBalance,
          },
        });
      }
    }),

  getCardBalances: publicProcedure
    .input(
      z.object({
        cardId: z.number().int(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.cardBalance.findMany({
        where: {
          cardId: input.cardId,
        },
        orderBy: {
          date: "desc",
        },
      });
    }),

  createBalance: publicProcedure
    .input(
      z.object({
        cardId: z.number().int(),
        date: z.date(),
        startBalance: z.number(),
        endBalance: z.number(),
        comment: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.cardBalance.create({
        data: input,
      });
    }),

  deleteBalance: publicProcedure
    .input(
      z.object({
        id: z.number().int(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.cardBalance.delete({
        where: { id: input.id },
      });
    }),

  // New endpoint to manage card pourings
  createPouring: publicProcedure
    .input(
      z.object({
        cardId: z.number().int(),
        pouringDate: z.string(),
        initialAmount: z.number(),
        initialDate: z.string(),
        finalAmount: z.number().optional(),
        finalDate: z.string().optional(),
        pouringAmount: z.number(),
        withdrawalAmount: z.number().optional(),
        withdrawalDate: z.string().optional(),
        collectorName: z.string().optional(),
        status: CardStatusEnum.default("ACTIVE"),
        comment: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Convert string dates to Date objects
      const data = {
        ...input,
        pouringDate: parseDate(input.pouringDate),
        initialDate: parseDate(input.initialDate),
        finalDate: input.finalDate ? parseDate(input.finalDate) : undefined,
        withdrawalDate: input.withdrawalDate
          ? parseDate(input.withdrawalDate)
          : undefined,
      };

      return ctx.db.cardPouring.create({
        data,
      });
    }),

  updatePouring: publicProcedure
    .input(
      z.object({
        id: z.number().int(),
        pouringDate: z.string().optional(),
        initialAmount: z.number().optional(),
        initialDate: z.string().optional(),
        finalAmount: z.number().optional(),
        finalDate: z.string().optional(),
        pouringAmount: z.number().optional(),
        withdrawalAmount: z.number().optional(),
        withdrawalDate: z.string().optional(),
        collectorName: z.string().optional(),
        status: CardStatusEnum.optional(),
        comment: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      // Convert any string dates to Date objects
      const data = {
        ...updateData,
        pouringDate: updateData.pouringDate
          ? parseDate(updateData.pouringDate)
          : undefined,
        initialDate: updateData.initialDate
          ? parseDate(updateData.initialDate)
          : undefined,
        finalDate: updateData.finalDate
          ? parseDate(updateData.finalDate)
          : undefined,
        withdrawalDate: updateData.withdrawalDate
          ? parseDate(updateData.withdrawalDate)
          : undefined,
      };

      return ctx.db.cardPouring.update({
        where: { id },
        data,
      });
    }),

  deletePouring: publicProcedure
    .input(
      z.object({
        id: z.number().int(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.cardPouring.delete({
        where: { id: input.id },
      });
    }),

  // Get all pourings for a card
  getCardPourings: publicProcedure
    .input(
      z.object({
        cardId: z.number().int(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.cardPouring.findMany({
        where: {
          cardId: input.cardId,
        },
        orderBy: {
          pouringDate: "desc",
        },
      });
    }),

  // Get unique values for filters
  getFilterOptions: publicProcedure.query(async ({ ctx }) => {
    try {
      const [providers, banks, collectorNames, picachus, actors] =
        await Promise.all([
          ctx.db.card.findMany({
            select: { provider: true },
            distinct: ["provider"],
            where: { provider: { not: "" } },
          }),
          ctx.db.card.findMany({
            select: { bank: true },
            distinct: ["bank"],
            where: { bank: { not: "" } },
          }),
          ctx.db.cardPouring.findMany({
            where: {
              collectorName: {
                not: null,
                not: "",
              },
            },
            select: { collectorName: true },
            distinct: ["collectorName"],
          }),
          ctx.db.card.findMany({
            where: {
              picachu: {
                not: null,
                not: "",
              },
            },
            select: { picachu: true },
            distinct: ["picachu"],
          }),
          // Получение уникальных значений для поля "Актер"
          ctx.db.card.findMany({
            where: {
              actor: {
                not: null,
                not: "",
              },
            },
            select: { actor: true },
            distinct: ["actor"],
          }),
        ]);

      return {
        providers: providers.map((p) => p.provider),
        banks: banks.map((b) => b.bank),
        collectorNames: collectorNames
          .map((c) => c.collectorName)
          .filter(Boolean),
        picachus: picachus.map((p) => p.picachu).filter(Boolean),
        actors: actors.map((a) => a.actor).filter(Boolean), // Добавление нового фильтра
      };
    } catch (error) {
      console.error("Error fetching filter options:", error);
      return {
        providers: [],
        banks: [],
        collectorNames: [],
        picachus: [],
        actors: [], // Добавление нового фильтра
      };
    }
  }),
});
