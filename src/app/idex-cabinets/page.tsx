"use client";

import { useState, useMemo, useEffect } from "react";
import { api } from "@/trpc/react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Spinner } from "@heroui/spinner";
import { Checkbox } from "@heroui/checkbox";
import { Input } from "@heroui/input";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/table";
import { Pagination } from "@heroui/pagination";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { PlusIcon, RefreshCw, Globe, CheckCircle, AlertCircle, DownloadIcon, Calculator, History, Database, FileText } from "lucide-react";
import { Alert } from "@heroui/alert";
import { IdexSyncOrdersModal } from "@/components/idex/IdexSyncOrdersModal"; // Assuming this component exists
import { formatNumber } from "@/utils/format"; // Assuming you have this utility or we'll create it

interface CabinetWithTotals {
  id: number;
  idexId: number;
  login: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    transactions: number;
  };
  totals: {
    amountRub: number;
    amountUsdt: number;
    totalRub: number;
    totalUsdt: number;
  };
}

interface AlertState {
  isVisible: boolean;
  title: string;
  description: string;
  color: "success" | "danger" | "primary" | "warning" | "default" | "secondary";
}

export default function IdexCabinetsTotalsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCabinets, setSelectedCabinets] = useState<Set<number>>(new Set());
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSyncOrdersModalOpen, setIsSyncOrdersModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pagesToFetch, setPagesFetch] = useState(10);
  const [selectedCabinetId, setSelectedCabinetId] = useState<number | null>(null);
  const [alert, setAlert] = useState<AlertState>({
    isVisible: false,
    title: "",
    description: "",
    color: "default"
  });
  
  const showAlert = (title: string, description: string, color: AlertState['color']) => {
    setAlert({
      isVisible: true,
      title,
      description,
      color
    });
    
    // Auto-hide alert after 5 seconds
    setTimeout(() => {
      setAlert(prev => ({ ...prev, isVisible: false }));
    }, 5000);
  };
  
  // Fetch cabinets with totals
  const {
    data: cabinetsData,
    isLoading: isLoadingCabinets,
    refetch: refetchCabinets,
  } = api.idex.getCabinetsWithTotals.useQuery({
    page,
    perPage: pageSize,
    startDate,
    endDate
  }, {
    refetchOnWindowFocus: false
  });
  
  // Fetch IdexStats for overall system statistics
  const {
    data: idexStats,
    isLoading: isLoadingStats,
  } = api.idex.getIdexStats.useQuery(undefined, {
    refetchOnWindowFocus: false
  });
  
  // Handle cabinet selection
  const toggleCabinetSelection = (cabinetId: number) => {
    const newSelection = new Set(selectedCabinets);
    if (newSelection.has(cabinetId)) {
      newSelection.delete(cabinetId);
    } else {
      newSelection.add(cabinetId);
    }
    setSelectedCabinets(newSelection);
  };
  
  // Handle "Select All" checkbox
  const toggleSelectAll = () => {
    if (cabinetsData?.cabinets) {
      if (selectedCabinets.size === cabinetsData.cabinets.length) {
        // Deselect all
        setSelectedCabinets(new Set());
      } else {
        // Select all
        const allIds = cabinetsData.cabinets.map(cabinet => cabinet.id);
        setSelectedCabinets(new Set(allIds));
      }
    }
  };
  
  // Calculate totals and counts for selected cabinets
  const selectedStats = useMemo(() => {
    if (!cabinetsData?.cabinets) return { 
      amountRub: 0, 
      amountUsdt: 0, 
      totalRub: 0, 
      totalUsdt: 0,
      transactionCount: 0 
    };
    
    return cabinetsData.cabinets
      .filter(cabinet => selectedCabinets.has(cabinet.id))
      .reduce((acc, cabinet) => {
        return {
          amountRub: acc.amountRub + cabinet.totals.amountRub,
          amountUsdt: acc.amountUsdt + cabinet.totals.amountUsdt,
          totalRub: acc.totalRub + cabinet.totals.totalRub,
          totalUsdt: acc.totalUsdt + cabinet.totals.totalUsdt,
          transactionCount: acc.transactionCount + cabinet._count.transactions
        };
      }, { 
        amountRub: 0, 
        amountUsdt: 0, 
        totalRub: 0, 
        totalUsdt: 0,
        transactionCount: 0 
      });
  }, [cabinetsData, selectedCabinets]);
  
  // Calculate total transactions on current page
  const currentPageTransactionCount = useMemo(() => {
    if (!cabinetsData?.cabinets) return 0;
    
    return cabinetsData.cabinets.reduce((sum, cabinet) => {
      return sum + cabinet._count.transactions;
    }, 0);
  }, [cabinetsData]);
  
  // Format currency values
  const formatCurrency = (value: number, currency: string) => {
    return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (currency === 'RUB' ? ' ₽' : ' USDT');
  };
  
  // Sync cabinets mutations
  const syncCabinetsMutation = api.idex.syncAllCabinets.useMutation({
    onSuccess: (data) => {
      showAlert("Успешно", data.message, "success");
      setIsSyncing(false);
      setIsSyncModalOpen(false);
      setIsSyncOrdersModalOpen(true); // Open sync orders modal
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка создания запроса на синхронизацию: ${error.message}`, "danger");
      setIsSyncing(false);
    }
  });
  
  const syncCabinetMutation = api.idex.syncCabinetById.useMutation({
    onSuccess: (data) => {
      showAlert("Успешно", data.message, "success");
      setIsSyncing(false);
      setIsSyncModalOpen(false);
      setIsSyncOrdersModalOpen(true); // Open sync orders modal
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка создания запроса на синхронизацию: ${error.message}`, "danger");
      setIsSyncing(false);
    }
  });
  
  // Sync handlers
  const handleSyncAll = () => {
    setSelectedCabinetId(null);
    setIsSyncModalOpen(true);
  };
  
  const handleSyncCabinet = (id: number) => {
    setSelectedCabinetId(id);
    setIsSyncModalOpen(true);
  };
  
  const handleSyncHistory = () => {
    setIsSyncOrdersModalOpen(true);
  };
  
  const onSyncCabinets = () => {
    setIsSyncing(true);
    if (selectedCabinetId) {
      syncCabinetMutation.mutate({
        cabinetId: selectedCabinetId,
        pages: pagesToFetch
      });
    } else {
      syncCabinetsMutation.mutate({
        pages: pagesToFetch
      });
    }
  };
  
  // Export selected data to CSV
  const exportSelectedToCSV = () => {
    if (!cabinetsData?.cabinets || selectedCabinets.size === 0) {
      showAlert("Внимание", "Нет выбранных кабинетов для экспорта", "warning");
      return;
    }
    
    const selectedData = cabinetsData.cabinets.filter(cabinet => selectedCabinets.has(cabinet.id));
    
    let csvContent = "ID,Логин,Кол-во транзакций,Amount (RUB),Amount (USDT),Total (RUB),Total (USDT)\n";
    selectedData.forEach(cabinet => {
      csvContent += `${cabinet.idexId},${cabinet.login},${cabinet._count.transactions},${cabinet.totals.amountRub},${cabinet.totals.amountUsdt},${cabinet.totals.totalRub},${cabinet.totals.totalUsdt}\n`;
    });
    
    // Add totals row
    csvContent += `ИТОГО,,${selectedStats.transactionCount},${selectedStats.amountRub},${selectedStats.amountUsdt},${selectedStats.totalRub},${selectedStats.totalUsdt}\n`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `idex-cabinets-report-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showAlert("Успешно", "Отчет успешно экспортирован", "success");
  };
  
  return (
    <div className="p-6">
      {/* Alert notification */}
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
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">Финансовый отчет по IDEX кабинетам</h1>
        <div className="flex gap-2">
          <Input
            type="datetime-local"
            placeholder="Начальная дата"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-auto"
          />
          <Input
            type="datetime-local"
            placeholder="Конечная дата"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-auto"
          />
          <Button 
            color="primary" 
            onClick={() => refetchCabinets()}
            startIcon={<RefreshCw className="w-4 h-4" />}
          >
            Применить
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            color="secondary"
            variant="bordered"
            startIcon={<History className="w-4 h-4" />}
            onClick={handleSyncHistory}
          >
            История синхронизаций
          </Button>
          <Button
            color="primary"
            variant="bordered"
            startIcon={<RefreshCw className="w-4 h-4" />}
            onClick={handleSyncAll}
          >
            Синхронизировать все
          </Button>
        </div>
      </div>
      
      {/* System statistics Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h3 className="text-lg font-medium">Общая статистика системы</h3>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Всего кабинетов</div>
              <div className="text-xl font-semibold dark:text-indigo-200">
                {isLoadingStats ? (
                  <Spinner size="sm" color="primary" />
                ) : (
                  idexStats?.totalCabinets || cabinetsData?.totalCount || 0
                )}
              </div>
            </div>
            
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Всего транзакций</div>
              <div className="text-xl font-semibold dark:text-emerald-200">
                {isLoadingStats ? (
                  <Spinner size="sm" color="primary" />
                ) : (
                  idexStats?.totalTransactions || 0
                )}
              </div>
            </div>
            
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Транзакций на текущей странице</div>
              <div className="text-xl font-semibold dark:text-purple-200">
                {isLoadingCabinets ? (
                  <Spinner size="sm" color="primary" />
                ) : (
                  currentPageTransactionCount
                )}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
      
      {/* Selected Cabinets Summary Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <h3 className="text-lg font-medium">Итоги по выбранным кабинетам ({selectedCabinets.size})</h3>
            </div>
            <Button
              color="primary"
              variant="light"
              startIcon={<DownloadIcon className="w-4 h-4" />}
              onClick={exportSelectedToCSV}
              disabled={selectedCabinets.size === 0}
            >
              Экспорт выбранных
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-lg">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Кол-во транзакций</div>
              <div className="text-xl font-semibold dark:text-gray-200">{selectedStats.transactionCount}</div>
            </div>
            
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Сумма Amount (RUB)</div>
              <div className="text-xl font-semibold dark:text-blue-200">{formatCurrency(selectedStats.amountRub, 'RUB')}</div>
            </div>
            

            
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Сумма Total (USDT)</div>
              <div className="text-xl font-semibold dark:text-amber-200">{formatCurrency(selectedStats.totalUsdt, 'USDT')}</div>
            </div>
          </div>
        </CardBody>
      </Card>
      
      {/* Cabinets Table Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-gray-500" />
            <h3 className="text-lg font-medium">Кабинеты с финансовыми показателями</h3>
          </div>
        </CardHeader>
        <CardBody>
          {isLoadingCabinets ? (
            <div className="flex justify-center py-10">
              <Spinner size="lg" color="primary" />
            </div>
          ) : cabinetsData?.cabinets && cabinetsData.cabinets.length > 0 ? (
            <>
              <Table className="mb-4">
                <TableHeader>
                  <TableColumn className="w-12">
                    <Checkbox
                      isSelected={cabinetsData.cabinets.length > 0 && selectedCabinets.size === cabinetsData.cabinets.length}
                      isIndeterminate={selectedCabinets.size > 0 && selectedCabinets.size < cabinetsData.cabinets.length}
                      onChange={toggleSelectAll}
                    />
                  </TableColumn>
                  <TableColumn>ID</TableColumn>
                  <TableColumn>Логин</TableColumn>
                  <TableColumn>Кол-во транзакций</TableColumn>
                  <TableColumn>Amount (RUB)</TableColumn>

                  <TableColumn>Total (USDT)</TableColumn>
                  <TableColumn>Действия</TableColumn>
                </TableHeader>
                <TableBody>
                  {cabinetsData.cabinets.map((cabinet) => (
                    <TableRow key={cabinet.id}>
                      <TableCell>
                        <Checkbox
                          isSelected={selectedCabinets.has(cabinet.id)}
                          onChange={() => toggleCabinetSelection(cabinet.id)}
                        />
                      </TableCell>
                      <TableCell>{cabinet.idexId}</TableCell>
                      <TableCell>{cabinet.login}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <FileText className="w-4 h-4 text-gray-400 mr-1" />
                          {cabinet._count.transactions}
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(cabinet.totals.amountRub, 'RUB')}</TableCell>

                      <TableCell>{formatCurrency(cabinet.totals.totalUsdt, 'USDT')}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="light"
                            onClick={() => window.location.href = `/idex-cabinets/${cabinet.id}/transactions`}
                          >
                            Детали
                          </Button>
                          <Button
                            size="sm"
                            variant="light"
                            color="secondary"
                            onClick={() => handleSyncCabinet(cabinet.id)}
                          >
                            Синхронизировать
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {/* Overall Totals */}
              <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-lg mb-4">
                <h4 className="text-md font-medium mb-2 dark:text-gray-200">Общие итоги по всем кабинетам на странице</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Кол-во транзакций</div>
                    <div className="font-semibold dark:text-gray-200">{currentPageTransactionCount}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Amount (RUB)</div>
                    <div className="font-semibold dark:text-gray-200">{formatCurrency(cabinetsData.overallTotals.amountRub, 'RUB')}</div>
                  </div>
                  

                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Total (USDT)</div>
                    <div className="font-semibold dark:text-gray-200">{formatCurrency(cabinetsData.overallTotals.totalUsdt, 'USDT')}</div>
                  </div>
                </div>
              </div>
              
              {/* Pagination */}
              <div className="flex justify-center">
                <Pagination
                  total={cabinetsData.totalPages}
                  initialPage={page}
                  onChange={(newPage) => setPage(newPage)}
                />
              </div>
            </>
          ) : (
            <div className="text-center py-10 text-gray-500">
              <Globe className="w-16 h-16 mx-auto text-gray-400 mb-2" />
              <p>Нет доступных IDEX кабинетов или по выбранным датам нет данных</p>
            </div>
          )}
        </CardBody>
      </Card>
      
      {/* Synchronization Modal */}
      <Modal isOpen={isSyncModalOpen} onClose={() => !isSyncing && setIsSyncModalOpen(false)}>
        <ModalContent>
          <ModalHeader>
            {selectedCabinetId ? "Синхронизация кабинета" : "Синхронизация всех кабинетов"}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <p>
                {selectedCabinetId
                  ? "Будет выполнена синхронизация выбранного кабинета с сервером IDEX."
                  : "Будет выполнена синхронизация всех кабинетов с сервером IDEX."
                }
              </p>
              <div>
                <label className="block text-sm font-medium mb-1">Количество страниц для получения</label>
                <Input
                  type="number"
                  value={pagesToFetch}
                  onChange={(e) => setPagesFetch(parseInt(e.target.value) || 10)}
                  min={1}
                  max={100}
                  disabled={isSyncing}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Рекомендуется значение 10-25 страниц. Большее количество страниц может увеличить время синхронизации.
                </p>
              </div>
              
              {isSyncing && (
                <div className="flex items-center justify-center py-4">
                  <Spinner size="md" color="primary" className="mr-2" />
                  <span>Выполняется синхронизация...</span>
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onClick={() => setIsSyncModalOpen(false)}
              disabled={isSyncing}
            >
              Отмена
            </Button>
            <Button
              color="primary"
              onClick={onSyncCabinets}
              isLoading={isSyncing}
              disabled={isSyncing}
            >
              Начать синхронизацию
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Sync History Modal */}
      <IdexSyncOrdersModal 
        isOpen={isSyncOrdersModalOpen} 
        onClose={() => setIsSyncOrdersModalOpen(false)} 
      />
    </div>
  );
}