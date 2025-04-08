import { useState, useRef, useEffect } from "react";
import { api } from "@/trpc/react";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/table";
import { Pagination } from "@heroui/pagination";
import { Badge } from "@heroui/badge";
import { Search, Calendar, RefreshCw, CalendarIcon, Upload, Check, AlertCircle, Key, Edit2, Lock } from "lucide-react";
import { Card, CardBody, CardHeader, CardFooter } from "@heroui/card";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/popover";
import { Calendar as CalendarComponent } from "@heroui/calendar";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";

export function UserBybitTransactionsTab({ userId }) {
  // State for pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // State for filters
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  
  // State for file upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [showUploadResult, setShowUploadResult] = useState(false);
  const fileInputRef = useRef(null);
  
  // State for API keys editing
  const [isEditingKeys, setIsEditingKeys] = useState(false);
  const [bybitApiToken, setBybitApiToken] = useState("");
  const [bybitApiSecret, setBybitApiSecret] = useState("");
  const [isSavingKeys, setIsSavingKeys] = useState(false);
  
  // Fetch user details to get API keys and sync status
  const { data: userData, isLoading: isLoadingUser, refetch: refetchUser } = api.users.getUserById.useQuery(
    { userId },
    { enabled: !!userId, refetchOnWindowFocus: false }
  );
  
  // Fetch transactions
  const { data, isLoading, isError, refetch } = api.bybitTransactions.getUserBybitTransactions.useQuery({
    userId,
    page,
    pageSize,
    searchQuery,
    startDate,
    endDate
  }, {
    enabled: !!userId,
    refetchOnWindowFocus: false,
  });
  
  // Upload transactions mutation
  const uploadMutation = api.bybitTransactions.uploadBybitTransactions.useMutation({
    onSuccess: (data) => {
      setIsUploading(false);
      setUploadResult(data);
      setShowUploadResult(true);
      
      // Refresh the transactions list if upload was successful
      if (data.success) {
        refetch();
        refetchUser(); // Also refresh user data to update sync status
      }
    },
    onError: (error) => {
      setIsUploading(false);
      setUploadResult({ 
        success: false, 
        message: error.message || "Ошибка при загрузке файла" 
      });
      setShowUploadResult(true);
    }
  });
  
  // Update Bybit API keys mutation
  const updateKeysMutation = api.users.updateBybitApiKeys.useMutation({
    onSuccess: (data) => {
      setIsSavingKeys(false);
      setIsEditingKeys(false);
      refetchUser();
    },
    onError: (error) => {
      setIsSavingKeys(false);
      setUploadResult({ 
        success: false, 
        message: error.message || "Ошибка при обновлении API ключей" 
      });
      setShowUploadResult(true);
    }
  });
  
  // Set initial values when user data is loaded
  useEffect(() => {
    if (userData?.user) {
      setBybitApiToken(userData.user.bybitApiToken || "");
      setBybitApiSecret(userData.user.bybitApiSecret || "");
    }
  }, [userData?.user]);
  
  // Function to handle file selection
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    
    try {
      // Read the file as base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64String = event.target.result.toString();
        const base64Content = base64String.split(',')[1]; // Remove data URL prefix
        
        // Upload the file
        uploadMutation.mutate({
          userId,
          fileBase64: base64Content
        });
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      setIsUploading(false);
      setUploadResult({ 
        success: false, 
        message: "Ошибка при чтении файла" 
      });
      setShowUploadResult(true);
    }
  };
  
  // Function to trigger file input click
  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Function to handle search
  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1); // Reset page when searching
  };
  
  // Function to clear filters
  const handleClearFilters = () => {
    setSearchQuery("");
    setStartDate(null);
    setEndDate(null);
    setPage(1);
  };
  
  // Function to handle saving API keys
  const handleSaveApiKeys = () => {
    setIsSavingKeys(true);
    updateKeysMutation.mutate({
      userId,
      bybitApiToken,
      bybitApiSecret
    });
  };
  
  // Function to handle canceling API key editing
  const handleCancelEditKeys = () => {
    if (userData?.user) {
      setBybitApiToken(userData.user.bybitApiToken || "");
      setBybitApiSecret(userData.user.bybitApiSecret || "");
    }
    setIsEditingKeys(false);
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleString('ru-RU', {
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit'
      });
    } catch (e) {
      return "Invalid Date";
    }
  };
  
  // Format number with fixed decimal points
  const formatNumber = (num, decimals = 2) => {
    if (num === null || num === undefined) return "N/A";
    return Number(num).toFixed(decimals);
  };
  
  if (isLoading || isLoadingUser) {
    return (
      <div className="flex justify-center items-center p-8">
        <Spinner size="lg" color="primary" label="Загрузка данных..." />
      </div>
    );
  }
  
  if ((isError || !data) && (!userData || !userData.user)) {
    return (
      <div className="text-center py-8 text-red-500">
        <Card>
          <CardBody className="text-center py-6">
            Ошибка при загрузке данных. Пожалуйста, попробуйте еще раз.
            <Button color="primary" variant="flat" size="sm" className="mt-4 mx-auto" onClick={() => { refetch(); refetchUser(); }}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Попробовать снова
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }
  
  const { transactions, pagination } = data || { transactions: [], pagination: null };
  const user = userData?.user;
  
  return (
    <div className="space-y-4">
      {/* Filter Section */}
      <Card className="shadow-sm border border-zinc-200 dark:border-zinc-800">
        <CardBody className="p-4">
          <form onSubmit={handleSearch} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Search Input */}
            <div className="relative">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по всем полям..."
                className="pl-10" // Space for the icon
                aria-label="Поиск транзакций"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
            </div>
            
            {/* Date Range Pickers */}
            <div className="grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger>
                  <Button variant="bordered" className="w-full justify-start">
                    <CalendarIcon className="w-4 h-4 mr-2 text-zinc-400" />
                    {startDate ? formatDate(startDate) : "Дата с"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent>
                  <CalendarComponent
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              <Popover>
                <PopoverTrigger>
                  <Button variant="bordered" className="w-full justify-start">
                    <CalendarIcon className="w-4 h-4 mr-2 text-zinc-400" />
                    {endDate ? formatDate(endDate) : "Дата по"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent>
                  <CalendarComponent
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2 justify-end">
              <Button 
                type="button" 
                variant="bordered" 
                onClick={handleClearFilters}
                isDisabled={!searchQuery && !startDate && !endDate}
              >
                Сбросить
              </Button>
              <Button 
                type="submit" 
                color="primary"
              >
                Найти
              </Button>
              <Button
                type="button"
                variant="light"
                onClick={() => refetch()}
                isIconOnly
                aria-label="Обновить данные"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
      
      {/* Bybit API Settings and Sync Status */}
      <Card className="shadow-sm border border-zinc-200 dark:border-zinc-800">
        <CardHeader className="pb-0">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              API ключи Bybit
            </h3>
            {!isEditingKeys && (
              <Button 
                size="sm" 
                variant="flat" 
                color="primary" 
                onClick={() => setIsEditingKeys(true)}
                startContent={<Edit2 className="w-4 h-4" />}
              >
                Редактировать
              </Button>
            )}
          </div>
        </CardHeader>
        <CardBody className="py-3">
          {isEditingKeys ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="bybitApiToken" className="text-sm font-medium">
                  API Token
                </label>
                <Input
                  id="bybitApiToken"
                  value={bybitApiToken}
                  onChange={(e) => setBybitApiToken(e.target.value)}
                  placeholder="Введите API Token"
                  startContent={<Key className="text-zinc-400" size={16} />}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="bybitApiSecret" className="text-sm font-medium">
                  API Secret
                </label>
                <Input
                  id="bybitApiSecret"
                  value={bybitApiSecret}
                  onChange={(e) => setBybitApiSecret(e.target.value)}
                  placeholder="Введите API Secret"
                  type="password"
                  startContent={<Lock className="text-zinc-400" size={16} />}
                />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  size="sm"
                  variant="bordered"
                  onClick={handleCancelEditKeys}
                  isDisabled={isSavingKeys}
                >
                  Отмена
                </Button>
                <Button
                  size="sm"
                  color="primary"
                  onClick={handleSaveApiKeys}
                  isLoading={isSavingKeys}
                  isDisabled={isSavingKeys}
                >
                  Сохранить
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-zinc-500 mb-1">API Token:</p>
                  <p className="font-mono text-sm">
                    {user?.bybitApiToken ? 
                      `${user.bybitApiToken.substring(0, 6)}...${user.bybitApiToken.substring(user.bybitApiToken.length - 4)}` : 
                      "Не установлен"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-zinc-500 mb-1">API Secret:</p>
                  <p className="font-mono text-sm">
                    {user?.bybitApiSecret ? "••••••••••••••••" : "Не установлен"}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div>
                  <p className="text-sm text-zinc-500 mb-1">Статус синхронизации:</p>
                  <div className="flex items-center">
                    <Badge 
                      color={
                        !user?.lastBybitSyncStatus ? "default" :
                        user.lastBybitSyncStatus.includes("успешно") ? "success" :
                        user.lastBybitSyncStatus.includes("ошибка") ? "danger" : "warning"
                      }
                      variant="flat"
                    >
                      {user?.lastBybitSyncStatus || "Не синхронизировано"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-zinc-500 mb-1">Последняя синхронизация:</p>
                  <p>{user?.lastBybitSyncAt ? formatDate(user.lastBybitSyncAt) : "Никогда"}</p>
                </div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
      
      {/* File Upload Button */}
      <Card className="shadow-sm border border-zinc-200 dark:border-zinc-800">
        <CardBody className="p-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="text-lg font-medium">Загрузка транзакций из XLS</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Загрузите XLS файл с транзакциями от Bybit для автоматического импорта
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".xls,.xlsx"
                className="hidden"
              />
              <Button
                type="button"
                onClick={handleUploadClick}
                disabled={isUploading}
                color="success"
                className="flex items-center"
              >
                {isUploading ? (
                  <Spinner size="sm" color="white" className="mr-2" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                {isUploading ? "Загрузка..." : "Загрузить файл"}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
      
      {/* Upload Result Modal */}
      <Modal isOpen={showUploadResult} onClose={() => setShowUploadResult(false)}>
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              {uploadResult?.success ? (
                <Check className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
              <span>
                {uploadResult?.success ? "Успешная загрузка" : "Ошибка загрузки"}
              </span>
            </div>
          </ModalHeader>
          <ModalBody>
            {uploadResult?.success ? (
              <div className="space-y-2">
                <p>Файл успешно загружен и обработан.</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Добавлено: <strong>{uploadResult.summary.addedTransactions}</strong> транзакций</li>
                  <li>Пропущено (дубликаты): <strong>{uploadResult.summary.skippedTransactions}</strong> транзакций</li>
                  <li>Всего обработано: <strong>{uploadResult.summary.totalProcessed}</strong> транзакций</li>
                </ul>
              </div>
            ) : (
              <div className="space-y-2 text-red-600">
                <p>Произошла ошибка при загрузке или обработке файла:</p>
                <p className="font-medium">{uploadResult?.message}</p>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="primary" onClick={() => setShowUploadResult(false)}>
              ОК
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Transactions Table */}
      <Card className="shadow-sm border border-zinc-200 dark:border-zinc-800">
        <Table aria-label="Транзакции с Bybit">
          <TableHeader>
            <TableColumn>Дата</TableColumn>
            <TableColumn>№ заказа</TableColumn>
            <TableColumn>Тип</TableColumn>
            <TableColumn>Актив</TableColumn>
            <TableColumn>Количество</TableColumn>
            <TableColumn>Сумма</TableColumn>
            <TableColumn>Цена за ед.</TableColumn>
            <TableColumn>Контрагент</TableColumn>
            <TableColumn>Статус</TableColumn>
          </TableHeader>
          <TableBody emptyContent="Транзакции не найдены">
            {transactions.length > 0 && transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>{formatDate(tx.dateTime)}</TableCell>
                <TableCell className="font-mono text-xs">{tx.orderNo}</TableCell>
                <TableCell>
                  <Badge 
                    color={tx.type.toLowerCase() === "buy" ? "danger" : "success"} 
                    variant="flat"
                    className="capitalize"
                  >
                    {tx.type}
                  </Badge>
                </TableCell>
                <TableCell>{tx.asset}</TableCell>
                <TableCell>{formatNumber(tx.amount, 8)}</TableCell>
                <TableCell>{formatNumber(tx.totalPrice, 2)}</TableCell>
                <TableCell>{formatNumber(tx.unitPrice, 2)}</TableCell>
                <TableCell>{tx.counterparty || "N/A"}</TableCell>
                <TableCell>
                  <Badge 
                    color={tx.status === "completed" ? "success" : 
                          tx.status === "pending" ? "warning" : "default"} 
                    variant="flat"
                    className="capitalize"
                  >
                    {tx.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      
      {/* Pagination */}
      {pagination && pagination.totalPages > 0 && (
        <div className="flex justify-center mt-4">
          <Pagination
            page={page}
            total={pagination.totalPages}
            onChange={setPage}
            showControls
            showShadow
            color="primary"
            className="justify-center"
          />
        </div>
      )}
      
      {/* Stats Summary */}
      {transactions.length > 0 && (
        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700/50 mt-4 text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Всего: {pagination.totalTransactions} транзакций | 
            Страница {page} из {pagination.totalPages} | 
            Показано: {Math.min(pageSize, transactions.length)} из {pagination.totalTransactions}
          </p>
        </div>
      )}
    </div>
  );
}