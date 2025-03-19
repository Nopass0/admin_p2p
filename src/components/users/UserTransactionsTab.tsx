"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/table";
import { Pagination } from "@heroui/pagination";
import { Badge } from "@heroui/badge";
import { Spinner } from "@heroui/spinner";
import { Calendar, ArrowRight, Filter, RefreshCw, DollarSign } from "lucide-react";
import Link from "next/link";

interface UserTransactionsTabProps {
  userId: number;
}

export function UserTransactionsTab({ userId }: UserTransactionsTabProps) {
  // Состояние для фильтров и пагинации
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [type, setType] = useState<string>("");
  const [asset, setAsset] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  
  // Получение транзакций пользователя
  const {
    data,
    isLoading,
    refetch,
    isRefetching
  } = api.transactions.getUserTransactions.useQuery({
    userId,
    page,
    pageSize,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    type: type || undefined,
    asset: asset || undefined,
    status: status || undefined
  }, {
    refetchOnWindowFocus: false
  });
  
  // Обработчик сброса фильтров
  const handleResetFilters = () => {
    setStartDate("");
    setEndDate("");
    setType("");
    setAsset("");
    setStatus("");
    setPage(1);
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
  
  return (
    <div>
      {/* Фильтры */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <h3 className="text-md font-medium">Фильтры</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
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
        
        <div className="flex justify-end gap-2 mt-3">
          <Button
            variant="flat"
            onClick={handleResetFilters}
          >
            Сбросить
          </Button>
          <Button
            color="primary"
            onClick={() => {
              setPage(1);
              void refetch();
            }}
            isLoading={isRefetching}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Применить
          </Button>
        </div>
      </div>
      
      {/* Таблица транзакций */}
      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner size="lg" color="primary" />
          </div>
        ) : data?.transactions && data.transactions.length > 0 ? (
          <>
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
          </>
        ) : (
          <div className="text-center py-10 text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <DollarSign className="w-10 h-10 mx-auto text-gray-400 mb-2" />
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
      </div>
    </div>
  );
}
