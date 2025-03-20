"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { api } from "@/trpc/react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/table";
import { Pagination } from "@heroui/pagination";
import { Spinner } from "@heroui/spinner";
import { Badge } from "@heroui/badge";
import { Calendar, ArrowLeft, Filter, RefreshCw, Globe } from "lucide-react";
import Link from "next/link";

export default function IdexCabinetTransactionsPage() {
  const params = useParams();
  const cabinetId = parseInt(params.id as string);
  
  // Состояние для фильтров и пагинации
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<string>("");
  const [timeFilter, setTimeFilter] = useState<string>("last24h");
  
  // Получение информации о кабинете
  const {
    data: cabinetData,
    isLoading: isCabinetLoading
  } = api.idex.getCabinetById.useQuery({ id: cabinetId }, {
    enabled: !isNaN(cabinetId)
  });
  
  // Получение транзакций кабинета
  const {
    data,
    isLoading,
    refetch,
    isRefetching
  } = api.idex.getCabinetTransactions.useQuery({
    cabinetId,
    page,
    perPage: pageSize,
    timeFilter: timeFilter !== "custom" ? { preset: timeFilter as any } : {
      startDate: startDate || undefined,
      endDate: endDate || undefined
    },
    status: status || undefined
  }, {
    enabled: !isNaN(cabinetId),
    refetchOnWindowFocus: false
  });
  
  // Обновление данных при изменении параметров
  useEffect(() => {
    if (!isNaN(cabinetId)) {
      void refetch();
    }
  }, [cabinetId, page, pageSize, timeFilter, refetch]);
  
  // Обработчик изменения временного фильтра
  const handleTimeFilterChange = (value: string) => {
    setTimeFilter(value);
    if (value !== "custom") {
      // Сбрасываем пользовательские даты, если выбран пресет
      setStartDate("");
      setEndDate("");
      setPage(1);
    }
  };
  
  // Обработчик сброса фильтров
  const handleResetFilters = () => {
    setTimeFilter("last24h");
    setStartDate("");
    setEndDate("");
    setStatus("");
    setPage(1);
  };
  
  // Обработчик применения фильтров
  const handleApplyFilters = () => {
    setPage(1);
    void refetch();
  };
  
  // Рендер статуса транзакции
  const renderStatus = (status: number) => {
    let color: "success" | "warning" | "danger" | "primary" = "primary";
    let label = "Неизвестно";
    
    switch (status) {
      case 2:
        color = "success";
        label = "Завершено";
        break;
      case 3:
        color = "warning";
        label = "В обработке";
        break;
      case 7:
      case 8:
      case 9:
        color = "danger";
        label = "Отменено/Ошибка";
        break;
      default:
        color = "primary";
        label = `Статус: ${status}`;
    }
    
    return <Badge color={color}>{label}</Badge>;
  };
  
  // Форматирование JSON полей для отображения
  const formatJsonField = (field: any): string => {
    if (!field) return "-";
    
    try {
      const parsedField = typeof field === 'string' ? JSON.parse(field) : field;
      
      if (parsedField.trader) {
        // Ищем ключи и значения
        const keys = Object.keys(parsedField.trader);
        if (keys.length > 0) {
          const firstKey = keys[0];
          const value = parsedField.trader[firstKey];
          
          if (firstKey === "643") {
            return `${value} RUB`;
          } else if (firstKey === "000001") {
            return `${value} USDT`;
          } else {
            return `${value} (${firstKey})`;
          }
        }
      }
      
      return JSON.stringify(parsedField);
    } catch (e) {
      console.error("Error parsing JSON field:", e);
      return String(field);
    }
  };


  const formatTotal = (total: any): string => {
    if (!total) return "-";
    
    try {
      const parsedTotal = typeof total === 'string' ? JSON.parse(total) : total;
      
      if (parsedTotal.trader) {
        // Ищем ключи и значения
        const keys = Object.keys(parsedTotal.trader);
        if (keys.length > 0) {
          const firstKey = keys[0];
          const value = parsedTotal.trader["000001"];
          
          return `${value} USDT`;
        }
      }
      
      return JSON.stringify(parsedTotal);
    } catch (e) {
      console.error("Error parsing JSON field:", e);
      return String(total);
    }
  };
  
  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/idex-cabinets">
              <Button variant="flat" isIconOnly size="sm">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Транзакции IDEX кабинета</h1>
          </div>
          {cabinetData?.cabinet && (
            <p className="text-gray-500 mt-1">
              Кабинет: {cabinetData.cabinet.login} (ID: {cabinetData.cabinet.idexId})
            </p>
          )}
        </div>
        <Link href="/idex-cabinets">
          <Button variant="bordered">
            К списку кабинетов
          </Button>
        </Link>
      </div>
      
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
              <label className="block text-sm font-medium mb-1">Временной период</label>
              <Select
                placeholder="Выберите период"
                selectedKeys={[timeFilter]}
                onChange={(e) => handleTimeFilterChange(e.target.value)}
              >
                <SelectItem key="last12h">Последние 12 часов</SelectItem>
                <SelectItem key="last24h">Последние 24 часа</SelectItem>
                <SelectItem key="today">Сегодня</SelectItem>
                <SelectItem key="yesterday">Вчера</SelectItem>
                <SelectItem key="thisWeek">Эта неделя</SelectItem>
                <SelectItem key="last2days">Последние 2 дня</SelectItem>
                <SelectItem key="thisMonth">Этот месяц</SelectItem>
                <SelectItem key="custom">Произвольный период</SelectItem>
              </Select>
            </div>
            
            {timeFilter === "custom" && (
              <>
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
              </>
            )}
            
            <div>
              <label className="block text-sm font-medium mb-1">Статус</label>
              <Select
                placeholder="Все статусы"
                selectedKeys={status ? [status] : []}
                onChange={(e) => setStatus(e.target.value)}
              >
                <SelectItem key="">Все статусы</SelectItem>
                <SelectItem key="2">Завершено</SelectItem>
                <SelectItem key="3">В обработке</SelectItem>
                <SelectItem key="7">Отменено</SelectItem>
                <SelectItem key="8">Ошибка</SelectItem>
                <SelectItem key="9">Отказано</SelectItem>
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
          <h3 className="text-lg font-medium">Транзакции кабинета</h3>
        </CardHeader>
        <CardBody>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner size="lg" color="primary" />
            </div>
          ) : data?.transactions && data.transactions.length > 0 ? (
            <div>
              <div className="overflow-x-auto">
                <Table aria-label="Транзакции IDEX кабинета">
                  <TableHeader>
                    <TableColumn>ID</TableColumn>
                    <TableColumn>Внешний ID</TableColumn>
                    <TableColumn>Дата</TableColumn>
                    <TableColumn>Кошелек</TableColumn>
                    <TableColumn>Сумма</TableColumn>
                    <TableColumn>Итого</TableColumn>
                    <TableColumn>USDT</TableColumn>
                    <TableColumn>Статус</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {data.transactions.map((transaction: any) => (
                      <TableRow key={transaction.id}>
                        <TableCell>{transaction.id}</TableCell>
                        <TableCell>{String(transaction.externalId)}</TableCell>
                        <TableCell>
                          {transaction.approvedAt ? new Date(transaction.approvedAt).toLocaleString() : "-"}
                        </TableCell>
                        <TableCell>{transaction.wallet || "-"}</TableCell>
                        <TableCell>{formatJsonField(transaction.amount)}</TableCell>
                        <TableCell>{formatJsonField(transaction.total)}</TableCell>
                        <TableCell>{formatTotal(transaction.total)}</TableCell>
                        <TableCell>{renderStatus(transaction.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Пагинация */}
              {data.totalCount > 0 && (
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-gray-500">
                    Всего: {data.totalCount} транзакций
                  </div>
                  <Pagination
                    total={data.totalPages}
                    initialPage={data.currentPage}
                    onChange={setPage}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-10 text-gray-500">
              <Globe className="w-16 h-16 mx-auto text-gray-400 mb-2" />
              <p>Нет транзакций для отображения</p>
              <Button
                variant="flat"
                color="primary"
                size="sm"
                className="mt-2"
                onClick={handleResetFilters}
              >
                Сбросить фильтры
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
