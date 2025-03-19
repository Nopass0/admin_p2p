"use client";

import { useThemeStore } from "@/stores/themeStore";
import { useEffect } from "react";

type ThemeProviderProps = {
  children: React.ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { theme } = useThemeStore();

  // Применяем тему к документу
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Удаляем предыдущие классы тем
    root.classList.remove("light", "dark");
    
    // Применяем текущую тему
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  return (
    <>{children}</>
  );
}
