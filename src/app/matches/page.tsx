"use client";

import { useState, useEffect } from "react";
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
import { CheckCircle, AlertCircle, RefreshCw, Search, Users, User, Calendar } from "lucide-react";
import dayjs from "dayjs";

interface AlertState {
  isVisible: boolean;
  title: string;
  description: string;
  color: "success" | "danger" | "primary" | "warning" | "default" | "secondary";
}

export default function MatchesPage() {
  // Состояние для фильтров и пагинации
  const [startDate, setStartDate] = useState(dayjs().subtract(7, 'day').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("all"); // "all", "byUser", "userStats"
  const [isRunningMatch, setIsRunningMatch] = useState(false);
  const [alert, setAlert] = useState<AlertState>({
    isVisible: false,
    title: "",
    description: "",
    color: "default"
  });

  // Получение пользователей для выбора
  const { data: usersData } = api.user.getAllUsers.useQuery(undefined, {
    refetchOnWindowFocus: false
  });

  // Получение всех матчей
  const {
    data: allMatchesData,
    isLoading: isLoadingAllMatches,
    refetch: refetchAllMatches
  } = api.match.getAllMatches.useQuery({
    startDate,
    endDate,
    page,
    pageSize
  }, {
    refetchOnWindowFocus: false,
    enabled: activeTab === "all"
  });

  // Получение матчей для конкретного пользователя
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

  // Получение статистики пользователей с матчами
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

  // Мутация для запуска процесса сопоставления транзакций
  const matchTransactionsMutation = api.match.matchTransactions.useMutation({
    onSuccess: (data) => {
      setIsRunningMatch(false);
      showAlert("Успешно", `Сопоставление транзакций завершено. Найдено ${data.stats?.matchedCount || 0} совпадений.`, "success");
      // Обновляем данные во всех вкладках
      void refetchAllMatches();
      if (selectedUserId) void refetchUserMatches();
      void refetchUsersWithStats();
    },
    onError: (error) => {
      setIsRunningMatch(false);
      showAlert("Ошибка", `Ошибка при сопоставлении транзакций: ${error.message}`, "danger");
    }
  });

  // Функция для запуска процесса сопоставления
  const runMatchProcess = () => {
    setIsRunningMatch(true);
    matchTransactionsMutation.mutate({
      startDate,
      endDate
    });
  };

  // Функция для отображения уведомлений
  const showAlert = (title: string, description: string, color: AlertState['color']) => {
    setAlert({
      isVisible: true,
      title,
      description,
      color
    });
    
    // Автоматическое скрытие уведомления через 5 секунд
    setTimeout(() => {
      setAlert(prev => ({ ...prev, isVisible: false }));
    }, 5000);
  };

  // Форматирование чисел с двумя знаками после запятой
  const formatNumber = (num: number) => num.toFixed(2);

  // Сброс пагинации при смене вкладки
  useEffect(() => {
    setPage(1);
  }, [activeTab, selectedUserId]);

  // Функция для отображения статистики
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
            <p className="text-2xl font-semibold">
              {formatNumber(stats.grossProfit)} USDT
              <span className="text-sm ml-2">
                ({formatNumber(stats.profitPercentage)}% от выручки)
              </span>
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-4">
            <h3 className="text-lg font-medium mb-1">Метченные ордера</h3>
            <p className="text-2xl font-semibold">
              {stats.matchedCount}
              <span className="text-sm block mt-1">
                Ср. прибыль: {formatNumber(stats.profitPerOrder)} USDT
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
        <Button
          color="primary"
          startIcon={<RefreshCw className="w-4 h-4" />}
          isLoading={isRunningMatch}
          onClick={runMatchProcess}
        >
          {isRunningMatch ? "Сопоставление..." : "Запустить сопоставление"}
        </Button>
      </div>
      
      <Card className="mb-6">
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Дата начала</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                startContent={<Calendar className="w-4 h-4 text-gray-500" />}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Дата окончания</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                startContent={<Calendar className="w-4 h-4 text-gray-500" />}
              />
            </div>
            <div className="flex items-end">
              <Button
                color="primary"
                variant="flat"
                startIcon={<Search className="w-4 h-4" />}
                onClick={() => {
                  setPage(1);
                  if (activeTab === "all") void refetchAllMatches();
                  if (activeTab === "byUser" && selectedUserId) void refetchUserMatches();
                  if (activeTab === "userStats") void refetchUsersWithStats();
                }}
                className="w-full"
              >
                Применить фильтры
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <Tab value="all" title="Все матчи" />
        <Tab value="byUser" title="Матчи пользователя" />
        <Tab value="userStats" title="Статистика по пользователям" />
      </Tabs>
      
      {activeTab === "byUser" && (
        <div className="mb-6">
          <Select
            label="Выберите пользователя"
            placeholder="Выберите пользователя для просмотра матчей"
            value={selectedUserId?.toString() || ""}
            onChange={(value) => setSelectedUserId(value ? parseInt(value) : null)}
            className="max-w-lg"
            startContent={<User className="w-4 h-4 text-gray-500" />}
          >
            {usersData?.users?.map((user) => (
              <SelectItem key={user.id} value={user.id.toString()}>
                {user.name} ({user.telegramAccounts?.[0]?.username || 'Без username'})
              </SelectItem>
            ))}
          </Select>
        </div>
      )}
      
      {/* Отображение статистики для текущего представления */}
      {activeTab === "all" && allMatchesData?.stats && renderStats(allMatchesData.stats)}
      {activeTab === "byUser" && userMatchesData?.stats && renderStats(userMatchesData.stats)}
      {activeTab === "userStats" && usersWithStatsData?.totalStats && renderStats(usersWithStatsData.totalStats)}
      
      {/* Таблица с матчами в зависимости от выбранной вкладки */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            {activeTab === "all" && <Users className="w-5 h-5 text-gray-500" />}
            {activeTab === "byUser" && <User className="w-5 h-5 text-gray-500" />}
            {activeTab === "userStats" && <Users className="w-5 h-5 text-gray-500" />}
            <h3 className="text-lg font-medium">
              {activeTab === "all" && "Все сопоставленные транзакции"}
              {activeTab === "byUser" && selectedUserId ? "Транзакции выбранного пользователя" : "Выберите пользователя"}
              {activeTab === "userStats" && "Статистика по пользователям"}
            </h3>
          </div>
        </CardHeader>
        <CardBody>
          {activeTab === "all" && (
            isLoadingAllMatches ? (
              <div className="flex justify-center py-10">
                <Spinner size="lg" color="primary" />
              </div>
            ) : allMatchesData?.matches && allMatchesData.matches.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableColumn>Пользователь</TableColumn>
                    <TableColumn>Дата транзакции</TableColumn>
                    <TableColumn>Сумма транзакции</TableColumn>
                    <TableColumn>IDEX ID</TableColumn>
                    <TableColumn>Дата IDEX</TableColumn>
                    <TableColumn>Расход</TableColumn>
                    <TableColumn>Доход</TableColumn>
                    <TableColumn>Прибыль</TableColumn>
                    <TableColumn>%</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {allMatchesData.matches.map((match) => (
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {allMatchesData.pagination.totalPages > 1 && (
                  <div className="flex justify-center mt-4">
                    <Pagination
                      total={allMatchesData.pagination.totalPages}
                      initialPage={page}
                      page={page}
                      onChange={setPage}
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
                >
                  Запустить сопоставление
                </Button>
              </div>
            )
          )}
          
          {activeTab === "byUser" && selectedUserId && (
            isLoadingUserMatches ? (
              <div className="flex justify-center py-10">
                <Spinner size="lg" color="primary" />
              </div>
            ) : userMatchesData?.matches && userMatchesData.matches.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableColumn>Дата транзакции</TableColumn>
                    <TableColumn>Сумма транзакции</TableColumn>
                    <TableColumn>IDEX ID</TableColumn>
                    <TableColumn>Дата IDEX</TableColumn>
                    <TableColumn>Расход</TableColumn>
                    <TableColumn>Доход</TableColumn>
                    <TableColumn>Прибыль</TableColumn>
                    <TableColumn>%</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {userMatchesData.matches.map((match) => (
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {userMatchesData.pagination.totalPages > 1 && (
                  <div className="flex justify-center mt-4">
                    <Pagination
                      total={userMatchesData.pagination.totalPages}
                      initialPage={page}
                      page={page}
                      onChange={setPage}
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
                >
                  Запустить сопоставление
                </Button>
              </div>
            )
          )}
          
          {activeTab === "userStats" && (
            isLoadingUsersWithStats ? (
              <div className="flex justify-center py-10">
                <Spinner size="lg" color="primary" />
              </div>
            ) : usersWithStatsData?.users && usersWithStatsData.users.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableColumn>Пользователь</TableColumn>
                    <TableColumn>Кол-во матчей</TableColumn>
                    <TableColumn>Расход</TableColumn>
                    <TableColumn>Доход</TableColumn>
                    <TableColumn>Прибыль</TableColumn>
                    <TableColumn>% прибыли</TableColumn>
                    <TableColumn>Ср. прибыль/матч</TableColumn>
                    <TableColumn>Ср. расход/матч</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {usersWithStatsData.users.map((user) => (
                      <TableRow key={user.id}>
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
                        <TableCell>{formatNumber(user.stats.profitPerOrder)} USDT</TableCell>
                        <TableCell>{formatNumber(user.stats.expensePerOrder)} USDT</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {usersWithStatsData.pagination.totalPages > 1 && (
                  <div className="flex justify-center mt-4">
                    <Pagination
                      total={usersWithStatsData.pagination.totalPages}
                      initialPage={page}
                      page={page}
                      onChange={setPage}
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
                >
                  Запустить сопоставление
                </Button>
              </div>
            )
          )}
          
          {activeTab === "byUser" && !selectedUserId && (
            <div className="text-center py-10 text-gray-500">
              <User className="w-16 h-16 mx-auto text-gray-400 mb-2" />
              <p>Выберите пользователя для просмотра его матчей</p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}