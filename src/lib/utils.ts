import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Объединяет классы CSS с использованием clsx и tailwind-merge
 * Это позволяет избежать конфликтов при использовании tailwind классов
 * @param inputs - Классы CSS для объединения
 * @returns Объединенная строка классов CSS
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
