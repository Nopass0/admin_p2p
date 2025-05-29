// src/server/api/utils/perCabinetWindows.ts
import dayjs from "dayjs";
import { Prisma } from "@prisma/client";

type Window = { cabinetId: number; startDate: string | Date; endDate: string | Date };

/* IDEX → approvedAt (без сдвига) */
export function buildIdexWhere(windows: Window[]): Prisma.IdexTransactionWhereInput {
  if (!windows.length) return {};
  
  const OR = windows.map(w => ({
    cabinetId: w.cabinetId,
    approvedAt: { 
      gte: dayjs(w.startDate).toISOString(), 
      lte: dayjs(w.endDate).toISOString() 
    },
  }));
  return { OR };
}

/* BYBIT → dateTime со сдвигом –3 h */
export function buildBybitWhere(windows: Window[]): Prisma.BybitTransactionFromCabinetWhereInput {
  if (!windows.length) return {};
  
  const OR = windows.map(w => ({
    cabinetId: w.cabinetId,
    dateTime: {
      gte: dayjs(w.startDate).subtract(3, "hour").toISOString(),
      lte: dayjs(w.endDate).subtract(3, "hour").toISOString(),
    },
  }));
  return { OR };
}

/* Парсинг конфигурации кабинетов из JSON */
export function parseWindows(idexCabinets: string | null): { idex: Window[], bybit: Window[] } {
  if (!idexCabinets) return { idex: [], bybit: [] };

  try {
    const cfg = JSON.parse(idexCabinets) as Window[];
    
    const idex = cfg.filter((c: any) => c.cabinetType === "idex");
    const bybit = cfg.filter((c: any) => c.cabinetType !== "idex"); // bybit | undefined
    
    return { idex, bybit };
  } catch (error) {
    console.error("Failed to parse cabinet windows:", error);
    return { idex: [], bybit: [] };
  }
}