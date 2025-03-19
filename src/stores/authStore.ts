import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, TelegramAccount, Admin } from '@prisma/client';

// Расширенный тип пользователя с телеграм аккаунтами
export type UserWithTelegram = User & {
  telegramAccounts: TelegramAccount[];
};

// Альтернативный тип для пользователя из localStorage
export type UserFromStorage = {
  id: number;
  name: string;
  email?: string;
  role?: string;
  balanceUSDT?: number;
  balanceRUB?: number;
};

// Тип данных пользователя (может быть одним из двух типов)
export type AuthUser = UserWithTelegram | UserFromStorage;

// Интерфейс состояния аутентификации
interface AuthState {
  // Данные пользователя
  user: AuthUser | null;
  // Флаг аутентификации
  isAuthenticated: boolean;
  // Флаг, указывающий является ли пользователь админом
  isAdmin: boolean;
  // Данные админа
  adminData: Admin | undefined;
  // Код доступа для входа
  passCode: string;
  // Токен авторизации (если есть)
  token?: string;
  // Функция установки кода доступа
  setPassCode: (code: string) => void;
  // Функция входа в систему
  login: (user: AuthUser | undefined, isAdmin: boolean, adminData?: Admin, token?: string) => void;
  // Функция выхода из системы
  logout: () => void;
}

// Создание хранилища аутентификации с персистентностью
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isAdmin: false,
      adminData: undefined,
      passCode: '',
      token: undefined,
      setPassCode: (code) => set({ passCode: code }),
      login: (user, isAdmin, adminData, token) => set({ 
        user: user || null, 
        isAuthenticated: !!user, 
        isAdmin,
        adminData,
        token
      }),
      logout: () => set({ 
        user: null, 
        isAuthenticated: false, 
        isAdmin: false,
        adminData: undefined,
        passCode: '',
        token: undefined
      })
    }),
    {
      name: 'auth-storage', // имя для хранения в localStorage
    }
  )
);
