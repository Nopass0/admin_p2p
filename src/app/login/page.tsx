"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { useAuthStore, type AuthUser } from "@/stores/authStore";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card } from "@heroui/card";
import { Alert } from "@heroui/alert";
import { AlertCircle } from "lucide-react";

interface VerifyResponse {
  success: boolean;
  message: string;
  user: any;  // Используем any для предотвращения проблем с типизацией
  isAdmin: boolean;
  adminData: any;
  token: string | null;  // Может быть null при ошибке
}

export default function LoginPage() {
  const [passCode, setPassCode] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  
  // Получаем функции из хранилища аутентификации
  const { login } = useAuthStore();

  // Используем tRPC мутацию для проверки кода доступа
  const verifyPassCode = api.auth.verifyPassCode.useMutation({
    onSuccess: (data: any) => {  // Используем any для обхода строгой типизации
      if (data.success && data.user) {
        // Успешная аутентификация - сохраняем данные пользователя и перенаправляем на главную страницу
        login(
          data.user as AuthUser,  
          data.isAdmin, 
          data.adminData,
          data.token || undefined  // Конвертируем null в undefined
        );
        router.push("/");
      } else {
        // Ошибка аутентификации
        setError(data.message || "Ошибка аутентификации");
      }
    },
    onError: (error) => {
      setError(error.message || "Произошла ошибка при проверке кода");
    },
  });

  // Обработчик отправки формы
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Сбрасываем предыдущие ошибки
    setError("");
    
    // Проверяем код доступа
    if (!passCode.trim()) {
      setError("Введите код доступа");
      return;
    }
    
    // Отправляем запрос на сервер
    verifyPassCode.mutate({ passCode });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-slate-900 px-4">
      <Card className="w-full max-w-md">
        <div className="space-y-1 p-6">
          <h2 className="text-2xl font-bold text-center">
            P2P Админ-Панель
          </h2>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 p-6">
            {error && (
              <Alert color="danger" variant="flat" className="bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-100">
                <AlertCircle className="h-4 w-4" />
                <div className="font-medium">Ошибка</div>
                <div>{error}</div>
              </Alert>
            )}
            <div className="space-y-2">
              <Input
                id="passCode"
                type="password"
                placeholder="Введите код доступа"
                value={passCode}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassCode(e.target.value)}
                className="text-center text-2xl tracking-widest"
                maxLength={16}
              />
            </div>
          </div>
          <div className="px-6 py-4">
            <Button
              type="submit"
              className="w-full"
              disabled={verifyPassCode.status === "pending"}
            >
              {verifyPassCode.status === "pending" ? "Проверка..." : "Войти"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
