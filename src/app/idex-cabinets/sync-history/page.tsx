"use client";

import { useState, useEffect } from "react";
import { api } from "@/trpc/react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Spinner } from "@heroui/spinner";
import { Select, SelectItem } from "@heroui/select";
import { Badge } from "@heroui/badge";
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from "@heroui/table";
import { Pagination } from "@heroui/pagination";
import { Clock, RefreshCw, CheckCircle, AlertCircle, ArrowUpDown, AlertTriangle } from "lucide-react";

interface SyncOrderStatusBadgeProps {
  status: string;
}

const SyncOrderStatusBadge = ({ status }: SyncOrderStatusBadgeProps) => {
  switch (status) {
    case "PENDING":
      return <Badge color="warning" startIcon={<Clock className="w-3 h-3" />}>Ожидание</Badge>;
    case "IN_PROGRESS":
      return <Badge color="primary" startIcon={<RefreshCw className="w-3 h-3" />}>Выполняется</Badge>;
    case "COMPLETED":
      return <Badge color="success" startIcon={<CheckCircle className="w-3 h-3" />}>Выполнено</Badge>;
    case "FAILED":
      return <Badge color="danger" startIcon={<AlertCircle className="w-3 h-3" />}>Ошибка</Badge>;
    default:
      return <Badge color="default" startIcon={<AlertTriangle className="w-3 h-3" />}>Неизвестно</Badge>;
  }
};

export default function SyncHistoryPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [refreshInterval, setRefreshInterval] = useState<number>(10000); // 10 seconds refresh by default
  
  // Запрос на получение истории синхронизаций
  const {
    data: syncHistoryData,
    isLoading: isLoadingSyncHistory,
    refetch: refetchSyncHistory,
  } = api.idex.getSyncHistory.useQuery(
    {
      page,
      perPage: pageSize,
      status: statusFilter as any,
    },
    {
      refetchOnWindowFocus: false,
      refetchInterval: refreshInterval, // Автоматическое обновление
    }
  );
  
  // Форматирование даты и времени
  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };
  
  // Форматирование данных обработки
  const formatProcessedData = (processedData: any, field: string) => {
    if (!processedData || Object.keys(processedData).length === 0) {
      return "—";
    }
    
    try {
      let totalValue = 0;
      
      // Суммируем значения по всем кабинетам
      Object.values(processedData).forEach((cabinetData: any) => {
        if (cabinetData && cabinetData[field]) {
          totalValue += Number(cabinetData[field]) || 0;
        }
      });
      
      return totalValue;
    } catch (error) {
      console.error("Ошибка при форматировании данных обработки:", error);
      return "—";
    }
  };
  
  // Определение колонок таблицы
  const columns = [
    { key: "id", label: "ID" },
    { key: "createdAt", label: "Дата создания" },
    { key: "startSyncAt", label: "Начало обработки" },
    { key: "endSyncAt", label: "Окончание" },
    { key: "status", label: "Статус" },
    { key: "cabinet", label: "Кабинет" },
    { key: "totalProcessed", label: "Обработано" },
    { key: "totalNew", label: "Добавлено" },
    { key: "actions", label: "Действия" },
  ];
  
  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value === "all" ? undefined : value);
    setPage(1); // Сбрасываем страницу при изменении фильтра
  };
  
  const handleRefresh = () => {
    void refetchSyncHistory();
  };
  
  // Проверяем, есть ли активные заказы на синхронизацию
  const hasActiveOrders = syncHistoryData?.syncOrders.some(
    (order) => order.status === "PENDING" || order.status === "IN_PROGRESS"
  );
  
  // Устанавливаем интервал обновления в зависимости от наличия активных заказов
  useEffect(() => {
    if (hasActiveOrders) {
      setRefreshInterval(5000); // Более частое обновление при наличии активных заказов
    } else {
      setRefreshInterval(30000); // Более редкое обновление, если нет активных заказов
    }
  }, [hasActiveOrders]);
  
  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">История синхронизаций IDEX</h1>
        <div className="flex gap-2">
          <Select
            placeholder="Статус"
            size="sm"
            value={statusFilter ?? "all"}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
          >
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="PENDING">Ожидание</SelectItem>
            <SelectItem value="IN_PROGRESS">Выполняется</SelectItem>
            <SelectItem value="COMPLETED">Выполнено</SelectItem>
            <SelectItem value="FAILED">Ошибка</SelectItem>
          </Select>
          <Button
            color="primary"
            variant="flat"
            size="sm"
            startIcon={<RefreshCw className="w-4 h-4" />}
            onClick={handleRefresh}
          >
            Обновить
          </Button>
          <Button
            color="primary"
            size="sm"
            onClick={() => window.location.href = "/idex-cabinets"}
          >
            Кабинеты
          </Button>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-500" />
            <h3 className="text-lg font-medium">Список запросов на синхронизацию</h3>
          </div>
        </CardHeader>
        <CardBody>
          {isLoadingSyncHistory ? (
            <div className="flex justify-center py-10">
              <Spinner size="lg" color="primary" />
            </div>
          ) : syncHistoryData?.syncOrders && syncHistoryData.syncOrders.length > 0 ? (
            <div>
              <Table className="mt-2">
                <TableHeader>
                  {columns.map((column) => (
                    <TableColumn key={column.key} className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {column.label}
                      </div>
                    </TableColumn>
                  ))}
                </TableHeader>
                <TableBody>
                  {syncHistoryData.syncOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="text-center">{order.id}</TableCell>
                      <TableCell className="text-center">{formatDateTime(order.createdAt)}</TableCell>
                      <TableCell className="text-center">{formatDateTime(order.startSyncAt)}</TableCell>
                      <TableCell className="text-center">{formatDateTime(order.endSyncAt)}</TableCell>
                      <TableCell className="text-center">
                        <SyncOrderStatusBadge status={order.status} />
                      </TableCell>
                      <TableCell className="text-center">
                        {order.cabinetId === 0 ? (
                          <Badge color="secondary">Все кабинеты</Badge>
                        ) : (
                          order.cabinet ? (
                            <span>{order.cabinet.login} (ID: {order.cabinet.idexId})</span>
                          ) : (
                            <span>Кабинет #{order.cabinetId}</span>
                          )
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {formatProcessedData(order.processed, 'transactions')}
                      </TableCell>
                      <TableCell className="text-center">
                        {formatProcessedData(order.processed, 'newTransactions')}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1">
                          <Button
                            size="sm"
                            variant="flat"
                            color="primary"
                            startIcon={<RefreshCw className="w-3 h-3" />}
                            onClick={() => void refetchSyncHistory()}
                          >
                            Обновить
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {syncHistoryData.totalPages > 1 && (
                <div className="flex justify-center mt-4">
                  <Pagination
                    total={syncHistoryData.totalPages}
                    color="primary"
                    initialPage={page}
                    page={page}
                    onChange={setPage}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-10 text-gray-500">
              <Clock className="w-16 h-16 mx-auto text-gray-400 mb-2" />
              <p>Нет запросов на синхронизацию</p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
