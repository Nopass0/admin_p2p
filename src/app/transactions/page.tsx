"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/trpc/react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/table";
import { Pagination } from "@heroui/pagination";
import { Spinner } from "@heroui/spinner";
import { Badge } from "@heroui/badge";
import { Calendar, ArrowRight, Filter, RefreshCw, DollarSign } from "lucide-react";
import Link from "next/link";
import { TransactionStatsCard } from "@/components/transactions/TransactionStatsCard";

export default function TransactionsPage() {
  const searchParams = useSearchParams();
  
  // Состояние для фильтров и пагинации
  const [userId, setUserId] = useState<number | undefined>(
    searchParams.get("userId") ? Number(searchParams.get("userId")) : undefined
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [type, setType] = useState<string>("");
  const [asset, setAsset] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  
  // Получение информации о пользователе, если указан userId
  const {
    data: userData,
    isLoading: isUserLoading
  } = api.users.getUserById.useQuery({ userId: Number(userId) }, {
    enabled: !!userId && !isNaN(Number(userId))
  });
  
  // Получение всех транзакций
  const {
    data,
    isLoading,
    refetch,
    isRefetching
  } = api.transactions.getUserTransactions.useQuery({
    userId: userId || 1, // Если userId не указан, получаем транзакции для пользователя с ID 1
    page,
    pageSize,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    type: type || undefined,
    asset: asset || undefined,
    status: status || undefined
  }, {
    enabled: !!userId,
    refetchOnWindowFocus: false
  });
  
  // Получение статистики по транзакциям
  const {
    data: statsData,
    isLoading: isStatsLoading,
    refetch: refetchStats
  } = api.transactions.getUserTransactionStats.useQuery({
    userId: userId || 1,
    startDate: startDate || undefined,
    endDate: endDate || undefined
  }, {
    enabled: !!userId,
    refetchOnWindowFocus: false
  });
  
  // Обновление данных при изменении параметров
  useEffect(() => {
    if (userId) {
      void refetch();
      void refetchStats();
    }
  }, [userId, refetch, refetchStats]);
  
  // Обработчик сброса фильтров
  const handleResetFilters = () => {
    setStartDate("");
    setEndDate("");
    setType("");
    setAsset("");
    setStatus("");
    setPage(1);
  };
  
  // Обработчик применения фильтров
  const handleApplyFilters = () => {
    setPage(1);
    void refetch();
    void refetchStats();
  };
  
  // Рендер статуса транзакции с соответствующим цветом
  const renderStatus = (status: string) => {
    let color: "success" | "warning" | "danger" | "primary" = "primary";
    
    switch (status.toLowerCase()) {
      case "completed":
        color = "success";
        break;
      case "pending":
        color = "warning";
        break;
      case "failed":
        color = "danger";
        break;
      default:
        color = "primary";
    }
    
    return <Badge color={color}>{status}</Badge>;
  };
  
  // Рендер типа транзакции
  const renderType = (type: string, amount: number) => {
    const isBuy = type.toLowerCase() === "buy";
    return (
      <div className={isBuy ? "text-red-500" : "text-green-500"}>
        {isBuy ? "-" : "+"}{amount}
      </div>
    );
  };
  
  // Если не указан userId, показываем сообщение о необходимости выбрать пользователя
  if (!userId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Транзакции</h1>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 text-center">
          <DollarSign className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-medium mb-2">Выберите пользователя</h2>
          <p className="text-gray-500 mb-4">
            Для просмотра транзакций необходимо выбрать пользователя.
          </p>
          <Link href="/users">
            <Button color="primary">
              Перейти к списку пользователей
            </Button>
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Транзакции</h1>
          {userData?.user && (
            <p className="text-gray-500">
              Пользователь: {userData.user.name} (ID: {userData.user.id})
            </p>
          )}
        </div>
        <Link href="/users">
          <Button variant="bordered">
            Список пользователей
          </Button>
        </Link>
      </div>
      
      {/* Карточки со статистикой */}
      {!isStatsLoading && statsData?.success && statsData.stats && (
        <div className="mb-6">
          <TransactionStatsCard stats={statsData.stats} />
        </div>
      )}
      
      {/* Фильтры */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <h3 className="text-lg font-medium">Фильтры</h3>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Начальная дата</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                startContent={<Calendar className="w-4 h-4 text-gray-400" />}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Конечная дата</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                startContent={<Calendar className="w-4 h-4 text-gray-400" />}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Тип</label>
              <Select
                placeholder="Все типы"
                selectedKeys={type ? [type] : []}
                onChange={(e) => setType(e.target.value)}
              >
                <SelectItem key="">Все типы</SelectItem>
                <SelectItem key="buy">Покупка</SelectItem>
                <SelectItem key="sell">Продажа</SelectItem>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Актив</label>
              <Select
                placeholder="Все активы"
                selectedKeys={asset ? [asset] : []}
                onChange={(e) => setAsset(e.target.value)}
              >
                <SelectItem key="">Все активы</SelectItem>
                <SelectItem key="USDT">USDT</SelectItem>
                <SelectItem key="BTC">BTC</SelectItem>
                <SelectItem key="ETH">ETH</SelectItem>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Статус</label>
              <Select
                placeholder="Все статусы"
                selectedKeys={status ? [status] : []}
                onChange={(e) => setStatus(e.target.value)}
              >
                <SelectItem key="">Все статусы</SelectItem>
                <SelectItem key="completed">Завершено</SelectItem>
                <SelectItem key="pending">В обработке</SelectItem>
                <SelectItem key="failed">Не удалось</SelectItem>
              </Select>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="flat"
              onClick={handleResetFilters}
            >
              Сбросить
            </Button>
            <Button
              color="primary"
              onClick={handleApplyFilters}
              isLoading={isRefetching}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Применить
            </Button>
          </div>
        </CardBody>
      </Card>
      
      {/* Таблица транзакций */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-medium">Список транзакций</h3>
        </CardHeader>
        <CardBody>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner size="lg" color="primary" />
            </div>
          ) : data?.transactions && data.transactions.length > 0 ? (
            <div>
              <div className="overflow-x-auto">
                <Table aria-label="Транзакции пользователя">
                  <TableHeader>
                    <TableColumn>ID</TableColumn>
                    <TableColumn>Дата</TableColumn>
                    <TableColumn>Тип</TableColumn>
                    <TableColumn>Актив</TableColumn>
                    <TableColumn>Количество</TableColumn>
                    <TableColumn>Сумма</TableColumn>
                    <TableColumn>Статус</TableColumn>
                    <TableColumn>Действия</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {data.transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>{transaction.id}</TableCell>
                        <TableCell>{new Date(transaction.dateTime).toLocaleString()}</TableCell>
                        <TableCell>{transaction.type}</TableCell>
                        <TableCell>{transaction.asset}</TableCell>
                        <TableCell>{renderType(transaction.type, transaction.amount)}</TableCell>
                        <TableCell>{transaction.totalPrice.toFixed(2)} RUB</TableCell>
                        <TableCell>{renderStatus(transaction.status)}</TableCell>
                        <TableCell>
                          <Link href={`/transactions/${transaction.id}`}>
                            <Button size="sm" variant="bordered">
                              Детали
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Пагинация */}
              {data.pagination && (
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-gray-500">
                    Всего: {data.pagination.totalTransactions} транзакций
                  </div>
                  <Pagination
                    total={data.pagination.totalPages}
                    initialPage={page}
                    onChange={(newPage) => setPage(newPage)}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-10 text-gray-500">
              <DollarSign className="w-16 h-16 mx-auto text-gray-400 mb-2" />
              <p>Нет транзакций для отображения</p>
              {(startDate || endDate || type || asset || status) && (
                <Button
                  variant="flat"
                  color="primary"
                  size="sm"
                  className="mt-2"
                  onClick={handleResetFilters}
                >
                  Сбросить фильтры
                </Button>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
