"use client";

import { useAuthStore } from "@/stores/authStore";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type AuthProviderProps = {
  children: React.ReactNode;
};

// Список публичных страниц, не требующих аутентификации
const publicPages = ["/login"];

export function AuthProvider({ children }: AuthProviderProps) {
  const { isAuthenticated, token } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);

  // Проверяем аутентификацию при изменении страницы
  useEffect(() => {
    // Предотвращаем множественные перенаправления
    if (isNavigating) return;

    const handleNavigation = async () => {
      // Если пользователь не аутентифицирован и находится не на публичной странице
      if (!isAuthenticated && !publicPages.includes(pathname)) {
        setIsNavigating(true);
        // Используем replace вместо push чтобы не создавать лишних записей в истории
        router.replace("/login");
        // Сбрасываем флаг перенаправления после небольшой задержки
        setTimeout(() => setIsNavigating(false), 500);
      }
      
      // Если пользователь аутентифицирован и находится на странице входа
      else if (isAuthenticated && pathname === "/login") {
        setIsNavigating(true);
        // Используем replace вместо push
        router.replace("/");
        // Сбрасываем флаг перенаправления после небольшой задержки
        setTimeout(() => setIsNavigating(false), 500);
      } else {
        // В остальных случаях просто сбрасываем флаг
        setIsNavigating(false);
      }
    };

    // Добавляем небольшую задержку перед проверкой, чтобы дать время
    // для инициализации и загрузки данных из localStorage
    const timer = setTimeout(() => {
      void handleNavigation();
    }, 100);

    return () => clearTimeout(timer);
  }, [isAuthenticated, pathname, router, isNavigating, token]);

  return (
    <>{children}</>
  );
}
