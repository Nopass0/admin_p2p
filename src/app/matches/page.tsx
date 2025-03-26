"use client";

import { useState, useEffect, useCallback, useLayoutEffect } from "react";
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
  BarChart2, Database, AlertTriangle, Download, FileText,
  DollarSign,
  ArrowUpDown,
  CircleDollarSign
} from "lucide-react";
import dayjs from "dayjs";
import "dayjs/locale/ru"; // Импортируем русскую локаль
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { Badge } from "@heroui/react";
import { useDraft } from "@/hooks/useDraft";

// Подключаем плагины для работы с таймзонами
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("ru"); // Устанавливаем русскую локаль
dayjs.tz.setDefault("Europe/Moscow"); // Устанавливаем московскую таймзону по умолчанию

// Создаем функцию для сдвига времени на -3 часа
const shiftTimeBy3Hours = (date: string | Date) => {
  return dayjs(date).subtract(3, 'hour').toDate();
};

// Создаем функцию для сдвига времени на +3 часа
const shiftTimeBy3HoursForward = (date: string | Date) => {
  return dayjs(date).add(3, 'hour').toDate();
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
  // Добавляем статистику по Bybit
  totalBybitTransactions?: number;
  matchedBybitTransactions?: number;
  unmatchedBybitTransactions?: number;
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

// Добавим интерфейс для записей сопоставлений Bybit с IDEX
interface BybitMatchRecord {
  id: number;
  bybitTransaction: {
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

// Функция для проверки типа записи сопоставления Bybit
const isBybitMatchRecord = (item: any): item is BybitMatchRecord => {
  return item && 
    typeof item.id === 'number' && 
    item.bybitTransaction && 
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
  const [activeTab, setActiveTab] = useState("all"); // "all", "byUser", "unmatchedIdex", "unmatchedUser", "userStats", "bybit", "bybitMatches", "bybitMatching"
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
  const [selectedBybitTransaction, setSelectedBybitTransaction] = useState<number | null>(null);
  
  // Selected user for unmatched transactions view
  const [selectedUnmatchedUserId, setSelectedUnmatchedUserId] = useState<number | null>(null);

  // Состояния для модального окна сопоставления
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [isDeleteByFilterOpen, setIsDeleteByFilterOpen] = useState(false);
  const [matchModalStartDate, setMatchModalStartDate] = useState(
startDate
  );
  const [matchModalEndDate, setMatchModalEndDate] = useState(
 endDate
  );

  const [matchForAll, setMatchForAll] = useState(true);

  const [selectedUserIds, setSelectedUserIds] = useState<SelectedUsers>({});
  const [selectedCabinetIds, setSelectedCabinetIds] = useState<SelectedCabinets>({});

  // State for selected cabinets in the main view
  const [selectedViewCabinetIds, setSelectedViewCabinetIds] = useState<SelectedCabinets>({});
  const [isCabinetSelectorOpen, setIsCabinetSelectorOpen] = useState(false);

  const [selectedUsersForDeleteMatchIds, setSelectedUsersForDeleteMatchIds] = useState<number[]>([]);

  // Add these new state variables at the beginning of your component
  const [selectedIdexCabinetIds, setSelectedIdexCabinetIds] = useState<Record<number, boolean>>({});
  const [idexSearchQuery, setIdexSearchQuery] = useState("");

  // Add these new interfaces at the top of your component
  interface CabinetConfig {
    cabinetId: number;
    startDate: string;
    endDate: string;
  }

  // Add these new state variables in your component
  const [cabinetConfigs, setCabinetConfigs] = useState<CabinetConfig[]>([]);

  // Загрузка дат из localStorage
  useLayoutEffect(() => {
    if (typeof localStorage !== 'undefined') {
      const savedStartDate = localStorage.getItem('matchStartDate');
      const savedEndDate = localStorage.getItem('matchEndDate');
      const savedModalStartDate = localStorage.getItem('matchModalStartDate');
      const savedModalEndDate = localStorage.getItem('matchModalEndDate');
      
      if (savedStartDate) {
        setStartDate(savedStartDate);
      }
      
      if (savedEndDate) {
        setEndDate(savedEndDate);
      }
      
      if (savedModalStartDate) {
        setMatchModalStartDate(savedModalStartDate);
      }
      
      if (savedModalEndDate) {
        setMatchModalEndDate(savedModalEndDate);
      }
    }
  }, []);

  // Сохранение дат в localStorage при изменении
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('matchStartDate', startDate);
    }
  }, [startDate]);
  
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('matchEndDate', endDate);
    }
  }, [endDate]);
  
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('matchModalStartDate', matchModalStartDate);
    }
  }, [matchModalStartDate]);
  
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('matchModalEndDate', matchModalEndDate);
    }
  }, [matchModalEndDate]);



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
    searchQuery: idexSearchQuery,
    cabinetIds: Object.keys(selectedIdexCabinetIds).length > 0 ? 
      Object.keys(selectedIdexCabinetIds).map(id => parseInt(id)) : 
      undefined
  }, {
    refetchOnWindowFocus: false,
    enabled: activeTab === "unmatchedIdex" || activeTab === "unmatchedUser"
  });

  // Add this new query to get the cabinets with stats
  const {
    data: idexCabinetsData,
    isLoading: isLoadingIdexCabinets
  } = api.match.getUnmatchedTransactionsStats.useQuery({
    startDate,
    endDate,
    userId: activeTab === "unmatchedUser" ? selectedUnmatchedUserId : null,
    cabinetIds: Object.keys(selectedIdexCabinetIds).length > 0 ? 
      Object.keys(selectedIdexCabinetIds).map(id => parseInt(id)) : 
      undefined,
    searchQuery: idexSearchQuery
  }, {
    refetchOnWindowFocus: false,
    enabled: activeTab === "unmatchedIdex" || activeTab === "unmatchedUser"  // Добавляем вкладку "unmatchedUser"
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
  
  // Queries для данных Bybit транзакций
  const {
    data: bybitTransactionsData,
    isLoading: isLoadingBybitTransactions,
    refetch: refetchBybitTransactions
  } = api.match.getBybitTransactions.useQuery({
    userId: selectedUserId,
    startDate,
    endDate,
    page,
    pageSize,
    searchQuery,
    sortColumn: sortState.column || undefined,
    sortDirection: sortState.direction || undefined
  }, {
    refetchOnWindowFocus: false,
    enabled: activeTab === "bybit"
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

  // Add these helper functions for cabinet selection
  const toggleIdexCabinetSelection = (cabinetId: number) => {
    setSelectedIdexCabinetIds(prev => {
      const newState = { ...prev };
      if (newState[cabinetId]) {
        delete newState[cabinetId];
      } else {
        newState[cabinetId] = true;
      }
      return newState;
    });
    
    // Add timeout to update data after state change
    setTimeout(() => {
      refetchUnmatchedIdex();
    }, 100);
  };

  const clearIdexCabinetSelection = () => {
    setSelectedIdexCabinetIds({});
    setTimeout(() => {
      refetchUnmatchedIdex();
    }, 100);
  };
  

  const selectAllIdexCabinets = () => {
    if (!idexCabinetsData?.cabinets) return;
    
    const allCabinets: Record<number, boolean> = {};
    idexCabinetsData.cabinets.forEach(cabinet => {
      allCabinets[cabinet.id] = true;
    });
    
    setSelectedIdexCabinetIds(allCabinets);
    setTimeout(() => {
      refetchUnmatchedIdex();
    }, 100);
  };

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

  // Delete by filter mutation
  const deleteMatchesMutation = api.match.deleteByFilter.useMutation({
    onSuccess: () => {
      showAlert("Успешно", "Сопоставления успешно удалены", "success");
      // Refresh data in all tabs
      void refetchAllMatches();
      if (selectedUserId) void refetchUserMatches();
      void refetchUsersWithStats();
      void refetchUnmatchedIdex();
      void refetchUnmatchedUser();
      void refetchUnmatchedStats();
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при удалении сопоставлений: ${error.message}`, "danger");
    }
  });

  // Create manual match mutation
  const createManualMatchMutation = api.match.createManualMatch.useMutation({
    onSuccess: () => {
      showAlert("Успешно", "Транзакции успешно сопоставлены вручную", "success");
      // Reset selected transactions
      setSelectedIdexTransaction(null);
      setSelectedUserTransaction(null);
      setSelectedBybitTransaction(null);
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
    if (selectedIdexTransaction && selectedUserTransaction && selectedBybitTransaction) {
      createManualMatchMutation.mutate({
        idexTransactionId: selectedIdexTransaction,
        userTransactionId: selectedUserTransaction,
        bybitTransactionId: selectedBybitTransaction
      });
    } else {
      showAlert("Ошибка", "Необходимо выбрать обе транзакции для сопоставления", "danger");
    }
  }, [selectedIdexTransaction, selectedUserTransaction, selectedBybitTransaction, createManualMatchMutation]);

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
        <div className="flex flex-col bg-red-50 dark:bg-red-900/20 rounded-lg p-4 shadow-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Валовый расход</span>
            <DollarSign className="w-4 h-4 text-red-500" />
          </div>
          <div className="flex items-center">
            <span className="text-xl font-bold text-red-600 dark:text-red-400">
              {formatNumber(stats.grossExpense)}
            </span>
            <span className="text-xs ml-1 text-gray-500">USDT</span>
          </div>
        </div>
        
        <div className="flex flex-col bg-green-50 dark:bg-green-900/20 rounded-lg p-4 shadow-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Валовый доход</span>
            <DollarSign className="w-4 h-4 text-green-500" />
          </div>
          <div className="flex items-center">
            <span className="text-xl font-bold text-green-600 dark:text-green-400">
              {formatNumber(stats.grossIncome)}
            </span>
            <span className="text-xs ml-1 text-gray-500">USDT</span>
          </div>
        </div>
        
        <div className="flex flex-col bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 shadow-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Валовая прибыль</span>
            <ArrowUpDown className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center">
              <span className={`text-xl font-bold ${stats.grossProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatNumber(stats.grossProfit)}
              </span>
              <span className="text-xs ml-1 text-gray-500">USDT</span>
            </div>
            <span className={`text-xs ${stats.profitPercentage >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              ({formatNumber(stats.profitPercentage)}%)
            </span>
          </div>
        </div>
        
        <div className="flex flex-col bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 shadow-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Спред на ордер</span>
            <CircleDollarSign className="w-4 h-4 text-purple-500" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center">
              <span className="text-xl font-bold text-purple-600 dark:text-purple-400">{stats.matchedCount}</span>
              <span className="text-xs ml-1 text-gray-500">ордеров</span>
            </div>
            <div className="flex flex-col mt-1 text-xs">
              <span className={`${stats.profitPerOrder >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                Ср. спред: {formatNumber(stats.profitPerOrder)} USDT
              </span>
              <span className="text-gray-500">
                Ср. расход: {formatNumber(stats.expensePerOrder)} USDT
              </span>
            </div>
          </div>
        </div>
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
    
    const totalBybitTransactions = stats.totalBybitTransactions || 0;
    const matchedBybitTransactions = stats.matchedBybitTransactions || 0;
    const unmatchedBybitTransactions = stats.unmatchedBybitTransactions || 0;
    
    return (

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 shadow-sm">
              <div className="flex items-center mb-1">
                <Database className="w-4 h-4 text-blue-500 dark:text-blue-400 mr-2" />
                <h4 className="font-medium text-sm">Телеграмм транзакции</h4>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">Всего:</p>
                  <p className="text-lg font-bold">{totalTransactions}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">Сопоставлено:</p>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">{matchedTransactions}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">Не сопоставлено:</p>
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{unmatchedTransactions}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 shadow-sm">
              <div className="flex items-center mb-1">
                <BarChart2 className="w-4 h-4 text-purple-500 dark:text-purple-400 mr-2" />
                <h4 className="font-medium text-sm">IDEX транзакции</h4>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {/* Левая колонка со статистикой */}
                <div className="grid grid-cols-1 gap-1.5">
                  <div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">Всего IDEX:</p>
                    <p className="text-lg font-bold">{totalIdexTransactions}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">Сопоставлено IDEX:</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">{matchedIdexTransactions}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">Не сопоставлено IDEX:</p>
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">{unmatchedIdexTransactions}</p>
                  </div>
                </div>
                
                {/* Правая колонка со списком кабинетов */}
                <div className="border-l border-zinc-200 dark:border-zinc-700 pl-3">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Фильтр по кабинетам:</p>
                    <div className="flex gap-1">
                      <Button 
                        size="xs" 
                        variant="flat" 
                        color="primary"
                        onClick={selectAllCabinets}
                      >
                        Все
                      </Button>
                      <Button 
                        size="xs" 
                        variant="flat" 
                        color="danger"
                        onClick={clearCabinetSelection}
                      >
                        Сброс
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-36 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-600">
                    {cabinetStatsData && cabinetsData?.cabinets ? (
                      <div className="space-y-1">
                        {getSortedCabinets().map(cabinet => {
                          const cabinetStats = cabinetStatsData.cabinetStats[cabinet.id] || { matchCount: 0, totalCount: 0 };
                          const isSelected = !!selectedViewCabinetIds[cabinet.id];
                          
                          return (
                            <div 
                              key={cabinet.id}
                              className={`flex items-center justify-between rounded-md p-1 cursor-pointer transition-colors ${
                                isSelected ? 'bg-blue-100 dark:bg-blue-900/40' : 
                                cabinetStats.matchCount > 0 ? 'bg-green-100 dark:bg-green-900/30' : 
                                'bg-white dark:bg-zinc-800'
                              }`}
                              onClick={() => toggleViewCabinetSelection(cabinet.id)}
                            >
                              <div className="flex items-center">
                                <Checkbox 
                                  isSelected={isSelected}
                                  onChange={() => toggleViewCabinetSelection(cabinet.id)} 
                                  className="mr-1"
                                />
                                <span className="text-xs font-medium">ID {cabinet.idexId}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-xs bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 px-1 py-0.5 rounded">
                                  {cabinetStats.matchCount}/{cabinetStats.totalCount || 0}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Загрузка кабинетов...</p>
                    )}
                  </div>
                  {Object.keys(selectedViewCabinetIds).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.keys(selectedViewCabinetIds).map(id => {
                        const cabinet = cabinetsData?.cabinets.find(c => c.id === parseInt(id));
                        return cabinet ? (
                          <Badge 
                            key={id} 
                            color="primary" 
                            variant="flat"
                            className="cursor-pointer text-xs"
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
            
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 shadow-sm">
              <div className="flex items-center mb-1">
                <Database className="w-4 h-4 text-orange-500 dark:text-orange-400 mr-2" />
                <h4 className="font-medium text-sm">Bybit транзакции</h4>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">Всего:</p>
                  <p className="text-lg font-bold">{totalBybitTransactions}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">Сопоставлено:</p>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">{matchedBybitTransactions}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">Не сопоставлено:</p>
                  <p className="text-lg font-bold text-red-600 dark:text-red-400">{unmatchedBybitTransactions}</p>
                </div>
              </div>
            </div>
          </div>

    );
  };

  const [deleteStartDate, setDeleteStartDate] = useState(startDate);
  const [deleteEndDate, setDeleteEndDate] = useState(endDate);

  // Function to handle opening the match modal
  const handleOpenMatchModal = () => {
    setMatchModalStartDate(startDate);
    setMatchModalEndDate(endDate);
    setMatchForAll(true);
    setSelectedUserIds({});
    setSelectedCabinetIds({});
    setIsMatchModalOpen(true);
  };

  const handleOpenDeleteByFilterModal = () => {
    setDeleteStartDate(startDate);
    setDeleteEndDate(endDate);
    setIsDeleteByFilterOpen(true);
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
        
        // Also remove from cabinetConfigs
        setCabinetConfigs(prev => prev.filter(config => config.cabinetId !== cabinetId));
      } else {
        newState[cabinetId] = true;
        
        // Add to cabinetConfigs with default dates from the global range
        setCabinetConfigs(prev => [
          ...prev,
          {
            cabinetId,
            startDate: matchModalStartDate,
            endDate: matchModalEndDate
          }
        ]);
      }
      return newState;
    });
  };
  

  // Start matching process with selected parameters
  const handleStartMatching = () => {
    setIsRunningMatch(true);
    
    // Convert selected users objects to arrays of IDs
    const userIds = matchForAll ? [] : Object.keys(selectedUserIds).map(id => parseInt(id));
    
    // Get selected cabinet IDs
    const selectedCabinetIdsArray = Object.keys(selectedCabinetIds).map(id => parseInt(id));
    
    // Extract cabinet configurations for selected cabinets
    const filteredCabinetConfigs = cabinetConfigs.filter(
      config => selectedCabinetIds[config.cabinetId]
    );
    
    // Call the mutation with selected parameters
    matchTransactionsMutation.mutate({
      startDate: matchModalStartDate,
      endDate: matchModalEndDate,
      approvedOnly: true,
      userIds: userIds.length > 0 ? userIds : undefined,
      cabinetIds: selectedCabinetIdsArray,  // Include cabinetIds for backward compatibility
      cabinetConfigs: filteredCabinetConfigs.length > 0 ? filteredCabinetConfigs : undefined
    });
  };

  const [isDeletingMatches, setIsDeletingMatches] = useState(false);

  function handleDeleteMatches(): void {
    setIsDeletingMatches(true);
    
    // Call the mutation with selected parameters
    deleteMatchesMutation.mutate({
      startDate: deleteStartDate,
      endDate: deleteEndDate,

      userIds: selectedUsersForDeleteMatchIds,

    });

    setIsDeletingMatches(false);
  }

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
        <Tabs 
        selectedKey={activeTab} 
        onSelectionChange={(key) => setActiveTab(key as string)}
        className=" "
      >
        <Tab key="all" title={
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            <span>Все Сопоставления</span>
          </div>
        } />
        <Tab key="byUser" title={
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span>Сопоставления пользователя</span>
          </div>
        } />
        <Tab key="unmatchedIdex" title={
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>Несопоставленные IDEX</span>
          </div>
        } />
        <Tab key="unmatchedUser" title={
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>Ручное сопоставление</span>
          </div>
        } />
        <Tab key="userStats" title={
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4" />
            <span>Статистика по пользователям</span>
          </div>
        } />
      </Tabs>
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

              onClick={createManualMatch}
              disabled={!selectedIdexTransaction || !selectedUserTransaction || !selectedBybitTransaction}
            >
              Создать сопоставление
            </Button>
          )}
          <Button
            color="danger"
            onClick={handleOpenDeleteByFilterModal}
            isLoading={isRunningMatch}
            
          >
            Удалить по фильтрам
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
                    <div className="p-3 bg-zinc-100 dark:bg-zinc-800/20 rounded">
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
                              return tx ? `Дата: ${dayjs(shiftTimeBy3Hours(tx.dateTime)).format(DATE_FORMAT)}` : '';
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
                    <p className="text-zinc-500 dark:text-zinc-400">Выберите транзакцию кошелька из таблицы ниже</p>
                  )}
                </div>
                <div>
                  <h3 className="text-md font-medium mb-2">Выбранная IDEX транзакция</h3>
                  {selectedIdexTransaction ? (
                    <div className="p-3 bg-zinc-100 dark:bg-zinc-800/20 rounded">
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
                              return tx?.approvedAt ? `Дата: ${dayjs(shiftTimeBy3Hours(tx.approvedAt)).format(DATE_FORMAT)}` : '';
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
                    <p className="text-zinc-500 dark:text-zinc-400">Выберите IDEX транзакцию из таблицы ниже</p>
                  )}
                </div>
                <div>
                  <h3 className="text-md font-medium mb-2">Выбранная Bybit транзакция</h3>
                  {selectedBybitTransaction ? (
                    <div className="p-3 bg-zinc-100 dark:bg-zinc-800/20 rounded">
                      <p>ID: {selectedBybitTransaction}</p>
                      {unmatchedIdexData?.transactions && (
                        <>
                          <p>
                            {(() => {
                              const tx = unmatchedIdexData.transactions.find(t => t.id === selectedBybitTransaction);
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
                              const tx = unmatchedIdexData.transactions.find(t => t.id === selectedBybitTransaction);
                              return tx?.approvedAt ? `Дата: ${dayjs(shiftTimeBy3Hours(tx.approvedAt)).format(DATE_FORMAT)}` : '';
                            })()}
                          </p>
                        </>
                      )}
                      <Button 
                        size="sm" 
                        color="danger" 
                        variant="flat" 
                        className="mt-2"
                        onClick={() => setSelectedBybitTransaction(null)}
                      >
                        Отменить выбор
                      </Button>
                    </div>
                  ) : (
                    <p className="text-zinc-500 dark:text-zinc-400">Выберите Bybit транзакцию из таблицы ниже</p>
                  )}
                </div>
              </div>
              {selectedIdexTransaction && selectedUserTransaction && selectedBybitTransaction && (
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
                          <TableColumn>{renderSortableHeader("user.name", "Пользователь")}</TableColumn>
                          <TableColumn>{renderSortableHeader("dateTime", "Дата")}</TableColumn>
                          <TableColumn>{renderSortableHeader("totalPrice", "Сумма")}</TableColumn>
                          <TableColumn>{renderSortableHeader("type", "Тип")}</TableColumn>
                          <TableColumn>Действия</TableColumn>
                        </TableHeader>
                        <TableBody>
                          {unmatchedUserData.transactions.map((transaction) => (
                            <TableRow 
                              key={transaction.id}
                              className={selectedUserTransaction === transaction.id ? "bg-blue-100 dark:bg-blue-900/20 rounded-md" : ""}
                            >
                              <TableCell>{transaction.id}</TableCell>
                              <TableCell>{transaction.user?.name || '-'}</TableCell>
                              <TableCell>{dayjs(shiftTimeBy3Hours(transaction.dateTime)).format(DATE_FORMAT)}</TableCell>
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
    {/* Добавляем поиск и фильтры по кабинетам */}
    <div className="mb-4 grid grid-cols-1 gap-4">
      <div>
        <label className="block text-sm font-medium mb-2">Поиск транзакций</label>
        <div className="flex gap-2">
          <Input
            placeholder="Поиск по ID, кошельку..."
            value={idexSearchQuery}
            onChange={(e) => setIdexSearchQuery(e.target.value)}
            startContent={<Search className="w-4 h-4 text-gray-500" />}
            aria-label="Поиск по IDEX транзакциям"
          />
          <Button
            color="primary"
            variant="flat"
            onClick={() => refetchUnmatchedIdex()}
            aria-label="Применить фильтры"
          >
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">Фильтр по кабинетам IDEX</label>
        <div className="flex flex-wrap gap-2 mb-2">
          <Button 
            size="sm" 
            variant="flat" 
            color="primary"
            onClick={selectAllIdexCabinets}
          >
            Все кабинеты
          </Button>
          <Button 
            size="sm" 
            variant="flat" 
            color="danger"
            onClick={clearIdexCabinetSelection}
          >
            Сбросить
          </Button>
        </div>
        
        {isLoadingIdexCabinets ? (
          <div className="text-center">
            <Spinner size="sm" />
          </div>
        ) : (
          <div className="max-h-32 overflow-y-auto  rounded p-2">
            {idexCabinetsData?.cabinets && idexCabinetsData.cabinets.length > 0 ? (
              idexCabinetsData.cabinets.map(cabinet => (
                <div 
                  key={cabinet.id}
                  className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-100 dark:hover:bg-gray-900/20 cursor-pointer"
                  onClick={() => toggleIdexCabinetSelection(cabinet.id)}
                >
                  <div className="flex items-center">
                    <Checkbox 
                      isSelected={!!selectedIdexCabinetIds[cabinet.id]}
                      onChange={() => toggleIdexCabinetSelection(cabinet.id)}
                      aria-label={`Выбрать кабинет ${cabinet.idexId}`}
                    />
                    <span className="ml-2">
                      ID: {cabinet.idexId} {cabinet.login && `(${cabinet.login})`}
                    </span>
                  </div>
                  <Badge size="sm" variant="flat">
                    {cabinet.transactionCount} транз.
                  </Badge>
                </div>
              ))
            ) : (
              <div className="text-center text-zinc-500 py-4">
                Нет доступных кабинетов
              </div>
            )}
          </div>
        )}
        
        {Object.keys(selectedIdexCabinetIds).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {Object.keys(selectedIdexCabinetIds).map(id => {
              const cabinet = idexCabinetsData?.cabinets.find(c => c.id === parseInt(id));
              return cabinet ? (
                <Badge 
                  key={id} 
                  color="primary" 
                  variant="flat"
                  className="cursor-pointer"
                  onClick={() => toggleIdexCabinetSelection(parseInt(id))}
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
              <TableColumn>{renderSortableHeader("cabinet.idexId", "ID IDEX кабинета")}</TableColumn>
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
                    className={selectedIdexTransaction === transaction.id ? "bg-blue-100 dark:bg-blue-900/20 rounded-md" : ""}
                  >
                    <TableCell>{transaction.id}</TableCell>
                    <TableCell>{transaction.externalId.toString()}</TableCell>
                    <TableCell>{transaction.cabinet.idexId}</TableCell>
                    <TableCell>{transaction.approvedAt ? dayjs(transaction.approvedAt).subtract(3, 'hour').format(DATE_FORMAT) : '-'}</TableCell>
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

{activeTab === "unmatchedIdex" && (
  <Card className="mb-6">
    <CardBody>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Поиск транзакций</label>
          <div className="flex gap-2">
            <Input
              placeholder="Поиск по ID, кошельку..."
              value={idexSearchQuery}
              onChange={(e) => setIdexSearchQuery(e.target.value)}
              startContent={<Search className="w-4 h-4 text-gray-500" />}
              aria-label="Поиск по IDEX транзакциям"
            />
            <Button
              color="primary"
              variant="flat"
              onClick={() => refetchUnmatchedIdex()}
              aria-label="Применить фильтры"
            >
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Фильтр по кабинетам IDEX</label>
          <div className="flex flex-wrap gap-2 mb-2">
            <Button 
              size="sm" 
              variant="flat" 
              color="primary"
              onClick={selectAllIdexCabinets}
            >
              Все кабинеты
            </Button>
            <Button 
              size="sm" 
              variant="flat" 
              color="danger"
              onClick={clearIdexCabinetSelection}
            >
              Сбросить
            </Button>
          </div>
          
          {isLoadingIdexCabinets ? (
            <div className="text-center">
              <Spinner size="sm" />
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto  rounded p-2">
              {idexCabinetsData?.cabinets && idexCabinetsData.cabinets.length > 0 ? (
                idexCabinetsData.cabinets.map(cabinet => (
                  <div 
                    key={cabinet.id}
                    className="flex items-center justify-between py-1 px-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                    onClick={() => toggleIdexCabinetSelection(cabinet.id)}
                  >
                    <div className="flex items-center">
                      <Checkbox 
                        isSelected={!!selectedIdexCabinetIds[cabinet.id]}
                        onChange={() => toggleIdexCabinetSelection(cabinet.id)}
                        aria-label={`Выбрать кабинет ${cabinet.idexId}`}
                      />
                      <span className="ml-2">
                        ID: {cabinet.idexId} {cabinet.login && `(${cabinet.login})`}
                      </span>
                    </div>
                    <Badge size="sm" variant="flat">
                      {cabinet.transactionCount} транз.
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center text-zinc-500 py-4">
                  Нет доступных кабинетов
                </div>
              )}
            </div>
          )}
          
          {Object.keys(selectedIdexCabinetIds).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.keys(selectedIdexCabinetIds).map(id => {
                const cabinet = idexCabinetsData?.cabinets.find(c => c.id === parseInt(id));
                return cabinet ? (
                  <Badge 
                    key={id} 
                    color="primary" 
                    variant="flat"
                    className="cursor-pointer"
                    onClick={() => toggleIdexCabinetSelection(parseInt(id))}
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
    </CardBody>
  </Card>
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
                            <TableCell>{transaction.approvedAt ? dayjs(transaction.approvedAt).subtract(3, 'hour').format(DATE_FORMAT) : '-'}</TableCell>
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
                  <div className="mb-4">
  <Card className="bg-gray-50 dark:bg-zinc-800/50 shadow-sm">
    <CardBody className="py-3">
      <h3 className="text-md font-semibold mb-2">Общая статистика за период</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Телеграм транзакции:</p>
          <div className="flex justify-between items-center">
            <span className="text-sm">Всего:</span>
            <span className="font-medium">{usersWithStatsData.totalStats.totalTelegramTransactions}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Сопоставлено:</span>
            <span className="font-medium text-green-600 dark:text-green-400">{usersWithStatsData.totalStats.matchedTelegramTransactions}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Не сопоставлено:</span>
            <span className="font-medium text-red-600 dark:text-red-400">{usersWithStatsData.totalStats.unmatchedTelegramTransactions}</span>
          </div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">IDEX транзакции:</p>
          <div className="flex justify-between items-center">
            <span className="text-sm">Всего:</span>
            <span className="font-medium">{usersWithStatsData.totalStats.totalIdexTransactions}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Сопоставлено:</span>
            <span className="font-medium text-green-600 dark:text-green-400">{usersWithStatsData.totalStats.matchedIdexTransactions}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Не сопоставлено:</span>
            <span className="font-medium text-red-600 dark:text-red-400">{usersWithStatsData.totalStats.unmatchedIdexTransactions}</span>
          </div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Финансовые показатели:</p>
          <div className="flex justify-between items-center">
            <span className="text-sm">Валовый расход:</span>
            <span className="font-medium">{formatNumber(usersWithStatsData.totalStats.grossExpense)} USDT</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Валовый доход:</span>
            <span className="font-medium">{formatNumber(usersWithStatsData.totalStats.grossIncome)} USDT</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Валовая прибыль:</span>
            <span className={`font-medium ${usersWithStatsData.totalStats.grossProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatNumber(usersWithStatsData.totalStats.grossProfit)} USDT 
              <span className="text-xs ml-1">({formatNumber(usersWithStatsData.totalStats.profitPercentage)}%)</span>
            </span>
          </div>
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
                          className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800"
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

      {/* Modal for deleting matches by filter */}
      <Modal
        isOpen={isDeleteByFilterOpen}
        onClose={() => setIsDeleteByFilterOpen(false)}
        aria-label="Модальное окно удаления сопоставлений"
      >
        <ModalContent>
          <ModalHeader>
            <h3 className="text-lg font-medium">Удаление сопоставлений</h3>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Дата и время начала</label>
                  <Input
                    type="datetime-local"
                    value={deleteStartDate}
                    onChange={(e) => setDeleteStartDate(e.target.value)}
                    startContent={<Calendar className="w-4 h-4 text-gray-500" />}
                    aria-label="Дата и время начала"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Дата и время окончания</label>
                  <Input
                    type="datetime-local"
                    value={deleteEndDate}
                    onChange={(e) => setDeleteEndDate(e.target.value)}
                    startContent={<Calendar className="w-4 h-4 text-gray-500" />}
                    aria-label="Дата и время окончания"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Выберите пользователей</label>
                <div className="max-h-60 overflow-y-auto border rounded-md p-2">
                  {usersData?.users.map(user => (
                    <div key={user.id} className="flex items-center py-1">
                      <Checkbox
                        id={`user-${user.id}`}
                        checked={selectedUsersForDeleteMatchIds.includes(user.id)}
                        onChange={() => {
                          setSelectedUsersForDeleteMatchIds(prev => 
                            prev.includes(user.id) 
                                ? prev.filter(id => id !== user.id)
                              : [...prev, user.id]
                          );
                        }}
                        aria-label={`Выбрать пользователя ${user.id}`}
                      />
                      <label htmlFor={`user-${user.id}`} className="ml-2">
                        {user.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              color="danger"
              onClick={handleDeleteMatches}
              isLoading={isDeletingMatches}
              aria-label="Удалить сопоставления"
            >
              Удалить
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Modal for matching with filters */}
{/* Modal for matching with filters */}
<Modal
  isOpen={isMatchModalOpen}
  onClose={handleCloseMatchModal}
  aria-label="Модальное окно сопоставления"
  size="3xl"
>
  <ModalContent>
    <ModalHeader>
      <h3 className="text-lg font-medium">Сопоставление с фильтрами</h3>
    </ModalHeader>
    <ModalBody>
      <div className="grid grid-cols-1 gap-4">
        {/* Global date range & users */}
        <Card>
          <CardBody>
            <h4 className="text-md font-medium mb-2">Общие настройки</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Глобальная дата начала</label>
                <Input
                  type="datetime-local"
                  value={matchModalStartDate}
                  onChange={(e) => {
                    setMatchModalStartDate(e.target.value);
                    // Update any cabinet configs that use the global date
                    setCabinetConfigs(prev => 
                      prev.map(config => ({
                        ...config,
                        startDate: e.target.value
                      }))
                    );
                  }}
                  startContent={<Calendar className="w-4 h-4 text-gray-500" />}
                  aria-label="Дата и время начала"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Глобальная дата окончания</label>
                <Input
                  type="datetime-local"
                  value={matchModalEndDate}
                  onChange={(e) => {
                    setMatchModalEndDate(e.target.value);
                    // Update any cabinet configs that use the global date
                    setCabinetConfigs(prev => 
                      prev.map(config => ({
                        ...config,
                        endDate: e.target.value
                      }))
                    );
                  }}
                  startContent={<Calendar className="w-4 h-4 text-gray-500" />}
                  aria-label="Дата и время окончания"
                />
              </div>
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">Пользователи</label>
              <div className="border rounded p-2 max-h-44 overflow-y-auto">
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
          </CardBody>
        </Card>
        
        {/* Cabinets with per-cabinet date ranges */}
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-md font-medium">Настройки по кабинетам IDEX</h4>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  color="primary" 
                  variant="flat"
                  onClick={() => {
                    // Select all cabinets
                    if (!cabinetsData?.cabinets) return;
                    
                    const allCabinets: SelectedCabinets = {};
                    const newConfigs: CabinetConfig[] = [];
                    
                    cabinetsData.cabinets.forEach(cabinet => {
                      allCabinets[cabinet.id] = true;
                      
                      // Check if we already have a config for this cabinet
                      const existingConfig = cabinetConfigs.find(c => c.cabinetId === cabinet.id);
                      if (!existingConfig) {
                        newConfigs.push({
                          cabinetId: cabinet.id,
                          startDate: matchModalStartDate,
                          endDate: matchModalEndDate
                        });
                      }
                    });
                    
                    setSelectedCabinetIds(allCabinets);
                    setCabinetConfigs([...cabinetConfigs, ...newConfigs]);
                  }}
                >
                  Выбрать все
                </Button>
                <Button 
                  size="sm" 
                  color="danger" 
                  variant="flat"
                  onClick={() => {
                    setSelectedCabinetIds({});
                    setCabinetConfigs([]);
                  }}
                >
                  Сбросить все
                </Button>
              </div>
            </div>
            
            <div className="border rounded p-2 max-h-96 overflow-y-auto">
              {cabinetsData?.cabinets ? (
                <>
                  {getSortedCabinets().map((cabinet) => {
                    const isSelected = !!selectedCabinetIds[cabinet.id];
                    const config = cabinetConfigs.find(c => c.cabinetId === cabinet.id);
                    
                    return (
                      <div key={`cabinet-${cabinet.id}`} className="mb-3 pb-2 border-b last:border-b-0">
                        <div className="flex items-center justify-between">
                          <Checkbox
                            isSelected={isSelected}
                            onChange={() => toggleCabinetSelection(cabinet.id)}
                          >
                            <span className="font-medium">ID: {cabinet.idexId}</span>
                            {cabinet.login && <span className="ml-2 text-gray-500">({cabinet.login})</span>}
                          </Checkbox>
                          
                          {isSelected && (
                            <Badge color="primary" variant="flat">
                              Индивидуальные даты
                            </Badge>
                          )}
                        </div>
                        
                        {isSelected && (
                          <div className="ml-6 mt-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs font-medium mb-1">Дата начала:</label>
                                <Input
                                  type="datetime-local"
                                  size="sm"
                                  value={config?.startDate || matchModalStartDate}
                                  onChange={(e) => {
                                    setCabinetConfigs(prev => prev.map(c => 
                                      c.cabinetId === cabinet.id 
                                        ? {...c, startDate: e.target.value} 
                                        : c
                                    ));
                                  }}
                                  aria-label={`Дата начала для кабинета ${cabinet.idexId}`}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium mb-1">Дата окончания:</label>
                                <Input
                                  type="datetime-local"
                                  size="sm"
                                  value={config?.endDate || matchModalEndDate}
                                  onChange={(e) => {
                                    setCabinetConfigs(prev => prev.map(c => 
                                      c.cabinetId === cabinet.id 
                                        ? {...c, endDate: e.target.value} 
                                        : c
                                    ));
                                  }}
                                  aria-label={`Дата окончания для кабинета ${cabinet.idexId}`}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="text-sm text-gray-500 p-4 text-center">Загрузка кабинетов...</div>
              )}
            </div>
            
            {/* Selected cabinet summary */}
            {Object.keys(selectedCabinetIds).length > 0 && (
              <div className="mt-3">
                <h5 className="text-sm font-medium mb-2">Выбрано кабинетов: {Object.keys(selectedCabinetIds).length}</h5>
                <div className="flex flex-wrap gap-1">
                  {Object.keys(selectedCabinetIds).map(id => {
                    const cabinet = cabinetsData?.cabinets.find(c => c.id === parseInt(id));
                    return cabinet ? (
                      <Badge 
                        key={id} 
                        color="primary" 
                        variant="flat"
                        className="cursor-pointer"
                        onClick={() => toggleCabinetSelection(parseInt(id))}
                      >
                        ID {cabinet.idexId}
                        <span className="ml-1 text-xs">×</span>
                      </Badge>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </ModalBody>
    <ModalFooter>
      <Button
        color="primary"
        isLoading={isRunningMatch}
        onClick={handleStartMatching}
        disabled={Object.keys(selectedCabinetIds).length === 0}
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