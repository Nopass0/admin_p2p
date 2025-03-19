"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "@/trpc/react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Spinner } from "@heroui/spinner";
import { Input } from "@heroui/input";
import { Alert } from "@heroui/alert";
import { Tabs, Tab } from "@heroui/tabs";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/table";
import { Select, SelectItem } from "@heroui/select";
import { Pagination } from "@heroui/pagination";
import { 
  CheckCircle, AlertCircle, RefreshCw, Search, Users, User, Calendar, 
  TrendingUp, ArrowUp, ArrowDown, Link, Unlink, Filter, SortAsc, SortDesc 
} from "lucide-react";
import dayjs from "dayjs";

// Alert notification state interface
interface AlertState {
  isVisible: boolean;
  title: string;
  description: string;
  color: "success" | "danger" | "primary" | "warning" | "default" | "secondary";
}

// Sort direction type
type SortDirection = "asc" | "desc" | null;

// Sort state interface
interface SortState {
  column: string | null;
  direction: SortDirection;
}

export default function EnhancedMatchingPage() {
  // State for filters and pagination
  const [startDate, setStartDate] = useState(dayjs().subtract(7, 'day').format('YYYY-MM-DDTHH:mm'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DDTHH:mm'));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // "all", "byUser", "unmatchedIdex", "unmatchedUser", "userStats"
  const [isRunningMatch, setIsRunningMatch] = useState(false);
  const [sortState, setSortState] = useState<SortState>({ column: null, direction: null });
  const [alert, setAlert] = useState<AlertState>({
    isVisible: false,
    title: "",
    description: "",
    color: "default"
  });
  
  // Selected transactions for manual matching
  const [selectedIdexTransaction, setSelectedIdexTransaction] = useState<number | null>(null);
  const [selectedUserTransaction, setSelectedUserTransaction] = useState<number | null>(null);

  // Get users for selection dropdown
  const { data: usersData } = api.user.getAllUsers.useQuery({
    page: 1,
    pageSize: 100
  }, {
    refetchOnWindowFocus: false
  });

  // Get all matches
  const {
    data: allMatchesData,
    isLoading: isLoadingAllMatches,
    refetch: refetchAllMatches
  } = api.match.getAllMatches.useQuery({
    startDate,
    endDate,
    page,
    pageSize,
    searchQuery
  }, {
    refetchOnWindowFocus: false,
    enabled: activeTab === "all"
  });

  // Get matches for specific user
  const {
    data: userMatchesData,
    isLoading: isLoadingUserMatches,
    refetch: refetchUserMatches
  } = api.match.getUserMatches.useQuery({
    userId: selectedUserId || 0,
    startDate,
    endDate,
    page,
    pageSize
  }, {
    refetchOnWindowFocus: false,
    enabled: activeTab === "byUser" && !!selectedUserId
  });

  // Get unmatched IDEX transactions
  const {
    data: unmatchedIdexData,
    isLoading: isLoadingUnmatchedIdex,
    refetch: refetchUnmatchedIdex
  } = api.match.getUnmatchedIdexTransactions.useQuery({
    startDate,
    endDate,
    page,
    pageSize,
    searchQuery
  }, {
    refetchOnWindowFocus: false,
    enabled: activeTab === "unmatchedIdex"
  });

  // Get unmatched User transactions
  const {
    data: unmatchedUserData,
    isLoading: isLoadingUnmatchedUser,
    refetch: refetchUnmatchedUser
  } = api.match.getUnmatchedUserTransactions.useQuery({
    userId: selectedUserId,
    startDate,
    endDate,
    page,
    pageSize,
    searchQuery
  }, {
    refetchOnWindowFocus: false,
    enabled: activeTab === "unmatchedUser"
  });

  // Get user statistics
  const {
    data: usersWithStatsData,
    isLoading: isLoadingUsersWithStats,
    refetch: refetchUsersWithStats
  } = api.match.getUsersWithMatchStats.useQuery({
    startDate,
    endDate,
    page,
    pageSize
  }, {
    refetchOnWindowFocus: false,
    enabled: activeTab === "userStats"
  });

  // Match transactions mutation
  const matchTransactionsMutation = api.match.matchTransactions.useMutation({
    onSuccess: (data) => {
      setIsRunningMatch(false);
      showAlert("Успешно", `Сопоставление транзакций завершено. Найдено ${data.stats?.matchedCount || 0} совпадений.`, "success");
      // Refresh data in all tabs
      void refetchAllMatches();
      if (selectedUserId) void refetchUserMatches();
      void refetchUsersWithStats();
      void refetchUnmatchedIdex();
      void refetchUnmatchedUser();
    },
    onError: (error) => {
      setIsRunningMatch(false);
      showAlert("Ошибка", `Ошибка при сопоставлении транзакций: ${error.message}`, "danger");
    }
  });

  // Create manual match mutation
  const createManualMatchMutation = api.match.createManualMatch.useMutation({
    onSuccess: () => {
      showAlert("Успешно", "Транзакции успешно сопоставлены вручную", "success");
      // Reset selected transactions
      setSelectedIdexTransaction(null);
      setSelectedUserTransaction(null);
      // Refresh data in all tabs
      void refetchAllMatches();
      if (selectedUserId) void refetchUserMatches();
      void refetchUsersWithStats();
      void refetchUnmatchedIdex();
      void refetchUnmatchedUser();
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при ручном сопоставлении: ${error.message}`, "danger");
    }
  });

  // Delete match mutation
  const deleteMatchMutation = api.match.deleteMatch.useMutation({
    onSuccess: () => {
      showAlert("Успешно", "Сопоставление успешно удалено", "success");
      // Refresh data in all tabs
      void refetchAllMatches();
      if (selectedUserId) void refetchUserMatches();
      void refetchUsersWithStats();
      void refetchUnmatchedIdex();
      void refetchUnmatchedUser();
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при удалении сопоставления: ${error.message}`, "danger");
    }
  });

  // Function to run matching process
  const runMatchProcess = () => {
    setIsRunningMatch(true);
    matchTransactionsMutation.mutate({
      startDate,
      endDate
    });
  };

  // Function to create manual match
  const createManualMatch = () => {
    if (selectedIdexTransaction && selectedUserTransaction) {
      createManualMatchMutation.mutate({
        idexTransactionId: selectedIdexTransaction,
        transactionId: selectedUserTransaction
      });
    } else {
      showAlert("Ошибка", "Необходимо выбрать обе транзакции для сопоставления", "danger");
    }
  };

  // Function to delete match
  const deleteMatch = (matchId: number) => {
    deleteMatchMutation.mutate({ matchId });
  };

  // Function to show alerts
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

  // Format numbers with two decimal places
  const formatNumber = (num: number) => num.toFixed(2);

  // Reset pagination when changing tabs
  useEffect(() => {
    setPage(1);
  }, [activeTab, selectedUserId]);

  // Handle sorting
  const handleSort = (column: string) => {
    setSortState(prev => {
      if (prev.column === column) {
        // Toggle direction if same column
        return {
          column,
          direction: prev.direction === "asc" ? "desc" : prev.direction === "desc" ? null : "asc"
        };
      } else {
        // Set new column with ascending direction
        return { column, direction: "asc" };
      }
    });
  };

  // Sorting function for data
  const sortData = (data: any[]) => {
    if (!sortState.column || !sortState.direction) return data;

    return [...data].sort((a, b) => {
      let valueA, valueB;
      
      // Handle nested properties
      if (sortState.column.includes('.')) {
        const props = sortState.column.split('.');
        valueA = props.reduce((obj, prop) => obj?.[prop], a);
        valueB = props.reduce((obj, prop) => obj?.[prop], b);
      } else {
        valueA = a[sortState.column!];
        valueB = b[sortState.column!];
      }

      // Handle numeric values
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return sortState.direction === 'asc' 
          ? valueA - valueB 
          : valueB - valueA;
      }

      // Handle string values
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return sortState.direction === 'asc' 
          ? valueA.localeCompare(valueB) 
          : valueB.localeCompare(valueA);
      }

      // Handle date values
      if (valueA instanceof Date && valueB instanceof Date) {
        return sortState.direction === 'asc' 
          ? valueA.getTime() - valueB.getTime() 
          : valueB.getTime() - valueA.getTime();
      }

      // Handle string dates
      if (valueA && valueB && (typeof valueA === 'string' && typeof valueB === 'string') &&
          !isNaN(Date.parse(valueA)) && !isNaN(Date.parse(valueB))) {
        const dateA = new Date(valueA).getTime();
        const dateB = new Date(valueB).getTime();
        return sortState.direction === 'asc' ? dateA - dateB : dateB - dateA;
      }

      return 0;
    });
  };

  // Get sorted match data
  const sortedAllMatches = useMemo(() => {
    return allMatchesData?.matches ? sortData(allMatchesData.matches) : [];
  }, [allMatchesData?.matches, sortState]);

  const sortedUserMatches = useMemo(() => {
    return userMatchesData?.matches ? sortData(userMatchesData.matches) : [];
  }, [userMatchesData?.matches, sortState]);

  const sortedUnmatchedIdex = useMemo(() => {
    return unmatchedIdexData?.transactions ? sortData(unmatchedIdexData.transactions) : [];
  }, [unmatchedIdexData?.transactions, sortState]);

  const sortedUnmatchedUser = useMemo(() => {
    return unmatchedUserData?.transactions ? sortData(unmatchedUserData.transactions) : [];
  }, [unmatchedUserData?.transactions, sortState]);

  // Function to render a sortable column header
  const renderSortableHeader = (columnName: string, displayName: string) => (
    <div 
      className="flex items-center cursor-pointer"
      onClick={() => handleSort(columnName)}
    >
      {displayName}
      {sortState.column === columnName && (
        <span className="ml-1">
          {sortState.direction === "asc" ? <SortAsc className="w-4 h-4" /> : 
           sortState.direction === "desc" ? <SortDesc className="w-4 h-4" /> : null}
        </span>
      )}
    </div>
  );

  // Function to render statistics
  const renderStats = (stats: any) => {
    if (!stats) return null;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardBody className="py-4">
            <h3 className="text-lg font-medium mb-1">Валовый расход</h3>
            <p className="text-2xl font-semibold">{formatNumber(stats.grossExpense)} USDT</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-4">
            <h3 className="text-lg font-medium mb-1">Валовый доход</h3>
            <p className="text-2xl font-semibold">{formatNumber(stats.grossIncome)} USDT</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-4">
            <h3 className="text-lg font-medium mb-1">Валовая прибыль</h3>
            <p className={`text-2xl font-semibold ${stats.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatNumber(stats.grossProfit)} USDT
              <span className={`text-sm ml-2 ${stats.profitPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ({formatNumber(stats.profitPercentage)}% от выручки)
              </span>
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-4">
            <h3 className="text-lg font-medium mb-1">Спред на ордер</h3>
            <p className="text-2xl font-semibold">
              {stats.matchedCount} ордеров
              <span className={`text-sm block mt-1 ${stats.profitPerOrder >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                Ср. спред: {formatNumber(stats.profitPerOrder)} USDT
              </span>
              <span className="text-sm block">
                Ср. расход: {formatNumber(stats.expensePerOrder)} USDT
              </span>
            </p>
          </CardBody>
        </Card>
      </div>
    );
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
        <h1 className="text-2xl font-bold">Сопоставление транзакций</h1>
        <div className="flex gap-2">
          {(activeTab === "unmatchedIdex" || activeTab === "unmatchedUser") && (
            <Button
              color="primary"
              startIcon={<Link className="w-4 h-4" />}
              onClick={createManualMatch}
              disabled={!selectedIdexTransaction || !selectedUserTransaction}
            >
              Соединить выбранные
            </Button>
          )}
          <Button
            color="primary"
            startIcon={<RefreshCw className="w-4 h-4" />}
            isLoading={isRunningMatch}
            onClick={runMatchProcess}
          >
            {isRunningMatch ? "Сопоставление..." : "Запустить автосопоставление"}
          </Button>
        </div>
      </div>
      
      <Card className="mb-6">
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Дата и время начала</label>
              <Input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                startContent={<Calendar className="w-4 h-4 text-gray-500" />}
                aria-label="Дата и время начала"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Дата и время окончания</label>
              <Input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                startContent={<Calendar className="w-4 h-4 text-gray-500" />}
                aria-label="Дата и время окончания"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Пользователь</label>
              <Select
                placeholder="Все пользователи"
                value={selectedUserId?.toString() || ""}
                onChange={(value) => setSelectedUserId(value ? parseInt(value) : null)}
                startContent={<User className="w-4 h-4 text-gray-500" />}
                aria-label="Выбрать пользователя"
              >
                <SelectItem key="all" value="">Все пользователи</SelectItem>
                {usersData?.users?.map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.name} ({user.telegramAccounts?.[0]?.username || 'Без username'})
                  </SelectItem>
                ))}
              </Select>
            </div>
            <div className="flex flex-col">
              <label className="block text-sm font-medium mb-1">Поиск</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Поиск по ID, сумме..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  startContent={<Search className="w-4 h-4 text-gray-500" />}
                  aria-label="Поиск"
                />
                <Button
                  color="primary"
                  variant="flat"
                  onClick={() => {
                    setPage(1);
                    if (activeTab === "all") void refetchAllMatches();
                    else if (activeTab === "byUser" && selectedUserId) void refetchUserMatches();
                    else if (activeTab === "unmatchedIdex") void refetchUnmatchedIdex();
                    else if (activeTab === "unmatchedUser") void refetchUnmatchedUser();
                    else if (activeTab === "userStats") void refetchUsersWithStats();
                  }}
                  aria-label="Применить фильтры"
                >
                  <Filter className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <Tab value="all" title="Все матчи" />
        <Tab value="byUser" title="Матчи пользователя" />
        <Tab value="unmatchedIdex" title="Несопоставленные IDEX" />
        <Tab value="unmatchedUser" title="Несопоставленные кошелька" />
        <Tab value="userStats" title="Статистика по пользователям" />
      </Tabs>
      
      {/* Display statistics for current view */}
      {activeTab === "all" && allMatchesData?.stats && renderStats(allMatchesData.stats)}
      {activeTab === "byUser" && userMatchesData?.stats && renderStats(userMatchesData.stats)}
      
      {/* Manual match selection panel */}
      {(activeTab === "unmatchedIdex" || activeTab === "unmatchedUser") && (
        <Card className="mb-6">
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-md font-medium mb-2">Выбранная IDEX транзакция</h3>
                {selectedIdexTransaction ? (
                  <div className="p-3 bg-gray-100 rounded">
                    <p>ID: {selectedIdexTransaction}</p>
                    <p>
                      {unmatchedIdexData?.transactions?.find(t => t.id === selectedIdexTransaction)?.amount &&
                        `Сумма: ${formatNumber(JSON.parse(unmatchedIdexData?.transactions?.find(t => t.id === selectedIdexTransaction)?.amount as string)?.trader?.[643] || 0)} ₽`}
                    </p>
                    <Button 
                      size="sm" 
                      color="danger" 
                      variant="flat" 
                      className="mt-2"
                      onClick={() => setSelectedIdexTransaction(null)}
                    >
                      Отменить выбор
                    </Button>
                  </div>
                ) : (
                  <p className="text-gray-500">Выберите IDEX транзакцию из таблицы</p>
                )}
              </div>
              <div>
                <h3 className="text-md font-medium mb-2">Выбранная транзакция кошелька</h3>
                {selectedUserTransaction ? (
                  <div className="p-3 bg-gray-100 rounded">
                    <p>ID: {selectedUserTransaction}</p>
                    <p>
                      {unmatchedUserData?.transactions?.find(t => t.id === selectedUserTransaction) &&
                        `Сумма: ${formatNumber(unmatchedUserData?.transactions?.find(t => t.id === selectedUserTransaction)?.totalPrice || 0)} ₽`}
                    </p>
                    <Button 
                      size="sm" 
                      color="danger" 
                      variant="flat" 
                      className="mt-2"
                      onClick={() => setSelectedUserTransaction(null)}
                    >
                      Отменить выбор
                    </Button>
                  </div>
                ) : (
                  <p className="text-gray-500">Выберите транзакцию кошелька из таблицы</p>
                )}
              </div>
            </div>
            {selectedIdexTransaction && selectedUserTransaction && (
              <div className="mt-4 text-center">
                <Button
                  color="primary"
                  startIcon={<Link className="w-4 h-4" />}
                  onClick={createManualMatch}
                >
                  Соединить выбранные транзакции
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      )}
      
      {/* Tables with data based on selected tab */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            {activeTab === "all" && <Users className="w-5 h-5 text-gray-500" />}
            {activeTab === "byUser" && <User className="w-5 h-5 text-gray-500" />}
            {activeTab === "unmatchedIdex" && <AlertCircle className="w-5 h-5 text-gray-500" />}
            {activeTab === "unmatchedUser" && <AlertCircle className="w-5 h-5 text-gray-500" />}
            {activeTab === "userStats" && <TrendingUp className="w-5 h-5 text-gray-500" />}
            <h3 className="text-lg font-medium">
              {activeTab === "all" && "Все сопоставленные транзакции"}
              {activeTab === "byUser" && "Транзакции выбранного пользователя"}
              {activeTab === "unmatchedIdex" && "Несопоставленные IDEX транзакции"}
              {activeTab === "unmatchedUser" && "Несопоставленные транзакции кошелька"}
              {activeTab === "userStats" && "Статистика по пользователям"}
            </h3>
          </div>
        </CardHeader>
        <CardBody>
          {/* All matches table */}
          {activeTab === "all" && (
            isLoadingAllMatches ? (
              <div className="flex justify-center py-10">
                <Spinner size="lg" color="primary" />
              </div>
            ) : sortedAllMatches.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table aria-label="Таблица всех сопоставленных транзакций">
                    <TableHeader>
                      <TableColumn>{renderSortableHeader("transaction.user.name", "Пользователь")}</TableColumn>
                      <TableColumn>{renderSortableHeader("transaction.dateTime", "Дата транзакции")}</TableColumn>
                      <TableColumn>{renderSortableHeader("transaction.totalPrice", "Сумма транзакции")}</TableColumn>
                      <TableColumn>{renderSortableHeader("idexTransaction.externalId", "IDEX ID")}</TableColumn>
                      <TableColumn>{renderSortableHeader("idexTransaction.approvedAt", "Дата IDEX")}</TableColumn>
                      <TableColumn>{renderSortableHeader("grossExpense", "Расход")}</TableColumn>
                      <TableColumn>{renderSortableHeader("grossIncome", "Доход")}</TableColumn>
                      <TableColumn>{renderSortableHeader("grossProfit", "Спред")}</TableColumn>
                      <TableColumn>{renderSortableHeader("profitPercentage", "%")}</TableColumn>
                      <TableColumn>Действия</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {sortedAllMatches.map((match) => (
                        <TableRow key={match.id}>
                          <TableCell>{match.transaction.user.name}</TableCell>
                          <TableCell>{dayjs(match.transaction.dateTime).format('DD.MM.YYYY HH:mm')}</TableCell>
                          <TableCell>{formatNumber(match.transaction.totalPrice)} ₽</TableCell>
                          <TableCell>{match.idexTransaction.externalId.toString()}</TableCell>
                          <TableCell>{match.idexTransaction.approvedAt ? dayjs(match.idexTransaction.approvedAt).format('DD.MM.YYYY HH:mm') : '-'}</TableCell>
                          <TableCell>{formatNumber(match.grossExpense)} USDT</TableCell>
                          <TableCell>{formatNumber(match.grossIncome)} USDT</TableCell>
                          <TableCell className={match.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatNumber(match.grossProfit)} USDT
                          </TableCell>
                          <TableCell className={match.profitPercentage >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatNumber(match.profitPercentage)}%
                          </TableCell>
                          <TableCell>
                            <Button 
                              color="danger" 
                              variant="flat" 
                              size="sm"
                              startIcon={<Unlink className="w-4 h-4" />}
                              onClick={() => deleteMatch(match.id)}
                            >
                              Разъединить
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {allMatchesData?.pagination.totalPages > 1 && (
                  <div className="flex justify-center mt-4">
                    <Pagination
                      total={allMatchesData.pagination.totalPages}
                      initialPage={page}
                      page={page}
                      onChange={setPage}
                      aria-label="Пагинация всех матчей"
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-10 text-gray-500">
                <Users className="w-16 h-16 mx-auto text-gray-400 mb-2" />
                <p>Нет сопоставленных транзакций в выбранном диапазоне дат</p>
                <Button
                  variant="flat"
                  color="primary"
                  size="sm"
                  className="mt-2"
                  onClick={runMatchProcess}
                  startIcon={<RefreshCw className="w-4 h-4" />}
                  aria-label="Запустить сопоставление"
                >
                  Запустить сопоставление
                </Button>
              </div>
            )
          )}
          
          {/* User matches table */}
          {activeTab === "byUser" && (
            !selectedUserId ? (
              <div className="text-center py-10 text-gray-500">
                <User className="w-16 h-16 mx-auto text-gray-400 mb-2" />
                <p>Выберите пользователя для просмотра его матчей</p>
              </div>
            ) : isLoadingUserMatches ? (
              <div className="flex justify-center py-10">
                <Spinner size="lg" color="primary" />
              </div>
            ) : sortedUserMatches.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table aria-label="Таблица сопоставленных транзакций пользователя">
                    <TableHeader>
                      <TableColumn>{renderSortableHeader("transaction.dateTime", "Дата транзакции")}</TableColumn>
                      <TableColumn>{renderSortableHeader("transaction.totalPrice", "Сумма транзакции")}</TableColumn>
                      <TableColumn>{renderSortableHeader("idexTransaction.externalId", "IDEX ID")}</TableColumn>
                      <TableColumn>{renderSortableHeader("idexTransaction.approvedAt", "Дата IDEX")}</TableColumn>
                      <TableColumn>{renderSortableHeader("grossExpense", "Расход")}</TableColumn>
                      <TableColumn>{renderSortableHeader("grossIncome", "Доход")}</TableColumn>
                      <TableColumn>{renderSortableHeader("grossProfit", "Спред")}</TableColumn>
                      <TableColumn>{renderSortableHeader("profitPercentage", "%")}</TableColumn>
                      <TableColumn>Действия</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {sortedUserMatches.map((match) => (
                        <TableRow key={match.id}>
                          <TableCell>{dayjs(match.transaction.dateTime).format('DD.MM.YYYY HH:mm')}</TableCell>
                          <TableCell>{formatNumber(match.transaction.totalPrice)} ₽</TableCell>
                          <TableCell>{match.idexTransaction.externalId.toString()}</TableCell>
                          <TableCell>{match.idexTransaction.approvedAt ? dayjs(match.idexTransaction.approvedAt).format('DD.MM.YYYY HH:mm') : '-'}</TableCell>
                          <TableCell>{formatNumber(match.grossExpense)} USDT</TableCell>
                          <TableCell>{formatNumber(match.grossIncome)} USDT</TableCell>
                          <TableCell className={match.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatNumber(match.grossProfit)} USDT
                          </TableCell>
                          <TableCell className={match.profitPercentage >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatNumber(match.profitPercentage)}%
                          </TableCell>
                          <TableCell>
                            <Button 
                              color="danger" 
                              variant="flat" 
                              size="sm"
                              startIcon={<Unlink className="w-4 h-4" />}
                              onClick={() => deleteMatch(match.id)}
                            >
                              Разъединить
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {userMatchesData?.pagination.totalPages > 1 && (
                  <div className="flex justify-center mt-4">
                    <Pagination
                      total={userMatchesData.pagination.totalPages}
                      initialPage={page}
                      page={page}
                      onChange={setPage}
                      aria-label="Пагинация матчей пользователя"
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-10 text-gray-500">
                <User className="w-16 h-16 mx-auto text-gray-400 mb-2" />
                <p>Нет сопоставленных транзакций для выбранного пользователя</p>
                <Button
                  variant="flat"
                  color="primary"
                  size="sm"
                  className="mt-2"
                  onClick={runMatchProcess}
                  startIcon={<RefreshCw className="w-4 h-4" />}
                  aria-label="Запустить сопоставление"
                >
                  Запустить сопоставление
                </Button>
              </div>
            )
          )}
          
          {/* Unmatched IDEX transactions table */}
          {activeTab === "unmatchedIdex" && (
            isLoadingUnmatchedIdex ? (
              <div className="flex justify-center py-10">
                <Spinner size="lg" color="primary" />
              </div>
            ) : sortedUnmatchedIdex.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table aria-label="Таблица несопоставленных IDEX транзакций">
                    <TableHeader>
                      <TableColumn>{renderSortableHeader("id", "ID")}</TableColumn>
                      <TableColumn>{renderSortableHeader("externalId", "Внешний ID")}</TableColumn>
                      <TableColumn>{renderSortableHeader("approvedAt", "Дата подтверждения")}</TableColumn>
                      <TableColumn>Сумма</TableColumn>
                      <TableColumn>Действия</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {sortedUnmatchedIdex.map((transaction) => {
                        // Parse amount from JSON
                        let amountValue = 0;
                        try {
                          if (typeof transaction.amount === 'string') {
                            const amountJson = JSON.parse(transaction.amount);
                            amountValue = parseFloat(amountJson.trader?.[643] || 0);
                          } else {
                            amountValue = parseFloat(transaction.amount.trader?.[643] || 0);
                          }
                        } catch (error) {
                          console.error('Ошибка при парсинге JSON поля amount:', error);
                        }
                        
                        return (
                          <TableRow 
                            key={transaction.id}
                            className={selectedIdexTransaction === transaction.id ? "bg-blue-100" : ""}
                          >
                            <TableCell>{transaction.id}</TableCell>
                            <TableCell>{transaction.externalId.toString()}</TableCell>
                            <TableCell>{transaction.approvedAt ? dayjs(transaction.approvedAt).format('DD.MM.YYYY HH:mm') : '-'}</TableCell>
                            <TableCell>{formatNumber(amountValue)} ₽</TableCell>
                            <TableCell>
                              <Button 
                                color={selectedIdexTransaction === transaction.id ? "secondary" : "primary"} 
                                variant="flat" 
                                size="sm"
                                onClick={() => setSelectedIdexTransaction(
                                  selectedIdexTransaction === transaction.id ? null : transaction.id
                                )}
                              >
                                {selectedIdexTransaction === transaction.id ? "Отменить выбор" : "Выбрать"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {unmatchedIdexData?.pagination.totalPages > 1 && (
                  <div className="flex justify-center mt-4">
                    <Pagination
                      total={unmatchedIdexData.pagination.totalPages}
                      initialPage={page}
                      page={page}
                      onChange={setPage}
                      aria-label="Пагинация несопоставленных IDEX транзакций"
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-10 text-gray-500">
                <AlertCircle className="w-16 h-16 mx-auto text-gray-400 mb-2" />
                <p>Нет несопоставленных IDEX транзакций в выбранном диапазоне дат</p>
              </div>
            )
          )}
          
          {/* Unmatched User transactions table */}
          {activeTab === "unmatchedUser" && (
            isLoadingUnmatchedUser ? (
              <div className="flex justify-center py-10">
                <Spinner size="lg" color="primary" />
              </div>
            ) : sortedUnmatchedUser.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table aria-label="Таблица несопоставленных транзакций кошелька">
                    <TableHeader>
                      <TableColumn>{renderSortableHeader("id", "ID")}</TableColumn>
                      <TableColumn>{renderSortableHeader("user.name", "Пользователь")}</TableColumn>
                      <TableColumn>{renderSortableHeader("dateTime", "Дата")}</TableColumn>
                      <TableColumn>{renderSortableHeader("totalPrice", "Сумма")}</TableColumn>
                      <TableColumn>{renderSortableHeader("type", "Тип")}</TableColumn>
                      <TableColumn>Действия</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {sortedUnmatchedUser.map((transaction) => (
                        <TableRow 
                          key={transaction.id}
                          className={selectedUserTransaction === transaction.id ? "bg-blue-100" : ""}
                        >
                          <TableCell>{transaction.id}</TableCell>
                          <TableCell>{transaction.user?.name || '-'}</TableCell>
                          <TableCell>{dayjs(transaction.dateTime).format('DD.MM.YYYY HH:mm')}</TableCell>
                          <TableCell>{formatNumber(transaction.totalPrice)} ₽</TableCell>
                          <TableCell>{transaction.type}</TableCell>
                          <TableCell>
                            <Button 
                              color={selectedUserTransaction === transaction.id ? "secondary" : "primary"} 
                              variant="flat" 
                              size="sm"
                              onClick={() => setSelectedUserTransaction(
                                selectedUserTransaction === transaction.id ? null : transaction.id
                              )}
                            >
                              {selectedUserTransaction === transaction.id ? "Отменить выбор" : "Выбрать"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {unmatchedUserData?.pagination.totalPages > 1 && (
                  <div className="flex justify-center mt-4">
                    <Pagination
                      total={unmatchedUserData.pagination.totalPages}
                      initialPage={page}
                      page={page}
                      onChange={setPage}
                      aria-label="Пагинация несопоставленных транзакций кошелька"
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-10 text-gray-500">
                <AlertCircle className="w-16 h-16 mx-auto text-gray-400 mb-2" />
                <p>Нет несопоставленных транзакций кошелька в выбранном диапазоне дат</p>
              </div>
            )
          )}
          
          {/* User statistics table */}
          {activeTab === "userStats" && (
            isLoadingUsersWithStats ? (
              <div className="flex justify-center py-10">
                <Spinner size="lg" color="primary" />
              </div>
            ) : usersWithStatsData?.users && usersWithStatsData.users.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table aria-label="Таблица статистики по пользователям">
                    <TableHeader>
                      <TableColumn>{renderSortableHeader("name", "Пользователь")}</TableColumn>
                      <TableColumn>{renderSortableHeader("matchCount", "Кол-во матчей")}</TableColumn>
                      <TableColumn>{renderSortableHeader("stats.grossExpense", "Расход")}</TableColumn>
                      <TableColumn>{renderSortableHeader("stats.grossIncome", "Доход")}</TableColumn>
                      <TableColumn>{renderSortableHeader("stats.grossProfit", "Спред")}</TableColumn>
                      <TableColumn>{renderSortableHeader("stats.profitPercentage", "% спреда")}</TableColumn>
                      <TableColumn>{renderSortableHeader("stats.profitPerOrder", "Ср. спред/матч")}</TableColumn>
                      <TableColumn>{renderSortableHeader("stats.expensePerOrder", "Ср. расход/матч")}</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {usersWithStatsData.users.map((user) => (
                        <TableRow 
                          key={user.id} 
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => {
                            setSelectedUserId(user.id);
                            setActiveTab("byUser");
                          }}
                        >
                          <TableCell>{user.name}</TableCell>
                          <TableCell>{user.matchCount}</TableCell>
                          <TableCell>{formatNumber(user.stats.grossExpense)} USDT</TableCell>
                          <TableCell>{formatNumber(user.stats.grossIncome)} USDT</TableCell>
                          <TableCell className={user.stats.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatNumber(user.stats.grossProfit)} USDT
                          </TableCell>
                          <TableCell className={user.stats.profitPercentage >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatNumber(user.stats.profitPercentage)}%
                          </TableCell>
                          <TableCell className={user.stats.profitPerOrder >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatNumber(user.stats.profitPerOrder)} USDT
                          </TableCell>
                          <TableCell>{formatNumber(user.stats.expensePerOrder)} USDT</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {usersWithStatsData.pagination.totalPages > 1 && (
                  <div className="flex justify-center mt-4">
                    <Pagination
                      total={usersWithStatsData.pagination.totalPages}
                      initialPage={page}
                      page={page}
                      onChange={setPage}
                      aria-label="Пагинация статистики пользователей"
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-10 text-gray-500">
                <Users className="w-16 h-16 mx-auto text-gray-400 mb-2" />
                <p>Нет пользователей с сопоставленными транзакциями</p>
                <Button
                  variant="flat"
                  color="primary"
                  size="sm"
                  className="mt-2"
                  onClick={runMatchProcess}
                  startIcon={<RefreshCw className="w-4 h-4" />}
                  aria-label="Запустить сопоставление"
                >
                  Запустить сопоставление
                </Button>
              </div>
            )
          )}
        </CardBody>
      </Card>
    </div>
  );
}