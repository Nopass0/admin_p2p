"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { Checkbox } from "@heroui/checkbox";
import { 
  CheckCircle, AlertCircle, RefreshCw, Search, Users, User, Calendar, 
  TrendingUp, ArrowUp, ArrowDown, Link, Unlink, Filter, SortAsc, SortDesc,
  BarChart2, Database, AlertTriangle, Download, FileText
} from "lucide-react";
import dayjs from "dayjs";
import "dayjs/locale/ru"; // Импортируем русскую локаль
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { Badge } from "@heroui/react";

// Подключаем плагины для работы с таймзонами
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("ru"); // Устанавливаем русскую локаль
dayjs.tz.setDefault("Europe/Moscow"); // Устанавливаем московскую таймзону по умолчанию

// Создаем функцию для сдвига времени на -3 часа
const shiftTimeBy3Hours = (date: string | Date) => {
  return dayjs(date).subtract(3, 'hour').toDate();
};

// Alert notification state interface
interface AlertState {
  isVisible: boolean;
  title: string;
  description: string;
  color: "success" | "danger" | "primary" | "warning" | "default" | "secondary";
}

// Sort direction type
type SortDirection = "asc" | "desc" | "null";

// Sort state interface
interface SortState {
  column: string | null;
  direction: SortDirection;
}

// Типы для статистики
interface StatsData {
  totalTelegramTransactions?: number;
  matchedTelegramTransactions?: number;
  unmatchedTelegramTransactions?: number;
  matchedIdexTransactions?: number;
  unmatchedIdexTransactions?: number;
  grossExpense: number;
  grossIncome: number;
  grossProfit: number;
  profitPercentage: number;
  expensePerOrder: number;
  profitPerOrder: number;
  totalTransactions?: number;
  totalIdexTransactions?: number;
  totalMatchedTransactions?: number;
  totalUnmatchedTransactions?: number;
  totalMatchedIdexTransactions?: number;
  totalUnmatchedIdexTransactions?: number;
  matchedCount: number;
}

// Интерфейс для выбранных пользователей в модальном окне сопоставления
interface SelectedUsers {
  [key: number]: boolean;
}

// Интерфейс для выбранных кабинетов в модальном окне сопоставления
interface SelectedCabinets {
  [key: number]: boolean;
}

// Формат даты для отображения
const DATE_FORMAT = "DD.MM.YYYY HH:mm";

// Типы для данных сопоставления
interface MatchRecord {
  id: number;
  transaction: {
    dateTime: string;
    user: {
      id: number;
      name: string;
      telegramAccounts?: Array<{ username: string }>;
      passCode: string;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
      lastNotification: Date | null;
    };
    totalPrice: number;
    type: string;
    originalData: any;
  };
  idexTransaction: {
    externalId: string;
    cabinet: {
      idexId: string;
    };
    approvedAt: string | null;
  };
  grossExpense: number;
  grossIncome: number;
  grossProfit: number;
  profitPercentage: number;
}

interface UserStatsRecord {
  stats: StatsData;
  name: string;
  id: number;
  telegramAccounts?: Array<{ username: string }>;
  passCode: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastNotification: Date | null;
}

// Функция для проверки типа записи сопоставления
const isMatchRecord = (item: any): item is MatchRecord => {
  return item && 
    typeof item.id === 'number' && 
    item.transaction && 
    item.idexTransaction;
};

// Функция для проверки типа записи статистики пользователя
const isUserStatsRecord = (item: any): item is UserStatsRecord => {
  return item && 
    item.stats && 
    typeof item.id === 'number' && 
    typeof item.name === 'string';
};

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
  const [isExporting, setIsExporting] = useState(false);
  const [sortState, setSortState] = useState<SortState>({ column: null, direction: "desc" });
  const [alert, setAlert] = useState<AlertState>({
    isVisible: false,
    title: "",
    description: "",
    color: "default"
  });
  
  // Selected transactions for manual matching
  const [selectedIdexTransaction, setSelectedIdexTransaction] = useState<number | null>(null);
  const [selectedUserTransaction, setSelectedUserTransaction] = useState<number | null>(null);
  
  // Selected user for unmatched transactions view
  const [selectedUnmatchedUserId, setSelectedUnmatchedUserId] = useState<number | null>(null);

  // Состояния для модального окна сопоставления
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [matchModalStartDate, setMatchModalStartDate] = useState(startDate);
  const [matchModalEndDate, setMatchModalEndDate] = useState(endDate);
  const [matchForAll, setMatchForAll] = useState(true);
  const [selectedUserIds, setSelectedUserIds] = useState<SelectedUsers>({});
  const [selectedCabinetIds, setSelectedCabinetIds] = useState<SelectedCabinets>({});

  // State for selected cabinets in the main view
  const [selectedViewCabinetIds, setSelectedViewCabinetIds] = useState<SelectedCabinets>({});
  const [isCabinetSelectorOpen, setIsCabinetSelectorOpen] = useState(false);

  // Toggle cabinet selection in the main view
  const toggleViewCabinetSelection = (cabinetId: number) => {
    setSelectedViewCabinetIds(prev => {
      const newState = { ...prev };
      if (newState[cabinetId]) {
        delete newState[cabinetId];
      } else {
        newState[cabinetId] = true;
      }
      return newState;
    });
  };

  // Clear all view cabinet selections
  const clearCabinetSelection = () => {
    setSelectedViewCabinetIds({});
  };

  // Select all cabinets for view
  const selectAllCabinets = () => {
    if (!cabinetsData?.cabinets) return;
    
    const allCabinets: SelectedCabinets = {};
    cabinetsData.cabinets.forEach(cabinet => {
      allCabinets[cabinet.id] = true;
    });
    
    setSelectedViewCabinetIds(allCabinets);
  };

  // Сортировка кабинетов: сначала те, у которых есть сопоставления
  const getSortedCabinets = () => {
    if (!cabinetsData?.cabinets) return [];
    
    // Если есть статистика по кабинетам
    if (cabinetStatsData) {
      // Сортируем кабинеты по количеству сопоставлений
      return [...cabinetsData.cabinets].sort((a, b) => {
        const aMatchCount = cabinetStatsData.cabinetStats[a.id]?.matchCount || 0;
        const bMatchCount = cabinetStatsData.cabinetStats[b.id]?.matchCount || 0;
        
        // Сначала сортируем по наличию сопоставлений
        if (aMatchCount > 0 && bMatchCount === 0) return -1;
        if (aMatchCount === 0 && bMatchCount > 0) return 1;
        
        // Если у обоих есть сопоставления, сортируем по количеству
        return bMatchCount - aMatchCount;
      });
    }
    
    // Если нет статистики, возвращаем как есть
    return cabinetsData.cabinets;
  };

  // Get users for selection dropdown
  const { data: usersData } = api.users.getAllUsers.useQuery({
    page: 1,
    perPage: 100,
    orderBy: "name",
    orderDir: "asc"
  }, {
    refetchOnWindowFocus: false
  });

  // Получаем статистику по кабинетам (сколько из скольки имеют сопоставления)
  const { data: cabinetStatsData } = api.match.getCabinetMatchStats.useQuery({
    startDate,
    endDate,
    userId: selectedUserId,
  }, {
    refetchOnWindowFocus: false,
    enabled: activeTab === "all" || activeTab === "byUser"
  });

  // Получаем кабинеты для выбора в модальном окне
  const { data: cabinetsData } = api.idex.getAllCabinets.useQuery({
    page: 1,
    perPage: 100
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
    searchQuery,
    sortColumn: sortState.column || undefined,
    sortDirection: sortState.direction || undefined,
    cabinetIds: Object.keys(selectedViewCabinetIds).length > 0 ? 
      Object.keys(selectedViewCabinetIds).map(id => parseInt(id)) : 
      undefined
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
    pageSize,
    sortColumn: sortState.column || undefined,
    sortDirection: sortState.direction || undefined,
    cabinetIds: Object.keys(selectedViewCabinetIds).length > 0 ? 
      Object.keys(selectedViewCabinetIds).map(id => parseInt(id)) : 
      undefined
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
    searchQuery,
    sortColumn: sortState.column || undefined,
    sortDirection: sortState.direction || undefined,
    cabinetIds: Object.keys(selectedViewCabinetIds).length > 0 ? 
      Object.keys(selectedViewCabinetIds).map(id => parseInt(id)) : 
      undefined
  }, {
    refetchOnWindowFocus: false,
    enabled: activeTab === "unmatchedIdex" || activeTab === "unmatchedUser"
  });

  // Get unmatched User transactions
  const {
    data: unmatchedUserData,
    isLoading: isLoadingUnmatchedUser,
    refetch: refetchUnmatchedUser
  } = api.match.getUnmatchedUserTransactions.useQuery({
    userId: activeTab === "unmatchedUser" ? selectedUnmatchedUserId : null,
    startDate,
    endDate,
    page,
    pageSize,
    searchQuery,
    sortColumn: sortState.column || undefined,
    sortDirection: sortState.direction || undefined,
    cabinetIds: Object.keys(selectedViewCabinetIds).length > 0 ? 
      Object.keys(selectedViewCabinetIds).map(id => parseInt(id)) : 
      undefined
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
    pageSize,
    sortColumn: sortState.column || undefined,
    sortDirection: sortState.direction || undefined
  }, {
    refetchOnWindowFocus: false,
    enabled: activeTab === "userStats"
  });

  // Get unmatched transactions stats
  const {
    data: unmatchedStatsData,
    refetch: refetchUnmatchedStats
  } = api.match.getUnmatchedTransactionsStats.useQuery({
    startDate,
    endDate,
    userId: selectedUnmatchedUserId
  }, {
    refetchOnWindowFocus: false,
    enabled: activeTab === "unmatchedUser"
  });

  // Match transactions mutation
  const matchTransactionsMutation = api.match.matchTransactions.useMutation({
    onSuccess: (data) => {
      setIsRunningMatch(false);
      showAlert("Успешно", `Сопоставление транзакций завершено. Найдено ${data.stats?.matchedCount || 0} сопоставлений.`, "success");
      // Refresh data in all tabs
      void refetchAllMatches();
      if (selectedUserId) void refetchUserMatches();
      void refetchUsersWithStats();
      void refetchUnmatchedIdex();
      void refetchUnmatchedUser();
      void refetchUnmatchedStats();
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
      void refetchUnmatchedStats();
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
      void refetchUnmatchedStats();
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при удалении сопоставления: ${error.message}`, "danger");
    }
  });

  // Helper function to show alert notifications
  const showAlert = (title: string, description: string, color: "success" | "danger" | "warning" | "default") => {
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

  // Function to run matching process
  const runMatchProcess = () => {
    if (!startDate || !endDate) {
      showAlert("Ошибка", "Выберите начальную и конечную дату", "danger");
      return;
    }
    
    setIsRunningMatch(true);
    
    matchTransactionsMutation.mutate({
      startDate,
      endDate,
      approvedOnly: true,
      userId: activeTab === "byUser" ? selectedUserId : null
    });
  };

  // Function to create manual match
  const createManualMatch = useCallback(() => {
    if (selectedIdexTransaction && selectedUserTransaction) {
      createManualMatchMutation.mutate({
        idexTransactionId: selectedIdexTransaction,
        userTransactionId: selectedUserTransaction
      });
    } else {
      showAlert("Ошибка", "Необходимо выбрать обе транзакции для сопоставления", "danger");
    }
  }, [selectedIdexTransaction, selectedUserTransaction, createManualMatchMutation]);

  // Function to delete match
  const deleteMatch = (matchId: number) => {
    if (confirm("Вы уверены, что хотите удалить это сопоставление?")) {
      deleteMatchMutation.mutate({ matchId });
    }
  };

  // Function to export data to CSV
  const exportToCSV = useCallback(() => {
    setIsExporting(true);
    
    try {
      let filename = "";
      let headers: string[] = [];
      
      // Подготовка данных в зависимости от активной вкладки
      if (activeTab === "all" && allMatchesData?.matches) {
        // Экспорт для сопоставленных транзакций (all)
        const matchData = allMatchesData.matches.filter(isMatchRecord);
        filename = `all-matches-${dayjs().format("YYYY-MM-DD")}.csv`;
        headers = ["ID", "Пользователь", "Дата транзакции", "Сумма (₽)", "IDEX ID", "ID IDEX кабинета", "Дата IDEX", "Расход (USDT)", "Доход (USDT)", "Спред (USDT)", "Рентабельность (%)"];
        
        if (matchData.length === 0) {
          showAlert("Ошибка", "Нет данных для экспорта", "danger");
          setIsExporting(false);
          return;
        }
        
        // Создание CSV строк
        const rows: string[] = [];
        rows.push(headers.join(","));
        
        matchData.forEach(item => {
          rows.push([
            item.id,
            item.transaction.user.name,
            dayjs(item.transaction.dateTime).format(DATE_FORMAT),
            item.transaction.totalPrice.toFixed(2),
            item.idexTransaction.externalId,
            item.idexTransaction.cabinet.idexId,
            item.idexTransaction.approvedAt ? dayjs(item.idexTransaction.approvedAt).format(DATE_FORMAT) : "-",
            item.grossExpense.toFixed(2),
            item.grossIncome.toFixed(2),
            item.grossProfit.toFixed(2),
            item.profitPercentage.toFixed(2)
          ].join(","));
        });
        
        // Создание и скачивание CSV-файла
        const csvContent = rows.join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showAlert("Успешно", "Данные экспортированы в CSV", "success");
      } 
      else if (activeTab === "byUser" && userMatchesData?.matches) {
        // Экспорт для сопоставленных транзакций пользователя
        const matchData = userMatchesData.matches.filter(isMatchRecord);
        
        if (matchData.length === 0) {
          showAlert("Ошибка", "Нет данных для экспорта", "danger");
          setIsExporting(false);
          return;
        }
        
        const userName = matchData[0].transaction.user.name || "пользователя";
        filename = `matches-${userName}-${dayjs().format("YYYY-MM-DD")}.csv`;
        headers = ["ID", "Дата транзакции", "Сумма (₽)", "IDEX ID", "ID IDEX кабинета", "Дата IDEX", "Расход (USDT)", "Доход (USDT)", "Спред (USDT)", "Рентабельность (%)"];
        
        // Создание CSV строк
        const rows: string[] = [];
        rows.push(headers.join(","));
        
        matchData.forEach(item => {
          rows.push([
            item.id,
            dayjs(item.transaction.dateTime).format(DATE_FORMAT),
            item.transaction.totalPrice.toFixed(2),
            item.idexTransaction.externalId,
            item.idexTransaction.cabinet.idexId,
            item.idexTransaction.approvedAt ? dayjs(item.idexTransaction.approvedAt).format(DATE_FORMAT) : "-",
            item.grossExpense.toFixed(2),
            item.grossIncome.toFixed(2),
            item.grossProfit.toFixed(2),
            item.profitPercentage.toFixed(2)
          ].join(","));
        });
        
        // Создание и скачивание CSV-файла
        const csvContent = rows.join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showAlert("Успешно", "Данные экспортированы в CSV", "success");
      } 
      else if (activeTab === "unmatchedIdex" && unmatchedIdexData?.transactions) {
        // Экспорт для несопоставленных IDEX транзакций
        const idexData = unmatchedIdexData.transactions;
        
        if (idexData.length === 0) {
          showAlert("Ошибка", "Нет данных для экспорта", "danger");
          setIsExporting(false);
          return;
        }
        
        filename = `unmatched-idex-${dayjs().format("YYYY-MM-DD")}.csv`;
        headers = ["ID", "Внешний ID", "Дата подтверждения", "Сумма (₽)"];
        
        // Создание CSV строк
        const rows: string[] = [];
        rows.push(headers.join(","));
        
        idexData.forEach(item => {
          let amountValue = 0;
          try {
            if (typeof item.amount === 'string') {
              const amountJson = JSON.parse(item.amount);
              amountValue = parseFloat(amountJson.trader?.[643] || 0);
            } else if (item.amount && typeof item.amount === 'object') {
              amountValue = parseFloat(item.amount.trader?.[643] || 0);
            }
          } catch (error) {
            console.error('Ошибка при парсинге JSON поля amount:', error);
          }
          
          rows.push([
            item.id,
            item.externalId.toString(),
            item.approvedAt ? dayjs(item.approvedAt).format(DATE_FORMAT) : "-",
            amountValue.toFixed(2)
          ].join(","));
        });
        
        // Создание и скачивание CSV-файла
        const csvContent = rows.join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showAlert("Успешно", "Данные экспортированы в CSV", "success");
      } 
      else if (activeTab === "unmatchedUser" && unmatchedUserData?.transactions) {
        // Экспорт для несопоставленных пользовательских транзакций
        const userData = unmatchedUserData.transactions;
        
        if (userData.length === 0) {
          showAlert("Ошибка", "Нет данных для экспорта", "danger");
          setIsExporting(false);
          return;
        }
        
        filename = `unmatched-user-${dayjs().format("YYYY-MM-DD")}.csv`;
        headers = ["ID", "Дата", "Сумма (₽)", "Тип"];
        
        // Создание CSV строк
        const rows: string[] = [];
        rows.push(headers.join(","));
        
        userData.forEach(item => {
          rows.push([
            item.id,
            dayjs(item.dateTime).format(DATE_FORMAT),
            item.totalPrice.toFixed(2),
            item.type
          ].join(","));
        });
        
        // Создание и скачивание CSV-файла
        const csvContent = rows.join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showAlert("Успешно", "Данные экспортированы в CSV", "success");
      } 
      else if (activeTab === "userStats" && usersWithStatsData?.users) {
        // Экспорт для статистики пользователей
        const statsData = usersWithStatsData.users.filter(isUserStatsRecord);
        
        if (statsData.length === 0) {
          showAlert("Ошибка", "Нет данных для экспорта", "danger");
          setIsExporting(false);
          return;
        }
        
        filename = `user-stats-${dayjs().format("YYYY-MM-DD")}.csv`;
        headers = ["Пользователь", "Всего транзакций", "Сопоставлено", "Не сопоставлено", "Расход (USDT)", "Доход (USDT)", "Спред (USDT)", "Рентабельность (%)"];
        
        // Создание CSV строк
        const rows: string[] = [];
        rows.push(headers.join(","));
        
        statsData.forEach(item => {
          rows.push([
            item.name,
            item.stats.totalTelegramTransactions?.toString() || "0",
            item.stats.matchedTelegramTransactions?.toString() || "0",
            item.stats.unmatchedTelegramTransactions?.toString() || "0",
            item.stats.grossExpense.toFixed(2),
            item.stats.grossIncome.toFixed(2),
            item.stats.grossProfit.toFixed(2),
            item.stats.profitPercentage.toFixed(2)
          ].join(","));
        });
        
        // Создание и скачивание CSV-файла
        const csvContent = rows.join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showAlert("Успешно", "Данные экспортированы в CSV", "success");
      } 
      else {
        showAlert("Ошибка", "Нет данных для экспорта", "danger");
      }
    } catch (error) {
      console.error("Ошибка при экспорте данных:", error);
      showAlert("Ошибка", "Не удалось экспортировать данные", "danger");
    } finally {
      setIsExporting(false);
    }
  }, [activeTab, allMatchesData, userMatchesData, unmatchedIdexData, unmatchedUserData, usersWithStatsData]);

  // Format numbers with two decimal places
  const formatNumber = (num: number) => num.toFixed(2);

  // Reset pagination when changing tabs
  useEffect(() => {
    setPage(1);
    
    // Set selectedUnmatchedUserId to selectedUserId when switching to unmatchedUser tab
    if (activeTab === "unmatchedUser" && !selectedUnmatchedUserId && selectedUserId) {
      setSelectedUnmatchedUserId(selectedUserId);
    }
  }, [activeTab, selectedUserId, selectedUnmatchedUserId]);

  // Reset pagination when changing user
  useEffect(() => {
    if (activeTab === "byUser") {
      setPage(1);
    }
  }, [selectedUserId, activeTab]);

  // Reset pagination when changing unmatched user
  useEffect(() => {
    if (activeTab === "unmatchedUser") {
      setPage(1);
    }
  }, [selectedUnmatchedUserId, activeTab]);

  // Handle sorting
  const handleSort = (column: string) => {
    setSortState(prev => {
      if (prev.column === column) {
        // Toggle direction if same column
        const newDirection = prev.direction === "asc" ? "desc" : prev.direction === "desc" ? "null" : "asc";
        return {
          column: newDirection === "null" ? null : column,
          direction: newDirection
        };
      } else {
        // Set new column with ascending direction
        return { column, direction: "asc" };
      }
    });
  };

  // Function to render a sortable column header
  const renderSortableHeader = (columnName: string, displayName: string) => (
    <div 
      className="flex items-center cursor-pointer"
      onClick={() => handleSort(columnName)}
    >
      {displayName}
      {sortState.column === columnName && sortState.direction !== "null" && (
        <span className="ml-1">
          {sortState.direction === "asc" ? <SortAsc className="w-4 h-4" /> : 
           sortState.direction === "desc" ? <SortDesc className="w-4 h-4" /> : null}
        </span>
      )}
    </div>
  );

  // Function to render statistics
  const renderStats = (stats: StatsData | null) => {
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

  // Function to render transaction statistics
  const renderTransactionStats = (stats: StatsData | null) => {
    if (!stats) return null;
    
    // Make sure we have total counts
    const totalTransactions = stats.totalTransactions || stats.totalTelegramTransactions || 0;
    const matchedTransactions = stats.totalMatchedTransactions || stats.matchedTelegramTransactions || 0;
    const unmatchedTransactions = stats.totalUnmatchedTransactions || stats.unmatchedTelegramTransactions || 0;
    
    const totalIdexTransactions = stats.totalIdexTransactions || 0;
    const matchedIdexTransactions = stats.totalMatchedIdexTransactions || stats.matchedIdexTransactions || 0;
    const unmatchedIdexTransactions = stats.totalUnmatchedIdexTransactions || stats.unmatchedIdexTransactions || 0;
    
    return (
      <Card className="mb-6">
        <CardHeader>
          <h3 className="text-lg font-medium">Статистика транзакций</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-100 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <Database className="w-5 h-5 text-blue-500 mr-2" />
                <h4 className="font-medium">Телеграмм транзакции</h4>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div>
                  <p className="text-sm text-gray-600">Всего:</p>
                  <p className="text-xl font-bold">{totalTransactions}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Сопоставлено:</p>
                  <p className="text-xl font-bold">{matchedTransactions}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Не сопоставлено:</p>
                  <p className="text-xl font-bold">{unmatchedTransactions}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-purple-100 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <BarChart2 className="w-5 h-5 text-purple-500 mr-2" />
                <h4 className="font-medium">IDEX транзакции</h4>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3">
                {/* Левая колонка со статистикой */}
                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <p className="text-sm text-gray-600">Всего IDEX:</p>
                    <p className="text-xl font-bold">{totalIdexTransactions}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Сопоставлено IDEX:</p>
                    <p className="text-xl font-bold text-green-500">{matchedIdexTransactions}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Не сопоставлено IDEX:</p>
                    <p className="text-xl font-bold text-red-500">{unmatchedIdexTransactions}</p>
                  </div>
                </div>
                
                {/* Правая колонка со списком кабинетов */}
                <div className="border-l pl-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm font-medium text-gray-700">Фильтр по кабинетам:</p>
                    <div className="flex gap-1">
                      <Button 
                        size="sm" 
                        variant="flat" 
                        color="primary"
                        onClick={selectAllCabinets}
                      >
                        Все
                      </Button>
                      <Button 
                        size="sm" 
                        variant="flat" 
                        color="danger"
                        onClick={clearCabinetSelection}
                      >
                        Сброс
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto pr-2">
                    {cabinetStatsData && cabinetsData?.cabinets ? (
                      <div className="space-y-2">
                        {getSortedCabinets().map(cabinet => {
                          const cabinetStats = cabinetStatsData.cabinetStats[cabinet.id] || { matchCount: 0, totalCount: 0 };
                          const isSelected = !!selectedViewCabinetIds[cabinet.id];
                          
                          return (
                            <div 
                              key={cabinet.id}
                              className={`flex items-center justify-between rounded-md p-1.5 cursor-pointer ${
                                isSelected ? 'bg-blue-100' : 
                                cabinetStats.hasUserMatches ? 'bg-green-50' : 
                                'bg-white'
                              }`}
                              onClick={() => toggleViewCabinetSelection(cabinet.id)}
                            >
                              <div className="flex items-center">
                                <Checkbox 
                                  isSelected={isSelected}
                                  onChange={() => toggleViewCabinetSelection(cabinet.id)} 
                                  className="mr-2"
                                />
                                <span className="text-sm font-medium">ID {cabinet.idexId}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded">
                                  {cabinetStats.matchCount}/{cabinetStats.totalCount || 0}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Загрузка кабинетов...</p>
                    )}
                  </div>
                  {Object.keys(selectedViewCabinetIds).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Object.keys(selectedViewCabinetIds).map(id => {
                        const cabinet = cabinetsData?.cabinets.find(c => c.id === parseInt(id));
                        return cabinet ? (
                          <Badge 
                            key={id} 
                            color="primary" 
                            variant="flat"
                            className="cursor-pointer"
                            onClick={() => toggleViewCabinetSelection(parseInt(id))}
                          >
                            ID {cabinet.idexId}
                            <span className="ml-1 text-xs">×</span>
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
          </div>
        </CardBody>
      </Card>
    );
  };

  // Function to handle opening the match modal
  const handleOpenMatchModal = () => {
    setMatchModalStartDate(startDate);
    setMatchModalEndDate(endDate);
    setMatchForAll(true);
    setSelectedUserIds({});
    setSelectedCabinetIds({});
    setIsMatchModalOpen(true);
  };

  // Handle modal close
  const handleCloseMatchModal = () => {
    setIsMatchModalOpen(false);
  };

  // Toggle user selection
  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds(prev => {
      const newState = { ...prev };
      if (newState[userId]) {
        delete newState[userId];
      } else {
        newState[userId] = true;
      }
      return newState;
    });
  };

  // Toggle cabinet selection
  const toggleCabinetSelection = (cabinetId: number) => {
    setSelectedCabinetIds(prev => {
      const newState = { ...prev };
      if (newState[cabinetId]) {
        delete newState[cabinetId];
      } else {
        newState[cabinetId] = true;
      }
      return newState;
    });
  };

  // Start matching process with selected parameters
  const handleStartMatching = () => {
    setIsRunningMatch(true);
    
    // Convert selected users and cabinets objects to arrays of IDs
    const userIds = matchForAll ? [] : Object.keys(selectedUserIds).map(id => parseInt(id));
    const cabinetIds = Object.keys(selectedCabinetIds).map(id => parseInt(id));
    
    // Call the mutation with selected parameters
    matchTransactionsMutation.mutate({
      startDate: matchModalStartDate,
      endDate: matchModalEndDate,
      approvedOnly: true,
      userIds: userIds.length > 0 ? userIds : undefined,
      cabinetIds: cabinetIds.length > 0 ? cabinetIds : undefined
    });
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
          <Button
            color="primary"
            variant="flat"
            startIcon={<Download className="w-4 h-4" />}
            isLoading={isExporting}
            onClick={exportToCSV}
          >
            Экспорт
          </Button>
          {(activeTab === "unmatchedIdex" || activeTab === "unmatchedUser") && (
            <Button
              color="primary"
              startIcon={<Link className="w-4 h-4" />}
              onClick={createManualMatch}
              disabled={!selectedIdexTransaction || !selectedUserTransaction}
            >
              Создать сопоставление
            </Button>
          )}
          <Button
            color="primary"
            startIcon={<RefreshCw className="w-4 h-4" />}
            isLoading={isRunningMatch}
            onClick={runMatchProcess}
          >
            {isRunningMatch ? "Сопоставление..." : "Запустить сопоставление"}
          </Button>
          <Button
            color="primary"
            onClick={handleOpenMatchModal}
            aria-label="Запустить сопоставление с фильтрами"
          >
            Сопоставление с фильтрами
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
                value={activeTab === "byUser" ? (selectedUserId?.toString() || "") : (activeTab === "unmatchedUser" ? (selectedUnmatchedUserId?.toString() || "") : "")}
                onChange={(e) => {
                  const userId = e.target.value ? parseInt(e.target.value) : null;
                  if (activeTab === "byUser") {
                    setSelectedUserId(userId);
                  } else if (activeTab === "unmatchedUser") {
                    setSelectedUnmatchedUserId(userId);
                  }
                }}
                startContent={<User className="w-4 h-4 text-gray-500" />}
                aria-label="Выбрать пользователя"
                isDisabled={activeTab !== "byUser" && activeTab !== "unmatchedUser"}
              >
                <SelectItem key="all" value="">
                  Все пользователи
                </SelectItem>
                {usersData?.users ? (
                  <>
                    {usersData.users.map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.name} ({user.telegramAccounts?.[0]?.username || 'Без username'})
                      </SelectItem>
                    ))}
                  </>
                ) : null}
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
      
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex -mb-px">
          <button
            onClick={() => setActiveTab("all")}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 ${
              activeTab === "all" 
                ? "border-primary-500 text-primary-500" 
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Все Сопоставления</span>
          </button>
          <button
            onClick={() => setActiveTab("byUser")}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 ${
              activeTab === "byUser" 
                ? "border-primary-500 text-primary-500" 
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <User className="w-4 h-4" />
            <span>Сопоставления пользователя</span>
          </button>
          <button
            onClick={() => setActiveTab("unmatchedIdex")}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 ${
              activeTab === "unmatchedIdex" 
                ? "border-primary-500 text-primary-500" 
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            <span>Несопоставленные IDEX</span>
          </button>
          <button
            onClick={() => setActiveTab("unmatchedUser")}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 ${
              activeTab === "unmatchedUser" 
                ? "border-primary-500 text-primary-500" 
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Ручное сопоставление</span>
          </button>
          <button
            onClick={() => setActiveTab("userStats")}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 ${
              activeTab === "userStats" 
                ? "border-primary-500 text-primary-500" 
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>Статистика по пользователям</span>
          </button>
        </nav>
      </div>
      
      {/* All matches stats */}
      {activeTab === "all" && allMatchesData?.stats && (
        <>
          {renderStats(allMatchesData.stats)}
          {renderTransactionStats(allMatchesData.stats)}
        </>
      )}
      
      {/* User matches stats */}
      {activeTab === "byUser" && userMatchesData?.stats && (
        <>
          {renderStats(userMatchesData.stats)}
          {renderTransactionStats(userMatchesData.stats)}
        </>
      )}
      
      {/* Unmatched User split view for manual matching */}
      {activeTab === "unmatchedUser" && (
        <>
          {/* Manual matching panel */}
          <Card className="mb-6">
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-md font-medium mb-2">Выбранная транзакция кошелька</h3>
                  {selectedUserTransaction ? (
                    <div className="p-3 bg-gray-100 rounded">
                      <p>ID: {selectedUserTransaction}</p>
                      {unmatchedUserData?.transactions && (
                        <>
                          <p>
                            {(() => {
                              const tx = unmatchedUserData.transactions.find(t => t.id === selectedUserTransaction);
                              return tx ? `Сумма: ${formatNumber(tx.totalPrice)} ₽` : '';
                            })()}
                          </p>
                          <p>
                            {(() => {
                              const tx = unmatchedUserData.transactions.find(t => t.id === selectedUserTransaction);
                              return tx ? `Дата: ${dayjs(tx.dateTime).format(DATE_FORMAT)}` : '';
                            })()}
                          </p>
                        </>
                      )}
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
                    <p className="text-gray-500">Выберите транзакцию кошелька из таблицы ниже</p>
                  )}
                </div>
                <div>
                  <h3 className="text-md font-medium mb-2">Выбранная IDEX транзакция</h3>
                  {selectedIdexTransaction ? (
                    <div className="p-3 bg-gray-100 rounded">
                      <p>ID: {selectedIdexTransaction}</p>
                      {unmatchedIdexData?.transactions && (
                        <>
                          <p>
                            {(() => {
                              const tx = unmatchedIdexData.transactions.find(t => t.id === selectedIdexTransaction);
                              if (!tx) return '';
                              let amountValue = 0;
                              try {
                                if (typeof tx.amount === 'string') {
                                  const amountJson = JSON.parse(tx.amount);
                                  amountValue = parseFloat(amountJson.trader?.[643] || 0);
                                } else if (tx.amount && typeof tx.amount === 'object') {
                                  amountValue = parseFloat(tx.amount.trader?.[643] || 0);
                                }
                              } catch (error) {
                                console.error('Ошибка при парсинге JSON поля amount:', error);
                              }
                              return `Сумма: ${formatNumber(amountValue)} ₽`;
                            })()}
                          </p>
                          <p>
                            {(() => {
                              const tx = unmatchedIdexData.transactions.find(t => t.id === selectedIdexTransaction);
                              return tx?.approvedAt ? `Дата: ${dayjs(tx.approvedAt).format(DATE_FORMAT)}` : '';
                            })()}
                          </p>
                        </>
                      )}
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
                    <p className="text-gray-500">Выберите IDEX транзакцию из таблицы ниже</p>
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
                    Создать сопоставление
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Split view for manual matching */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* User transactions */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-500" />
                  <h2 className="text-lg font-semibold">Несопоставленные транзакции кошелька</h2>
                </div>
              </CardHeader>
              <CardBody>
                {isLoadingUnmatchedUser ? (
                  <div className="flex justify-center py-10">
                    <Spinner size="lg" color="primary" />
                  </div>
                ) : unmatchedUserData?.transactions && unmatchedUserData.transactions.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <Table aria-label="Таблица несопоставленных транзакций кошелька">
                        <TableHeader>
                          <TableColumn>{renderSortableHeader("id", "ID")}</TableColumn>
                          {!selectedUnmatchedUserId && <TableColumn>{renderSortableHeader("user.name", "Пользователь")}</TableColumn>}
                          <TableColumn>{renderSortableHeader("dateTime", "Дата")}</TableColumn>
                          <TableColumn>{renderSortableHeader("totalPrice", "Сумма")}</TableColumn>
                          <TableColumn>{renderSortableHeader("type", "Тип")}</TableColumn>
                          <TableColumn>Действия</TableColumn>
                        </TableHeader>
                        <TableBody>
                          {unmatchedUserData.transactions.map((transaction) => (
                            <TableRow 
                              key={transaction.id}
                              className={selectedUserTransaction === transaction.id ? "bg-blue-100" : ""}
                            >
                              <TableCell>{transaction.id}</TableCell>
                              {!selectedUnmatchedUserId && <TableCell>{transaction.user?.name || '-'}</TableCell>}
                              <TableCell>{dayjs(transaction.dateTime).format(DATE_FORMAT)}</TableCell>
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
                    <FileText className="w-16 h-16 mx-auto text-gray-400 mb-2" />
                    <p>Нет несопоставленных транзакций кошелька в выбранном диапазоне дат</p>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* IDEX transactions */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-purple-500" />
                  <h2 className="text-lg font-semibold">Несопоставленные IDEX транзакции</h2>
                </div>
              </CardHeader>
              <CardBody>
                {isLoadingUnmatchedIdex ? (
                  <div className="flex justify-center py-10">
                    <Spinner size="lg" color="primary" />
                  </div>
                ) : unmatchedIdexData?.transactions && unmatchedIdexData.transactions.length > 0 ? (
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
                          {unmatchedIdexData.transactions.map((transaction) => {
                            // Parse amount from JSON
                            let amountValue = 0;
                            try {
                              if (typeof transaction.amount === 'string') {
                                const amountJson = JSON.parse(transaction.amount as string);
                                amountValue = parseFloat(amountJson.trader?.[643] || 0);
                              } else if (transaction.amount && typeof transaction.amount === 'object') {
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
                                <TableCell>{transaction.approvedAt ? dayjs(transaction.approvedAt).format(DATE_FORMAT) : '-'}</TableCell>
                                <TableCell>{formatNumber(amountValue)} ₽</TableCell>
                                <TableCell>
                                  <Button 
                                    color={selectedIdexTransaction === transaction.id ? "secondary" : "primary"} 
                                    variant="flat" 
                                    size="sm"
                                    onClick={() => {
                                      setSelectedIdexTransaction(
                                        selectedIdexTransaction === transaction.id ? null : transaction.id
                                      );
                                      if (activeTab === "unmatchedIdex") {
                                        setActiveTab("unmatchedUser");
                                      }
                                    }}
                                  >
                                    {selectedIdexTransaction === transaction.id ? "Отменить выбор" : "Выбрать для сопоставления"}
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
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}
      
      {/* Tables with data based on selected tab */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            {activeTab === "all" && <Users className="w-5 h-5 text-gray-500" />}
            {activeTab === "byUser" && <User className="w-5 h-5 text-gray-500" />}
            {activeTab === "unmatchedIdex" && <AlertCircle className="w-5 h-5 text-gray-500" />}
            {activeTab === "unmatchedUser" && <AlertTriangle className="w-5 h-5 text-gray-500" />}
            {activeTab === "userStats" && <TrendingUp className="w-5 h-5 text-gray-500" />}
            <h3 className="text-lg font-medium">
              {activeTab === "all" && "Все Сопоставленные транзакции"}
              {activeTab === "byUser" && "Сопоставления выбранного пользователя"}
              {activeTab === "unmatchedIdex" && "Несопоставленные IDEX транзакции"}
              {activeTab === "unmatchedUser" && "Сопоставления транзакций"}
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
            ) : allMatchesData?.matches && allMatchesData.matches.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table aria-label="Таблица всех сопоставленных транзакций">
                    <TableHeader>
                      <TableColumn>{renderSortableHeader("id", "ID")}</TableColumn>
                      <TableColumn>{renderSortableHeader("transaction.user.name", "Пользователь")}</TableColumn>
                      <TableColumn>{renderSortableHeader("transaction.dateTime", "Дата транзакции")}</TableColumn>
                      <TableColumn>{renderSortableHeader("transaction.totalPrice", "Сумма транзакции")}</TableColumn>
                      <TableColumn>{renderSortableHeader("idexTransaction.externalId", "IDEX ID")}</TableColumn>
                      <TableColumn>{renderSortableHeader("idexTransaction.cabinet.idexId", "ID IDEX кабинета")}</TableColumn>
                      <TableColumn>{renderSortableHeader("idexTransaction.approvedAt", "Дата IDEX")}</TableColumn>
                      <TableColumn>{renderSortableHeader("grossExpense", "Расход")}</TableColumn>
                      <TableColumn>{renderSortableHeader("grossIncome", "Доход")}</TableColumn>
                      <TableColumn>{renderSortableHeader("grossProfit", "Спред")}</TableColumn>
                      <TableColumn>{renderSortableHeader("profitPercentage", "%")}</TableColumn>
                      <TableColumn>Действия</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {allMatchesData.matches.map((match) => (
                        <TableRow key={match.id}>
                          <TableCell>{match.id}</TableCell>
                          <TableCell>{match.transaction.user.name}</TableCell>
                          <TableCell>{dayjs(shiftTimeBy3Hours(match.transaction.dateTime)).format(DATE_FORMAT)}</TableCell>
                          <TableCell>{formatNumber(match.transaction.totalPrice)} ₽</TableCell>
                          <TableCell>{match.idexTransaction.externalId.toString()}</TableCell>
                          <TableCell>{match.idexTransaction.cabinet.idexId.toString()}</TableCell>
                          <TableCell>{match.idexTransaction.approvedAt ? dayjs(shiftTimeBy3Hours(match.idexTransaction.approvedAt)).format(DATE_FORMAT) : '-'}</TableCell>
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
                              Удалить
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
                      aria-label="Пагинация всех сопоставлений"
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
                  aria-label="Запустить сопоставление"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
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
                <p>Выберите пользователя для просмотра его сопоставлений</p>
              </div>
            ) : isLoadingUserMatches ? (
              <div className="flex justify-center py-10">
                <Spinner size="lg" color="primary" />
              </div>
            ) : userMatchesData?.matches && userMatchesData.matches.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table aria-label="Таблица сопоставленных транзакций пользователя">
                    <TableHeader>
                      <TableColumn>{renderSortableHeader("id", "ID")}</TableColumn>
                      <TableColumn>{renderSortableHeader("transaction.dateTime", "Дата транзакции")}</TableColumn>
                      <TableColumn>{renderSortableHeader("transaction.totalPrice", "Сумма транзакции")}</TableColumn>
                      <TableColumn>{renderSortableHeader("idexTransaction.externalId", "IDEX ID")}</TableColumn>
                      <TableColumn>{renderSortableHeader("idexTransaction.cabinet.idexId", "ID IDEX кабинета")}</TableColumn>
                      <TableColumn>{renderSortableHeader("idexTransaction.approvedAt", "Дата IDEX")}</TableColumn>
                      <TableColumn>{renderSortableHeader("grossExpense", "Расход")}</TableColumn>
                      <TableColumn>{renderSortableHeader("grossIncome", "Доход")}</TableColumn>
                      <TableColumn>{renderSortableHeader("grossProfit", "Спред")}</TableColumn>
                      <TableColumn>{renderSortableHeader("profitPercentage", "%")}</TableColumn>
                      <TableColumn>Действия</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {userMatchesData.matches.map((match) => (
                        <TableRow key={match.id}>
                          <TableCell>{match.id}</TableCell>
                          <TableCell>{dayjs(shiftTimeBy3Hours(match.transaction.dateTime)).format(DATE_FORMAT)}</TableCell>
                          <TableCell>{formatNumber(match.transaction.totalPrice)} ₽</TableCell>
                          <TableCell>{match.idexTransaction.externalId.toString()}</TableCell>
                          <TableCell>{match.idexTransaction.cabinet.idexId.toString()}</TableCell>
                          <TableCell>{match.idexTransaction.approvedAt ? dayjs(shiftTimeBy3Hours(match.idexTransaction.approvedAt)).format(DATE_FORMAT) : '-'}</TableCell>
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
                              Удалить
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
                      aria-label="Пагинация сопоставлений пользователя"
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
                  aria-label="Запустить сопоставление"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
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
            ) : unmatchedIdexData?.transactions && unmatchedIdexData.transactions.length > 0 ? (
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
                      {unmatchedIdexData.transactions.map((transaction) => {
                        // Parse amount from JSON
                        let amountValue = 0;
                        try {
                          if (typeof transaction.amount === 'string') {
                            const amountJson = JSON.parse(transaction.amount as string);
                            amountValue = parseFloat(amountJson.trader?.[643] || 0);
                          } else if (transaction.amount && typeof transaction.amount === 'object') {
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
                            <TableCell>{transaction.approvedAt ? dayjs(transaction.approvedAt).format(DATE_FORMAT) : '-'}</TableCell>
                            <TableCell>{formatNumber(amountValue)} ₽</TableCell>
                            <TableCell>
                              <Button 
                                color={selectedIdexTransaction === transaction.id ? "secondary" : "primary"} 
                                variant="flat" 
                                size="sm"
                                onClick={() => {
                                  setSelectedIdexTransaction(
                                    selectedIdexTransaction === transaction.id ? null : transaction.id
                                  );
                                  if (activeTab === "unmatchedIdex") {
                                    setActiveTab("unmatchedUser");
                                  }
                                }}
                              >
                                {selectedIdexTransaction === transaction.id ? "Отменить выбор" : "Выбрать для сопоставления"}
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
          
          {/* User statistics table */}
          {activeTab === "userStats" && (
            isLoadingUsersWithStats ? (
              <div className="flex justify-center py-10">
                <Spinner size="lg" color="primary" />
              </div>
            ) : usersWithStatsData?.users && usersWithStatsData.users.length > 0 ? (
              <>
                {/* Global statistics summary */}
                {usersWithStatsData.totalStats && (
                  <div className="mb-6">
                    <Card className="bg-gray-50">
                      <CardBody>
                        <h3 className="text-lg font-semibold mb-3">Общая статистика за период</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-gray-600">Телеграм транзакции:</p>
                            <p className="font-medium">Всего: {usersWithStatsData.totalStats.totalTelegramTransactions}</p>
                            <p className="font-medium text-green-600">Сопоставлено: {usersWithStatsData.totalStats.matchedTelegramTransactions}</p>
                            <p className="font-medium text-red-600">Не сопоставлено: {usersWithStatsData.totalStats.unmatchedTelegramTransactions}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">IDEX транзакции:</p>
                            <p className="font-medium">Всего: {usersWithStatsData.totalStats.totalIdexTransactions}</p>
                            <p className="font-medium text-green-600">Сопоставлено: {usersWithStatsData.totalStats.matchedIdexTransactions}</p>
                            <p className="font-medium text-red-600">Не сопоставлено: {usersWithStatsData.totalStats.unmatchedIdexTransactions}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Финансовые показатели:</p>
                            <p className="font-medium">Валовый расход: {formatNumber(usersWithStatsData.totalStats.grossExpense)} USDT</p>
                            <p className="font-medium">Валовый доход: {formatNumber(usersWithStatsData.totalStats.grossIncome)} USDT</p>
                            <p className={`font-medium ${usersWithStatsData.totalStats.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              Валовая прибыль: {formatNumber(usersWithStatsData.totalStats.grossProfit)} USDT 
                              ({formatNumber(usersWithStatsData.totalStats.profitPercentage)}%)
                            </p>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  </div>
                )}
                
                <div className="overflow-x-auto">
                  <Table aria-label="Таблица статистики по пользователям">
                    <TableHeader>
                      <TableColumn>{renderSortableHeader("name", "Пользователь")}</TableColumn>
                      <TableColumn>{renderSortableHeader("stats.totalTelegramTransactions", "Всего ТГ-транзакций")}</TableColumn>
                      <TableColumn>{renderSortableHeader("stats.totalIdexTransactions", "Всего Bybit-транзакций")}</TableColumn>
                      <TableColumn>{renderSortableHeader("stats.totalBybitTransactions", "Всего Bybit-транзакций")}</TableColumn>
                      <TableColumn>{renderSortableHeader("stats.matchedTelegramTransactions", "Сопоставлено ТГ")}</TableColumn>
                      <TableColumn>{renderSortableHeader("stats.matchedIdexTransactions", "Сопоставлено IDEX")}</TableColumn>
                      <TableColumn>{renderSortableHeader("stats.grossExpense", "Расход")}</TableColumn>
                      <TableColumn>{renderSortableHeader("stats.grossIncome", "Доход")}</TableColumn>
                      <TableColumn>{renderSortableHeader("stats.grossProfit", "Спред")}</TableColumn>
                      <TableColumn>{renderSortableHeader("stats.profitPercentage", "% спреда")}</TableColumn>
                      <TableColumn>{renderSortableHeader("stats.profitPerOrder", "Ср. спред/сопоставление")}</TableColumn>
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
                          <TableCell>
                            <div className="flex items-center">
                              <User className="w-4 h-4 mr-2 text-gray-500" />
                              <span>{user.name}</span>
                              <span className="text-xs text-gray-500 ml-1">
                                ({user.telegramAccounts?.[0]?.username || 'Без username'})
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{user.stats.totalTelegramTransactions}</TableCell>
                          <TableCell>0</TableCell>
                          <TableCell>0</TableCell>
                          <TableCell>
                            <span className="text-green-600">{user.stats.matchedTelegramTransactions}</span>
                            <span className="text-xs text-gray-500 ml-1">
                              ({formatNumber(user.stats.matchedTelegramTransactions / user.stats.totalTelegramTransactions * 100)}%)
                            </span>
                          </TableCell>
                          <TableCell>{user.stats.matchedIdexTransactions}</TableCell>
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
                  aria-label="Запустить сопоставление"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Запустить сопоставление
                </Button>
              </div>
            )
          )}
        </CardBody>
      </Card>
      
      {/* Modal for matching with filters */}
      <Modal
        isOpen={isMatchModalOpen}
        onClose={handleCloseMatchModal}
        aria-label="Модальное окно сопоставления"
      >
        <ModalContent>
          <ModalHeader>
            <h3 className="text-lg font-medium">Сопоставление с фильтрами</h3>
          </ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Дата и время начала</label>
                <Input
                  type="datetime-local"
                  value={matchModalStartDate}
                  onChange={(e) => setMatchModalStartDate(e.target.value)}
                  startContent={<Calendar className="w-4 h-4 text-gray-500" />}
                  aria-label="Дата и время начала"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Дата и время окончания</label>
                <Input
                  type="datetime-local"
                  value={matchModalEndDate}
                  onChange={(e) => setMatchModalEndDate(e.target.value)}
                  startContent={<Calendar className="w-4 h-4 text-gray-500" />}
                  aria-label="Дата и время окончания"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Пользователи</label>
                <div className="border rounded p-2 h-48 overflow-y-auto">
                  <div className="mb-2">
                    <Checkbox
                      isSelected={matchForAll}
                      onChange={() => setMatchForAll(!matchForAll)}
                    >
                      Все пользователи
                    </Checkbox>
                  </div>
                  {!matchForAll && usersData?.users ? (
                    <>
                      {usersData.users.map((user) => (
                        <div key={`user-${user.id}`} className="mb-1">
                          <Checkbox
                            isSelected={!!selectedUserIds[user.id]}
                            onChange={() => toggleUserSelection(user.id)}
                          >
                            {user.name} ({user.telegramAccounts?.[0]?.username || 'Без username'})
                          </Checkbox>
                        </div>
                      ))}
                    </>
                  ) : null}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Кабинеты</label>
                <div className="border rounded p-2 h-48 overflow-y-auto">
                  {cabinetsData?.cabinets ? (
                    <>
                      {getSortedCabinets().map((cabinet) => (
                        <div key={`cabinet-${cabinet.id}`} className="mb-1">
                          <Checkbox
                            isSelected={!!selectedCabinetIds[cabinet.id]}
                            onChange={() => toggleCabinetSelection(cabinet.id)}
                          >
                            {cabinet.idexId}
                          </Checkbox>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="text-sm text-gray-500">Загрузка кабинетов...</div>
                  )}
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              color="primary"
              isLoading={isRunningMatch}
              onClick={handleStartMatching}
            >
              {isRunningMatch ? "Сопоставление..." : "Запустить сопоставление"}
            </Button>
            <Button
              color="default"
              variant="flat"
              onClick={handleCloseMatchModal}
            >
              Отмена
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}