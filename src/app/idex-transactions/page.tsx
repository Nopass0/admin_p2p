"use client";

import { useState, useEffect } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Table, TableBody, TableCell, TableHeader, TableColumn, TableRow } from "@heroui/table";
import { Card, CardBody, CardHeader, CardFooter } from "@heroui/card";
import { Alert } from "@heroui/alert";
import { CheckCircle, AlertCircle, RefreshCw, Calendar, Filter } from "lucide-react";

// Типы данных
type TimeFilterPreset = "last12h" | "last24h" | "today" | "yesterday" | "thisWeek" | "last2days" | "thisMonth";
type TransactionStatus = { value: string; label: string; };

interface AlertState {
  isVisible: boolean;
  title: string;
  description: string;
  color: "success" | "danger" | "primary" | "warning" | "default" | "secondary";
}

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
  // State
  const [cabinetId, setCabinetId] = useState<number | null>(null);
  const [cabinets, setCabinets] = useState<any[]>([]);
  const [isLoadingCabinets, setIsLoadingCabinets] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [selectedPreset, setSelectedPreset] = useState<TimeFilterPreset>("last24h");
  const [timeFilterType, setTimeFilterType] = useState<"preset" | "custom">("preset");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedTransactionId, setSelectedTransactionId] = useState<number | null>(null);
  const [systemTransactionId, setSystemTransactionId] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [alert, setAlert] = useState<AlertState>({
    isVisible: false,
    title: "",
    description: "",
    color: "default"
  });
  
  // Pagination links
  const pageNumbers = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
    pageNumbers.push(i);
  }

  // Load cabinets on mount using fetch
  useEffect(() => {
    const fetchCabinets = async () => {
      try {
        setIsLoadingCabinets(true);
        const response = await fetch('/api/trpc/idex.getAllCabinets?batch=1&input={"0":{"json":{"page":1,"perPage":100}}}');
        const data = await response.json();
        
        if (data.result.data[0].json?.cabinets) {
          setCabinets(data.result.data[0].json.cabinets);
        }
      } catch (error) {
        console.error('Error fetching cabinets:', error);
        showAlert("Ошибка", "Не удалось загрузить список кабинетов", "danger");
      } finally {
        setIsLoadingCabinets(false);
      }
    };
    
    fetchCabinets();
  }, []);

  // Load transactions when cabinet changes
  useEffect(() => {
    if (cabinetId) {
      loadTransactions();
    }
  }, [cabinetId, page, statusFilter, timeFilterType, selectedPreset, customStartDate, customEndDate]);

  // Function to load transactions
  const loadTransactions = async () => {
    if (!cabinetId) return;
    
    try {
      setIsLoadingTransactions(true);
      
      // Create timeFilter object
      const timeFilter = timeFilterType === "preset" 
        ? { preset: selectedPreset }
        : { startDate: customStartDate, endDate: customEndDate };
      
      const input = {
        cabinetId,
        page,
        perPage,
        status: statusFilter,
        timeFilter
      };
      
      // Use fetch instead of React Query
      const response = await fetch(`/api/trpc/idex.getCabinetTransactions?batch=1&input={"0":{"json":${JSON.stringify(input)}}}`);
      const data = await response.json();
      
      if (data.result.data[0].json) {
        const result = data.result.data[0].json;
        setTransactions(result.transactions || []);
        setTotalCount(result.totalCount || 0);
        setTotalPages(result.totalPages || 1);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
      showAlert("Ошибка", "Не удалось загрузить транзакции", "danger");
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  // Function to sync cabinet
  const syncCabinet = async () => {
    if (!cabinetId) {
      showAlert("Ошибка", "Выберите кабинет для синхронизации", "danger");
      return;
    }
    
    try {
      setIsSyncing(true);
      
      const input = {
        cabinetId,
        pages: 10
      };
      
      const response = await fetch('/api/trpc/idex.syncCabinetById', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batch: 1,
          input: { "0": { json: input } }
        })
      });
      
      const data = await response.json();
      
      if (data.result.data[0].json?.success) {
        showAlert("Успешно", "Кабинет успешно синхронизирован", "success");
        loadTransactions();
      }
    } catch (error) {
      console.error('Error syncing cabinet:', error);
      showAlert("Ошибка", "Не удалось синхронизировать кабинет", "danger");
    } finally {
      setIsSyncing(false);
    }
  };

  // Function to match transaction
  const matchTransaction = async () => {
    if (!selectedTransactionId || !systemTransactionId) {
      showAlert("Ошибка", "Выберите IDEX транзакцию и введите ID системной транзакции", "danger");
      return;
    }
    
    const systemTransactionIdNumber = Number(systemTransactionId);
    if (isNaN(systemTransactionIdNumber) || systemTransactionIdNumber <= 0) {
      showAlert("Ошибка", "ID системной транзакции должен быть положительным числом", "danger");
      return;
    }
    
    try {
      const input = {
        idexTransactionId: selectedTransactionId,
        systemTransactionId: systemTransactionIdNumber
      };
      
      const response = await fetch('/api/trpc/idex.matchTransaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batch: 1,
          input: { "0": { json: input } }
        })
      });
      
      const data = await response.json();
      
      if (data.result.data[0].json?.success) {
        showAlert("Успешно", "Транзакция успешно сопоставлена", "success");
        setSelectedTransactionId(null);
        setSystemTransactionId("");
        loadTransactions();
      }
    } catch (error) {
      console.error('Error matching transaction:', error);
      showAlert("Ошибка", "Не удалось сопоставить транзакцию", "danger");
    }
  };

  // Function to unmatch transaction
  const unmatchTransaction = async (id: number) => {
    try {
      const input = { idexTransactionId: id };
      
      const response = await fetch('/api/trpc/idex.unmatchTransaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batch: 1,
          input: { "0": { json: input } }
        })
      });
      
      const data = await response.json();
      
      if (data.result.data[0].json?.success) {
        showAlert("Успешно", "Сопоставление транзакции отменено", "success");
        loadTransactions();
      }
    } catch (error) {
      console.error('Error unmatching transaction:', error);
      showAlert("Ошибка", "Не удалось отменить сопоставление", "danger");
    }
  };

  // Alert function
  const showAlert = (title: string, description: string, color: AlertState['color']) => {
    setAlert({
      isVisible: true,
      title,
      description,
      color
    });
    
    setTimeout(() => {
      setAlert(prev => ({ ...prev, isVisible: false }));
    }, 5000);
  };

  // Utility functions
  const formatDate = (date: any) => {
    if (!date) return "—";
    return new Date(date).toLocaleString("ru-RU");
  };

  const getStatusLabel = (status: number) => {
    const statusItem = TRANSACTION_STATUSES.find(s => s.value === status.toString());
    return statusItem ? statusItem.label : "Неизвестно";
  };

  return (
    <div className="container mx-auto p-6">
      {/* Alert */}
      {alert.isVisible && (
        <div className="fixed top-4 right-4 z-50 w-96">
          <Alert
            color={alert.color}
            variant="solid"
            title={alert.title}
            description={alert.description}
            isVisible={alert.isVisible}
            isClosable={true}
            onVisibleChange={(isVisible) => setAlert(prev => ({ ...prev, isVisible }))}
            icon={alert.color === "success" ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          />
        </div>
      )}
      
      <h1 className="text-2xl font-bold mb-6">Транзакции IDEX</h1>
      
      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <h3 className="text-lg font-medium">Фильтры</h3>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Cabinet Select */}
            <div>
              <label className="block text-sm font-medium mb-1">Кабинет IDEX</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                onChange={e => setCabinetId(e.target.value ? Number(e.target.value) : null)}
                value={cabinetId || ""}
                aria-label="Выберите кабинет"
              >
                <option value="">Выберите кабинет</option>
                {cabinets.map(cabinet => (
                  <option key={cabinet.id} value={cabinet.id}>
                    {cabinet.login} (ID: {cabinet.idexId})
                  </option>
                ))}
              </select>
            </div>
            
            {/* Status Select */}
            <div>
              <label className="block text-sm font-medium mb-1">Статус</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                onChange={e => setStatusFilter(e.target.value)}
                value={statusFilter}
                aria-label="Выберите статус"
              >
                {TRANSACTION_STATUSES.map(status => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Time Filter Type */}
            <div>
              <label className="block text-sm font-medium mb-1">Тип временного фильтра</label>
              <div className="flex space-x-2">
                <Button
                  variant={timeFilterType === "preset" ? "solid" : "flat"}
                  onClick={() => setTimeFilterType("preset")}
                  aria-label="Использовать пресеты времени"
                >
                  Пресет
                </Button>
                <Button
                  variant={timeFilterType === "custom" ? "solid" : "flat"}
                  onClick={() => setTimeFilterType("custom")}
                  aria-label="Использовать произвольные даты"
                >
                  Произвольные даты
                </Button>
              </div>
            </div>
            
            {/* Time Filter Options */}
            {timeFilterType === "preset" ? (
              <div className="md:col-span-3">
                <label className="block text-sm font-medium mb-1">Временной период</label>
                <div className="flex flex-wrap gap-2">
                  {TIME_FILTER_PRESETS.map((preset) => (
                    <Button
                      key={preset.value}
                      variant={selectedPreset === preset.value ? "solid" : "flat"}
                      onClick={() => setSelectedPreset(preset.value)}
                      size="sm"
                      aria-label={`Выбрать период ${preset.label}`}
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
                    startContent={<Calendar className="w-4 h-4 text-gray-500" />}
                    aria-label="Дата начала"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Дата окончания</label>
                  <Input
                    type="datetime-local"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    startContent={<Calendar className="w-4 h-4 text-gray-500" />}
                    aria-label="Дата окончания"
                  />
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={loadTransactions}
                    aria-label="Применить фильтр по датам"
                  >
                    Применить
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardBody>
        <CardFooter>
          <Button
            color="primary"
            startIcon={<RefreshCw className="w-4 h-4" />}
            onClick={syncCabinet}
            isLoading={isSyncing}
            disabled={!cabinetId || isSyncing}
            aria-label="Синхронизировать кабинет"
          >
            {isSyncing ? "Синхронизация..." : "Синхронизировать кабинет"}
          </Button>
        </CardFooter>
      </Card>
      
      {/* Transactions Table */}
      <Card>
        <CardBody className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <Table aria-label="Таблица транзакций IDEX">
              <TableHeader>
                <TableColumn>ID</TableColumn>
                <TableColumn>Сумма</TableColumn>
                <TableColumn>Валюта</TableColumn>
                <TableColumn>TxID</TableColumn>
                <TableColumn>Создана</TableColumn>
                <TableColumn>Подтверждена</TableColumn>
                <TableColumn>Статус</TableColumn>
                <TableColumn>Сопоставлено с</TableColumn>
                <TableColumn>Действия</TableColumn>
              </TableHeader>
              <TableBody>
                {isLoadingTransactions ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-4">
                      Загрузка...
                    </TableCell>
                  </TableRow>
                ) : transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-4">
                      Нет транзакций
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx) => (
                    <TableRow 
                      key={tx.id}
                      className={selectedTransactionId === tx.id ? "bg-gray-100" : ""}
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
                            color="danger" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              unmatchTransaction(tx.id);
                            }}
                            aria-label="Отменить сопоставление"
                          >
                            Отменить
                          </Button>
                        ) : (
                          <Button 
                            variant="flat" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTransactionId(tx.id);
                            }}
                            aria-label="Выбрать транзакцию"
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
        </CardBody>
        
        <CardFooter className="flex justify-between items-center pt-4">
          <div className="text-sm text-gray-500">
            Всего: {totalCount} транзакций
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center space-x-2">
              <Button
                variant="flat"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                aria-label="Предыдущая страница"
              >
                Назад
              </Button>
              
              {pageNumbers.map((p) => (
                <Button
                  key={p}
                  variant={p === page ? "solid" : "flat"}
                  size="sm"
                  onClick={() => setPage(p)}
                  aria-label={`Страница ${p}`}
                >
                  {p}
                </Button>
              ))}
              
              <Button
                variant="flat"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                aria-label="Следующая страница"
              >
                Вперёд
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
      
      {/* Match Form */}
      {selectedTransactionId && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex flex-col">
              <h3 className="text-lg font-medium">Сопоставить транзакцию</h3>
              <p className="text-sm text-gray-500">
                Выбрана транзакция IDEX #{selectedTransactionId}
              </p>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  ID транзакции в системе
                </label>
                <Input
                  value={systemTransactionId}
                  onChange={(e) => setSystemTransactionId(e.target.value)}
                  placeholder="Введите ID транзакции из системы"
                  aria-label="ID транзакции в системе"
                />
              </div>
            </div>
          </CardBody>
          <CardFooter className="flex justify-between">
            <Button
              variant="flat"
              onClick={() => setSelectedTransactionId(null)}
              aria-label="Отменить сопоставление"
            >
              Отмена
            </Button>
            <Button
              color="primary"
              onClick={matchTransaction}
              disabled={!systemTransactionId}
              aria-label="Сопоставить транзакцию"
            >
              Сопоставить
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}