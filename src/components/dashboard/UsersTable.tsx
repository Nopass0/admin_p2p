"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/trpc/react";
import { UserWithTelegram } from "@/stores/authStore";
import { Button } from "@heroui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { Badge } from "@heroui/badge";
import { Skeleton } from "@heroui/skeleton";
import { Input } from "@heroui/react";
import { Edit, Trash, UserCheck, UserX } from "lucide-react";

interface UsersTableProps {
  limit?: number;
}

/* ─────────────────────────────– debounce ────────────────────────────── */
function useDebounce<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

/* ────────────────────────────── компонент ───────────────────────────── */
export function UsersTable({ limit = 10 }: UsersTableProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const pageSize = limit;
  const debouncedSearch = useDebounce(search.trim(), 1200); // 1.5 с

  const { data, isLoading, isError, isFetching, refetch } =
    api.users.getAllUsers.useQuery(
      {
        page,
        pageSize,
        searchQuery: debouncedSearch || undefined,
      },
      {
        keepPreviousData: true,
        refetchOnWindowFocus: false,
      },
    );

  const { mutate: deleteUser } = api.users.deleteUser.useMutation({
    onSuccess: () => void refetch(),
  });

  const setActiveStatus = api.users.setUserActiveStatus.useMutation({
    onSuccess: () => void refetch(),
  });

  const handleToggleActiveStatus = (id: number, active: boolean) =>
    setActiveStatus.mutate({ userId: id, isActive: !active });

  const totalPages = data?.pagination?.totalPages ?? 1;

  return (
    <div>
      {/* ──────────────── Поле поиска (никогда не скрывается) ───────────── */}
      <div className="mb-4 max-w-xs">
        <Input
          placeholder="Поиск по имени или пас-коду…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1); // сброс страниц при изменении поиска
          }}
        />
      </div>

      {/* ──────────────── Состояние ошибки ──────────────── */}
      {isError && (
        <div className="py-4 text-center text-red-500">
          Ошибка при загрузке пользователей. Попробуйте позже.
        </div>
      )}

      {/* ──────────────── Загрузка (первичный fetch) ──────────────── */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: pageSize }).map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ──────────────── Таблица / пустой результат ──────────────── */}
      {!isLoading && (
        <>
          {data && data.users.length === 0 ? (
            <div className="py-4 text-center text-gray-500 dark:text-gray-400">
              Нет пользователей для отображения
            </div>
          ) : (
            <>
              <Table
                aria-label="Таблица пользователей"
                className={isFetching ? "opacity-60 transition-opacity" : ""}
              >
                <TableHeader>
                  <TableColumn>ID</TableColumn>
                  <TableColumn>Имя</TableColumn>
                  <TableColumn>Telegram</TableColumn>
                  <TableColumn>Статус</TableColumn>
                  <TableColumn>Роль</TableColumn>
                  <TableColumn>Действия</TableColumn>
                </TableHeader>
                <TableBody>
                  {data?.users.map((user: UserWithTelegram) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.id}</TableCell>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>
                        {user.telegramAccounts?.length ? (
                          <div className="flex flex-col gap-1">
                            {user.telegramAccounts.slice(0, 2).map((acc) => (
                              <span key={acc.id} className="text-sm">
                                {acc.username ||
                                  acc.firstName ||
                                  "Аккаунт без имени"}
                              </span>
                            ))}
                            {user.telegramAccounts.length > 2 && (
                              <span className="text-xs text-gray-500">
                                и ещё {user.telegramAccounts.length - 2}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">
                            Нет привязанных аккаунтов
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.isActive ? "solid" : "flat"}
                          color={user.isActive ? "success" : "danger"}
                          className="text-xs"
                        >
                          {user.isActive ? "Активен" : "Неактивен"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs ${
                            user.role === "USER"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                              : "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                          }`}
                        >
                          {user.role === "USER"
                            ? "Пользователь"
                            : user.role === "USERCARDS"
                              ? "Работает с картами"
                              : user.role}
                        </div>
                      </TableCell>
                      <TableCell className="space-x-1">
                        <Link href={`/users/${user.id}`}>
                          <Button
                            variant="bordered"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant={user.isActive ? "flat" : "bordered"}
                          color={user.isActive ? "danger" : "default"}
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() =>
                            handleToggleActiveStatus(user.id, user.isActive)
                          }
                        >
                          {user.isActive ? (
                            <UserX className="h-4 w-4" />
                          ) : (
                            <UserCheck className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="flat"
                          color="danger"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            if (
                              confirm(
                                `Вы уверены, что хотите удалить пользователя ${user.name}?`,
                              )
                            ) {
                              deleteUser({ userId: user.id });
                            }
                          }}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* ──────────────── Пагинация ──────────────── */}
              {totalPages > 1 && (
                <div className="mt-4 flex justify-center">
                  <div className="flex gap-2">
                    <Button
                      variant="bordered"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
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
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Вперёд
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
