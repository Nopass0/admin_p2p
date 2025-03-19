import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Типы тем
type Theme = 'light' | 'dark' | 'system';

// Интерфейс состояния темы
interface ThemeState {
  // Текущая тема
  theme: Theme;
  // Функция установки темы
  setTheme: (theme: Theme) => void;
}

// Создание хранилища темы с персистентностью
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system', // По умолчанию используем системную тему
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'theme-storage', // имя для хранения в localStorage
    }
  )
);
