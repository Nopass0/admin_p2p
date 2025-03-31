import { authRouter } from "@/server/api/routers/auth";
import { usersRouter } from "@/server/api/routers/users";
import { transactionsRouter } from "@/server/api/routers/transactions";
import { idexRouter } from "@/server/api/routers/idex";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { matchRouter } from "@/server/api/routers/match";
import { salaryRouter } from "@/server/api/routers/salary";
import { workSessionsRouter } from "@/server/api/routers/workSessions";
import { bybitTransactionsRouter } from "@/server/api/routers/bybitTransactionsRouter";
import { cardsRouter } from "@/server/api/routers/cards";
// import { sectionsRouter } from "@/server/api/routers/sections";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  auth: authRouter,
  users: usersRouter,
  transactions: transactionsRouter,
  idex: idexRouter,
  match: matchRouter,
  salary: salaryRouter,
  workSessions: workSessionsRouter,
  bybitTransactions: bybitTransactionsRouter,
  cards: cardsRouter,
  // sections: sectionsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
