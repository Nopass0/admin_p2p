"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/trpc/react";
import { UserWithTelegram } from "@/stores/authStore";
import { Button } from "@heroui/button";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/table";
import { Badge } from "@heroui/badge";
import { Skeleton } from "@heroui/skeleton";
import { Edit, UserCheck, UserX } from "lucide-react";

interface UsersTableProps {
  limit?: number;
}

export function UsersTable({ limit }: UsersTableProps) {
  const [page, setPage] = useState(1);
  const pageSize = limit || 10;
  
  // Загружаем данные пользователей с сервера
  const { 
    data, 
    isLoading, 
    isError, 
    refetch 
  } = api.users.getAllUsers.useQuery(
    { page, pageSize },
    { refetchOnWindowFocus: false }
  );
  
  // Мутация для изменения статуса активности пользователя
  const setActiveStatus = api.users.setUserActiveStatus.useMutation({
    onSuccess: () => {
      // Обновляем данные после успешного изменения
      void refetch();
    }
  });
  
  // Обработчик изменения статуса пользователя
  const handleToggleActiveStatus = (userId: number, currentStatus: boolean) => {
    setActiveStatus.mutate({ 
      userId, 
      isActive: !currentStatus 
    });
  };

  // Если данные загружаются, показываем скелетон
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: pageSize }).map((_, index) => (
          <div key={index} className="flex items-center space-x-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-4 w-[200px]" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  // Если произошла ошибка, показываем сообщение об ошибке
  if (isError || !data) {
    return (
      <div className="text-center py-4 text-red-500">
        Ошибка при загрузке данных пользователей. Пожалуйста, попробуйте позже.
      </div>
    );
  }
  
  // Если пользователей нет, показываем сообщение
  if (data.users.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500 dark:text-gray-400">
        Нет пользователей для отображения
      </div>
    );
  }

  // Получаем общее количество страниц из данных
  const totalPages = data.pagination?.totalPages || 1;

  return (
    <div>
      <Table aria-label="Таблица пользователей">
        <TableHeader>
          <TableColumn key="id">ID</TableColumn>
          <TableColumn key="name">Имя</TableColumn>
          <TableColumn key="telegram">Telegram</TableColumn>
          <TableColumn key="status">Статус</TableColumn>
          <TableColumn key="actions">Действия</TableColumn>
        </TableHeader>
        <TableBody>
          {data.users.map((user: UserWithTelegram) => (
            <TableRow key={user.id}>
              <TableCell>{user.id}</TableCell>
              <TableCell>{user.name}</TableCell>
              <TableCell>
                {user.telegramAccounts && user.telegramAccounts.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {user.telegramAccounts.slice(0, 2).map((account) => (
                      <span key={account.id} className="text-sm">
                        {account.username || account.firstName || "Аккаунт без имени"}
                      </span>
                    ))}
                    {user.telegramAccounts.length > 2 && (
                      <span className="text-xs text-gray-500">
                        и ещё {user.telegramAccounts.length - 2}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-gray-500">Нет привязанных аккаунтов</span>
                )}
              </TableCell>
              <TableCell>
                <Badge 
                  variant={user.isActive ? "solid" : "flat"}
                  className="text-xs"
                  color={user.isActive ? "success" : "danger"}
                >
                  {user.isActive ? "Активен" : "Неактивен"}
                </Badge>
              </TableCell>
              <TableCell className="space-x-1">
                <Link href={`/users/${user.id}`}>
                  <Button 
                    variant="bordered" 
                    size="sm" 
                    className="w-8 h-8 p-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </Link>
                <Button 
                  variant={user.isActive ? "flat" : "bordered"} 
                  color={user.isActive ? "danger" : "default"}
                  size="sm" 
                  className="w-8 h-8 p-0"
                  onClick={() => handleToggleActiveStatus(user.id, user.isActive)}
                >
                  {user.isActive ? (
                    <UserX className="h-4 w-4" />
                  ) : (
                    <UserCheck className="h-4 w-4" />
                  )}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {totalPages > 1 && (
        <div className="mt-4 flex justify-center">
          <div className="flex gap-2">
            <Button
              variant="bordered"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Назад
            </Button>
            <span className="flex items-center px-2">
              Страница {page} из {totalPages}
            </span>
            <Button
              variant="bordered"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
            >
              Вперед
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
