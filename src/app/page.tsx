"use client";

import Link from "next/link";
import { api } from "@/trpc/react";
import { AppHeader, AppSidebar } from "@/components/layout";
import { StatCard, UsersTable } from "@/components/dashboard";
import { UserIcon, ArrowDownUp, Clock, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

export default function Home() {
  const [usersCount, setUsersCount] = useState(0);
  
  // Используем хук TRPC для получения данных на клиенте
  const { data, isLoading } = api.users.getAllUsers.useQuery(
    { page: 1, pageSize: 1 },
    { refetchOnWindowFocus: false }
  );
  
  useEffect(() => {
    if (data?.pagination?.totalUsers) {
      setUsersCount(data.pagination.totalUsers);
    }
  }, [data]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <AppHeader />
      <div className="flex">
        <AppSidebar />
        <main className="flex-1 p-6">
          <h1 className="text-3xl font-bold mb-6">Панель управления</h1>
          
          {/* Статистика */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard 
              title="Пользователи" 
              value={isLoading ? "..." : usersCount.toString()} 
              icon={<UserIcon />} 
              description="Всего пользователей"
              color="bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
            />
            <StatCard 
              title="Транзакции" 
              value="0" 
              icon={<ArrowDownUp />} 
              description="За последние 24 часа"
              color="bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300"
            />
            <StatCard 
              title="Активные сессии" 
              value="0" 
              icon={<Clock />} 
              description="Сейчас"
              color="bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300"
            />
            <StatCard 
              title="Оборот" 
              value="0 ₽" 
              icon={<Wallet />} 
              description="За текущий месяц"
              color="bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
            />
          </div>
          
          {/* Последние пользователи */}
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Последние пользователи</h2>
            <UsersTable limit={5} />
            <div className="mt-4 text-right">
              <Link 
                href="/users" 
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Смотреть всех пользователей →
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
