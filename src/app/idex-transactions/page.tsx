"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react/button";
import { Input } from "@heroui/react/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@heroui/react/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@heroui/react/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@heroui/react/card";
import { toast } from "sonner";
import { api } from "@/trpc/react";

// Типы данных
type TimeFilterPreset = "last12h" | "last24h" | "today" | "yesterday" | "thisWeek" | "last2days" | "thisMonth";

type TimeFilter = 
  | { preset: TimeFilterPreset }
  | { startDate?: string; endDate?: string };

type TransactionStatus = {
  value: string;
  label: string;
};

const TRANSACTION_STATUSES: TransactionStatus[] = [
  { value: "", label: "Все" },
  { value: "0", label: "Ожидает" },
  { value: "1", label: "Новая" },
  { value: "2", label: "Сопоставлена" },
  { value: "3", label: "Ошибка" },
];

const TIME_FILTER_PRESETS: { value: TimeFilterPreset; label: string }[] = [
  { value: "last12h", label: "Последние 12 часов" },
  { value: "last24h", label: "Последние 24 часа" },
  { value: "today", label: "Сегодня" },
  { value: "yesterday", label: "Вчера" },
  { value: "thisWeek", label: "Эта неделя" },
  { value: "last2days", label: "Последние 2 дня" },
  { value: "thisMonth", label: "Этот месяц" },
];

export default function IdexTransactionsPage() {
  const router = useRouter();
  
  // Параметры для фильтрации и пагинации
  const [cabinetId, setCabinetId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [status, setStatus] = useState<string>("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>({ preset: "last24h" });
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [timeFilterType, setTimeFilterType] = useState<"preset" | "custom">("preset");
  
  // Для сопоставления транзакций
  const [selectedTransactionId, setSelectedTransactionId] = useState<number | null>(null);
  const [systemTransactionId, setSystemTransactionId] = useState<string>("");
  
  // Получение списка кабинетов IDEX
  const cabinetsQuery = api.idex.getAllCabinets.useQuery(
    { page: 1, perPage: 100 },
    { enabled: true }
  );
  
  // Получение транзакций выбранного кабинета
  const transactionsQuery = api.idex.getCabinetTransactions.useQuery(
    { 
      cabinetId: cabinetId || 0,
      page,
      perPage,
      status,
      timeFilter: timeFilterType === "preset" 
        ? { preset: (timeFilter as { preset: TimeFilterPreset }).preset } 
        : { startDate: customStartDate, endDate: customEndDate }
    },
    { 
      enabled: !!cabinetId,
      staleTime: 1000 * 60, // 1 минута
      refetchInterval: 1000 * 60 * 5 // 5 минут
    }
  );
  
  // Мутация для сопоставления транзакций
  const matchMutation = api.idex.matchTransaction.useMutation({
    onSuccess: () => {
      toast.success("Транзакция успешно сопоставлена");
      setSelectedTransactionId(null);
      setSystemTransactionId("");
      transactionsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Ошибка при сопоставлении: ${error.message}`);
    }
  });
  
  // Мутация для отмены сопоставления
  const unmatchMutation = api.idex.unmatchTransaction.useMutation({
    onSuccess: () => {
      toast.success("Сопоставление транзакции отменено");
      transactionsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Ошибка при отмене сопоставления: ${error.message}`);
    }
  });
  
  // Мутация для синхронизации кабинета
  const syncMutation = api.idex.syncCabinetById.useMutation({
    onSuccess: () => {
      toast.success("Кабинет успешно синхронизирован");
      transactionsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Ошибка при синхронизации: ${error.message}`);
    }
  });
  
  // Обработчики
  const handleCabinetChange = (value: string) => {
    setCabinetId(Number(value));
    setPage(1);
  };
  
  const handleStatusChange = (value: string) => {
    setStatus(value);
    setPage(1);
  };
  
  const handleTimePresetChange = (value: TimeFilterPreset) => {
    setTimeFilter({ preset: value });
    setPage(1);
  };
  
  const handleTimeFilterTypeChange = (type: "preset" | "custom") => {
    setTimeFilterType(type);
    if (type === "preset") {
      setTimeFilter({ preset: "last24h" });
    } else {
      setTimeFilter({});
    }
    setPage(1);
  };
  
  const handleCustomDateChange = () => {
    setTimeFilter({ startDate: customStartDate, endDate: customEndDate });
    setPage(1);
  };
  
  const handleMatchTransaction = () => {
    if (!selectedTransactionId || !systemTransactionId) {
      toast.error("Выберите IDEX транзакцию и введите ID системной транзакции");
      return;
    }
    
    const systemTransactionIdNumber = Number(systemTransactionId);
    if (isNaN(systemTransactionIdNumber) || systemTransactionIdNumber <= 0) {
      toast.error("ID системной транзакции должен быть положительным числом");
      return;
    }
    
    matchMutation.mutate({
      idexTransactionId: selectedTransactionId,
      systemTransactionId: systemTransactionIdNumber
    });
  };
  
  const handleUnmatchTransaction = (id: number) => {
    unmatchMutation.mutate({ idexTransactionId: id });
  };
  
  const handleSyncCabinet = () => {
    if (!cabinetId) {
      toast.error("Выберите кабинет для синхронизации");
      return;
    }
    
    syncMutation.mutate({ cabinetId, pages: 10 });
  };
  
  // Форматтеры
  const formatDate = (date: Date | string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleString("ru-RU");
  };
  
  const getStatusLabel = (status: number) => {
    const statusItem = TRANSACTION_STATUSES.find(s => s.value === status.toString());
    return statusItem ? statusItem.label : "Неизвестно";
  };
  
  // Формирование пагинации
  const totalPages = transactionsQuery.data?.totalPages || 1;
  const pageNumbers = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
    pageNumbers.push(i);
  }
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Транзакции IDEX</h1>
      
      {/* Фильтры */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Кабинет IDEX</label>
              <Select onValueChange={handleCabinetChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите кабинет" />
                </SelectTrigger>
                <SelectContent>
                  {cabinetsQuery.data?.cabinets.map((cabinet) => (
                    <SelectItem key={cabinet.id} value={cabinet.id.toString()}>
                      {cabinet.login} (IDEX ID: {cabinet.idexId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Статус</label>
              <Select onValueChange={handleStatusChange} defaultValue="">
                <SelectTrigger>
                  <SelectValue placeholder="Выберите статус" />
                </SelectTrigger>
                <SelectContent>
                  {TRANSACTION_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Тип временного фильтра</label>
              <div className="flex space-x-2">
                <Button
                  variant={timeFilterType === "preset" ? "default" : "outline"}
                  onClick={() => handleTimeFilterTypeChange("preset")}
                >
                  Пресет
                </Button>
                <Button
                  variant={timeFilterType === "custom" ? "default" : "outline"}
                  onClick={() => handleTimeFilterTypeChange("custom")}
                >
                  Произвольные даты
                </Button>
              </div>
            </div>
            
            {timeFilterType === "preset" ? (
              <div className="md:col-span-3">
                <label className="block text-sm font-medium mb-1">Временной период</label>
                <div className="flex flex-wrap gap-2">
                  {TIME_FILTER_PRESETS.map((preset) => (
                    <Button
                      key={preset.value}
                      variant={(timeFilter as any).preset === preset.value ? "default" : "outline"}
                      onClick={() => handleTimePresetChange(preset.value)}
                      size="sm"
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Дата начала</label>
                  <Input
                    type="datetime-local"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Дата окончания</label>
                  <Input
                    type="datetime-local"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleCustomDateChange}>Применить</Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSyncCabinet} disabled={!cabinetId || syncMutation.isPending}>
            {syncMutation.isPending ? "Синхронизация..." : "Синхронизировать кабинет"}
          </Button>
        </CardFooter>
      </Card>
      
      {/* Таблица транзакций */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead>Валюта</TableHead>
                  <TableHead>TxID</TableHead>
                  <TableHead>Создана</TableHead>
                  <TableHead>Подтверждена</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Сопоставлено с</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactionsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-4">
                      Загрузка...
                    </TableCell>
                  </TableRow>
                ) : transactionsQuery.data?.transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-4">
                      Нет транзакций
                    </TableCell>
                  </TableRow>
                ) : (
                  transactionsQuery.data?.transactions.map((tx) => (
                    <TableRow 
                      key={tx.id}
                      className={selectedTransactionId === tx.id ? "bg-muted" : ""}
                      onClick={() => !tx.matchedTransactionId && setSelectedTransactionId(tx.id)}
                    >
                      <TableCell>{tx.id}</TableCell>
                      <TableCell>{tx.amount}</TableCell>
                      <TableCell>{tx.currency}</TableCell>
                      <TableCell className="font-mono text-xs">{tx.txId}</TableCell>
                      <TableCell>{formatDate(tx.createdAt)}</TableCell>
                      <TableCell>{formatDate(tx.approvedAt)}</TableCell>
                      <TableCell>{getStatusLabel(tx.status)}</TableCell>
                      <TableCell>
                        {tx.matchedTransactionId ? (
                          <div className="flex items-center">
                            <span className="font-mono">#{tx.matchedTransactionId}</span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {tx.matchedTransactionId ? (
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnmatchTransaction(tx.id);
                            }}
                            disabled={unmatchMutation.isPending}
                          >
                            Отменить
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTransactionId(tx.id);
                            }}
                          >
                            Выбрать
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-between items-center pt-4">
          <div className="text-sm text-muted-foreground">
            Всего: {transactionsQuery.data?.totalCount || 0} транзакций
          </div>
          
          {transactionsQuery.data && transactionsQuery.data.totalPages > 1 && (
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Назад
              </Button>
              
              {pageNumbers.map((p) => (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              ))}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
              >
                Вперёд
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
      
      {/* Форма сопоставления транзакции */}
      {selectedTransactionId && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Сопоставить транзакцию</CardTitle>
            <CardDescription>
              Выбрана транзакция IDEX #{selectedTransactionId}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  ID транзакции в системе
                </label>
                <Input
                  value={systemTransactionId}
                  onChange={(e) => setSystemTransactionId(e.target.value)}
                  placeholder="Введите ID транзакции из системы"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setSelectedTransactionId(null)}
            >
              Отмена
            </Button>
            <Button
              onClick={handleMatchTransaction}
              disabled={matchMutation.isPending || !systemTransactionId}
            >
              {matchMutation.isPending ? "Сопоставление..." : "Сопоставить"}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
