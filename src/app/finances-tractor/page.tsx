"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { 
  Card, 
  CardBody, 
  CardHeader,
  CardFooter
} from "@heroui/card";
import { 
  Table, 
  TableHeader, 
  TableColumn, 
  TableBody, 
  TableRow, 
  TableCell 
} from "@heroui/table";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { 
  Modal, 
  ModalContent, 
  ModalBody, 
  ModalFooter, 
  ModalHeader 
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Pagination } from "@heroui/pagination";
import { Spinner } from "@heroui/spinner";
import { Alert } from "@heroui/alert";
import { Textarea } from "@heroui/input";
import { Badge } from "@heroui/badge";
import { Tabs, Tab } from "@heroui/tabs";
import { 
  Calendar, 
  User, 
  Plus, 
  CheckCircle, 
  AlertCircle, 
  Loader,
  Edit,
  Trash,
  Search,
  DollarSign,
  FileText,
  BarChart,
  X
} from "lucide-react";
import dayjs from "dayjs";
import "dayjs/locale/ru"; // Импортируем русскую локаль
import localeData from "dayjs/plugin/localeData";

// Подключаем плагины
dayjs.extend(localeData);
dayjs.locale("ru"); // Устанавливаем русскую локаль

// Типы валют
type Currency = "RUB" | "USDT";

// Периоды на русском
const periodOptions = [
  { key: "daily", label: "Ежедневно" },
  { key: "weekly", label: "Еженедельно" },
  { key: "monthly", label: "Ежемесячно" },
  { key: "quarterly", label: "Ежеквартально" },
  { key: "yearly", label: "Ежегодно" }
];

// Тип для выплаты сотруднику
type EmployeePayment = {
  employeeId: string;
  amount: string;
  currency: Currency;
};

export default function FinancePage() {
  // Состояния для вкладок и пагинации
  const [activeTab, setActiveTab] = useState("income");
  const [currentPageIncome, setCurrentPageIncome] = useState(1);
  const [currentPageExpenses, setCurrentPageExpenses] = useState(1);
  
  // Состояния для модальных окон
  const [isFinRowDialogOpen, setIsFinRowDialogOpen] = useState(false);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [editingFinRowId, setEditingFinRowId] = useState(null);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  
  // Состояния для фильтров
  const [finRowFilters, setFinRowFilters] = useState({
    startDate: null,
    endDate: null,
    shift: null,
    employeeId: null,
    currency: null as Currency | null,
  });
  
  const [fixedExpensesFilters, setFixedExpensesFilters] = useState({
    startDate: null,
    endDate: null,
    currency: null as Currency | null,
  });
  
  const [variableExpensesFilters, setVariableExpensesFilters] = useState({
    startDate: null,
    endDate: null,
    currency: null as Currency | null,
  });
  
  const [reportFilters, setReportFilters] = useState({
    startDate: dayjs().startOf('month').format("YYYY-MM-DD"),
    endDate: dayjs().format("YYYY-MM-DD"),
    includeFixed: true,
    includeVariable: true,
    includeSalary: true,
  });
  
  // Состояния для форм
  const [finRowForm, setFinRowForm] = useState({
    date: dayjs().format("YYYY-MM-DD"),
    time: dayjs().format("HH:mm"),
    shift: "morning",
    startBalanceRUB: "",
    startBalanceUSDT: "",
    endBalanceRUB: "",
    endBalanceUSDT: "",
    employeePayments: [] as EmployeePayment[],
    comment: ""
  });
  
  const [expenseForm, setExpenseForm] = useState({
    finRowId: null,
    expenseType: "variable",
    amountRUB: "",
    amountUSDT: "",
    date: dayjs().format("YYYY-MM-DD"),
    time: dayjs().format("HH:mm"),
    period: "",
    description: ""
  });
  
  // Состояния для валидации
  const [finRowErrors, setFinRowErrors] = useState({});
  const [expenseErrors, setExpenseErrors] = useState({});
  
  // Состояние для уведомлений
  const [alert, setAlert] = useState({
    isVisible: false,
    title: "",
    description: "",
    color: "default"
  });

  const pageSize = 10;

  // Показать уведомление
  const showAlert = (title, description, color) => {
    setAlert({
      isVisible: true,
      title,
      description,
      color
    });
    
    // Автоматически скрыть через 5 секунд
    setTimeout(() => {
      setAlert(prev => ({ ...prev, isVisible: false }));
    }, 5000);
  };

  // API запросы с фильтрами
  const finRowsQuery = api.shiftReports.getAllShiftReports.useQuery({
    page: currentPageIncome,
    pageSize,
    startDate: finRowFilters.startDate ? new Date(finRowFilters.startDate) : undefined,
    endDate: finRowFilters.endDate ? new Date(finRowFilters.endDate) : undefined,
    shift: finRowFilters.shift || undefined,
    employeeId: finRowFilters.employeeId || undefined,
    currency: finRowFilters.currency || undefined,
  });

  const fixedExpensesQuery = api.shiftReports.getExpenses.useQuery({
    page: currentPageExpenses,
    pageSize,
    startDate: fixedExpensesFilters.startDate ? new Date(fixedExpensesFilters.startDate) : undefined,
    endDate: fixedExpensesFilters.endDate ? new Date(fixedExpensesFilters.endDate) : undefined,
    expenseType: "fixed",
    currency: fixedExpensesFilters.currency || undefined,
  });
  
  const variableExpensesQuery = api.shiftReports.getExpenses.useQuery({
    page: currentPageExpenses,
    pageSize,
    startDate: variableExpensesFilters.startDate ? new Date(variableExpensesFilters.startDate) : undefined,
    endDate: variableExpensesFilters.endDate ? new Date(variableExpensesFilters.endDate) : undefined,
    expenseType: "variable",
    currency: variableExpensesFilters.currency || undefined,
  });

  const employeesQuery = api.salary.getAllEmployees.useQuery({ 
    page: 1, 
    pageSize: 100 
  });
  
  // Запрос зарплатных выплат использует теперь getAllPayments
  const salaryPaymentsRUBQuery = api.salary.getAllPayments.useQuery({
    page: 1,
    pageSize: 100,
    startDate: reportFilters.startDate ? new Date(reportFilters.startDate) : undefined,
    endDate: reportFilters.endDate ? new Date(reportFilters.endDate) : undefined,
    currency: "RUB"
  }, {
    enabled: reportFilters.includeSalary
  });
  
  const salaryPaymentsUSDTQuery = api.salary.getAllPayments.useQuery({
    page: 1,
    pageSize: 100,
    startDate: reportFilters.startDate ? new Date(reportFilters.startDate) : undefined,
    endDate: reportFilters.endDate ? new Date(reportFilters.endDate) : undefined,
    currency: "USDT"
  }, {
    enabled: reportFilters.includeSalary
  });

  // Отдельные запросы для рублей и USDT
  const reportRUBQuery = api.shiftReports.getSummaryReport.useQuery({
    startDate: new Date(reportFilters.startDate),
    endDate: new Date(reportFilters.endDate),
    includeFixed: reportFilters.includeFixed,
    includeVariable: reportFilters.includeVariable,
    includeSalary: reportFilters.includeSalary,
    currency: "RUB",
  });
  
  const reportUSDTQuery = api.shiftReports.getSummaryReport.useQuery({
    startDate: new Date(reportFilters.startDate),
    endDate: new Date(reportFilters.endDate),
    includeFixed: reportFilters.includeFixed,
    includeVariable: reportFilters.includeVariable,
    includeSalary: reportFilters.includeSalary,
    currency: "USDT",
  });

  // Мутации для CRUD операций
  const createFinRowMutation = api.shiftReports.createFinRow.useMutation({
    onSuccess: (data) => {
      showAlert("Успешно", "Финансовая запись успешно создана", "success");
      setIsFinRowDialogOpen(false);
      resetFinRowForm();
      finRowsQuery.refetch();
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при создании записи: ${error.message}`, "danger");
    },
  });
  
  const updateFinRowMutation = api.shiftReports.updateFinRow.useMutation({
    onSuccess: (data) => {
      showAlert("Успешно", "Финансовая запись успешно обновлена", "success");
      setIsFinRowDialogOpen(false);
      setEditingFinRowId(null);
      resetFinRowForm();
      finRowsQuery.refetch();
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при обновлении записи: ${error.message}`, "danger");
    },
  });
  
  const deleteFinRowMutation = api.shiftReports.deleteFinRow.useMutation({
    onSuccess: (data) => {
      showAlert("Успешно", "Финансовая запись успешно удалена", "success");
      finRowsQuery.refetch();
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при удалении записи: ${error.message}`, "danger");
    },
  });
  
  const createExpenseMutation = api.shiftReports.createExpense.useMutation({
    onSuccess: (data) => {
      showAlert("Успешно", "Расход успешно добавлен", "success");
      setIsExpenseDialogOpen(false);
      resetExpenseForm();
      fixedExpensesQuery.refetch();
      variableExpensesQuery.refetch();
      reportRUBQuery.refetch();
      reportUSDTQuery.refetch();
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при добавлении расхода: ${error.message}`, "danger");
    },
  });
  
  const updateExpenseMutation = api.shiftReports.updateExpense.useMutation({
    onSuccess: (data) => {
      showAlert("Успешно", "Расход успешно обновлен", "success");
      setIsExpenseDialogOpen(false);
      setEditingExpenseId(null);
      resetExpenseForm();
      fixedExpensesQuery.refetch();
      variableExpensesQuery.refetch();
      reportRUBQuery.refetch();
      reportUSDTQuery.refetch();
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при обновлении расхода: ${error.message}`, "danger");
    },
  });
  
  const deleteExpenseMutation = api.shiftReports.deleteExpense.useMutation({
    onSuccess: (data) => {
      showAlert("Успешно", "Расход успешно удален", "success");
      fixedExpensesQuery.refetch();
      variableExpensesQuery.refetch();
      reportRUBQuery.refetch();
      reportUSDTQuery.refetch();
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при удалении расхода: ${error.message}`, "danger");
    },
  });

  // Сброс форм
  const resetFinRowForm = () => {
    setFinRowForm({
      date: dayjs().format("YYYY-MM-DD"),
      time: dayjs().format("HH:mm"),
      shift: "morning",
      startBalanceRUB: "",
      startBalanceUSDT: "",
      endBalanceRUB: "",
      endBalanceUSDT: "",
      employeePayments: [],
      comment: ""
    });
    setFinRowErrors({});
  };
  
  const resetExpenseForm = () => {
    setExpenseForm({
      finRowId: null,
      expenseType: "variable",
      amountRUB: "",
      amountUSDT: "",
      date: dayjs().format("YYYY-MM-DD"),
      time: dayjs().format("HH:mm"),
      period: "",
      description: ""
    });
    setExpenseErrors({});
  };

  // Добавление выплаты сотруднику
  const addEmployeePayment = () => {
    setFinRowForm(prev => ({
      ...prev,
      employeePayments: [
        ...prev.employeePayments,
        {
          employeeId: "",
          amount: "",
          currency: "RUB"
        }
      ]
    }));
  };

  // Удаление выплаты сотруднику
  const removeEmployeePayment = (index) => {
    setFinRowForm(prev => ({
      ...prev,
      employeePayments: prev.employeePayments.filter((_, i) => i !== index)
    }));
  };

  // Обновление данных выплаты сотруднику
  const updateEmployeePayment = (index, field, value) => {
    setFinRowForm(prev => {
      const updatedPayments = [...prev.employeePayments];
      updatedPayments[index] = {
        ...updatedPayments[index],
        [field]: value
      };
      return {
        ...prev,
        employeePayments: updatedPayments
      };
    });
  };

  // Валидация форм
  const validateFinRowForm = () => {
    const errors = {};
    
    if (!finRowForm.date) {
      errors.date = "Укажите дату";
    }
    
    if (!finRowForm.time) {
      errors.time = "Укажите время";
    }
    
    if (!finRowForm.startBalanceRUB && !finRowForm.startBalanceUSDT) {
      errors.startBalance = "Укажите начальный баланс хотя бы в одной валюте";
    }
    
    if (finRowForm.startBalanceRUB && isNaN(parseFloat(finRowForm.startBalanceRUB))) {
      errors.startBalanceRUB = "Укажите корректный начальный баланс в рублях";
    }
    
    if (finRowForm.startBalanceUSDT && isNaN(parseFloat(finRowForm.startBalanceUSDT))) {
      errors.startBalanceUSDT = "Укажите корректный начальный баланс в USDT";
    }
    
    if (!finRowForm.endBalanceRUB && !finRowForm.endBalanceUSDT) {
      errors.endBalance = "Укажите конечный баланс хотя бы в одной валюте";
    }
    
    if (finRowForm.endBalanceRUB && isNaN(parseFloat(finRowForm.endBalanceRUB))) {
      errors.endBalanceRUB = "Укажите корректный конечный баланс в рублях";
    }
    
    if (finRowForm.endBalanceUSDT && isNaN(parseFloat(finRowForm.endBalanceUSDT))) {
      errors.endBalanceUSDT = "Укажите корректный конечный баланс в USDT";
    }
    
    // Проверка выплат сотрудникам
    const employeeErrors = {};
    finRowForm.employeePayments.forEach((payment, index) => {
      if (!payment.employeeId) {
        employeeErrors[`employee_${index}`] = "Выберите сотрудника";
      }
      
      if (!payment.amount || isNaN(parseFloat(payment.amount)) || parseFloat(payment.amount) <= 0) {
        employeeErrors[`amount_${index}`] = "Укажите корректную сумму";
      }
    });
    
    if (Object.keys(employeeErrors).length > 0) {
      errors.employeePayments = employeeErrors;
    }
    
    setFinRowErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  const validateExpenseForm = () => {
    const errors = {};
    
    if (!expenseForm.date) {
      errors.date = "Укажите дату";
    }
    
    if (!expenseForm.time) {
      errors.time = "Укажите время";
    }
    
    if (!expenseForm.amountRUB && !expenseForm.amountUSDT) {
      errors.amount = "Укажите сумму расхода хотя бы в одной валюте";
    }
    
    if (expenseForm.amountRUB && (isNaN(parseFloat(expenseForm.amountRUB)) || parseFloat(expenseForm.amountRUB) <= 0)) {
      errors.amountRUB = "Укажите корректную сумму в рублях";
    }
    
    if (expenseForm.amountUSDT && (isNaN(parseFloat(expenseForm.amountUSDT)) || parseFloat(expenseForm.amountUSDT) <= 0)) {
      errors.amountUSDT = "Укажите корректную сумму в USDT";
    }
    
    if (expenseForm.expenseType === "fixed" && !expenseForm.period) {
      errors.period = "Укажите период для постоянного расхода";
    }
    
    setExpenseErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Обработчики форм
  const handleFinRowSubmit = (e) => {
    e && e.preventDefault();
    
    if (!validateFinRowForm()) {
      return;
    }
    
    // Адаптируем данные для совместимости с новым API createFinRow
    // Отправляем отдельные значения для RUB и USDT
    const startBalanceRUB = parseFloat(finRowForm.startBalanceRUB || "0");
    const endBalanceRUB = parseFloat(finRowForm.endBalanceRUB || "0");
    const startBalanceUSDT = parseFloat(finRowForm.startBalanceUSDT || "0");
    const endBalanceUSDT = parseFloat(finRowForm.endBalanceUSDT || "0");
    
    // Формируем объект данных для API, соответствующий схеме Zod в API
    const formData = {
      date: new Date(finRowForm.date),
      time: finRowForm.time,
      shift: finRowForm.shift,
      startBalanceRUB: startBalanceRUB,
      endBalanceRUB: endBalanceRUB,
      startBalanceUSDT: startBalanceUSDT || undefined,
      endBalanceUSDT: endBalanceUSDT || undefined,
      employeePayments: finRowForm.employeePayments.map(payment => ({
        employeeId: payment.employeeId,
        amount: payment.amount,
        currency: payment.currency
      })),
      comment: finRowForm.comment || undefined
    };
    
    if (editingFinRowId) {
      updateFinRowMutation.mutate({
        id: editingFinRowId,
        ...formData
      });
    } else {
      // Используем новый API для создания финансовой записи с выплатами сотрудникам
      createFinRowMutation.mutate(formData);
    }
  };
  
  const handleExpenseSubmit = (e) => {
    e && e.preventDefault();
    
    if (!validateExpenseForm()) {
      return;
    }
    
    // Адаптируем данные для совместимости с API
    const hasRUB = !!expenseForm.amountRUB;
    const currency = hasRUB ? "RUB" : "USDT";
    
    const formData = {
      finRowId: expenseForm.finRowId ? parseInt(expenseForm.finRowId) : undefined,
      expenseType: expenseForm.expenseType,
      amount: hasRUB 
        ? parseFloat(expenseForm.amountRUB) 
        : parseFloat(expenseForm.amountUSDT),
      currency: currency,
      date: new Date(expenseForm.date),
      time: expenseForm.time,
      period: expenseForm.period || undefined,
      description: expenseForm.description || undefined
    };
    
    if (editingExpenseId) {
      updateExpenseMutation.mutate({
        id: editingExpenseId,
        ...formData
      });
    } else {
      createExpenseMutation.mutate(formData);
    }
  };
  
  const handleReportFilterSubmit = (e) => {
    e && e.preventDefault();
    reportRUBQuery.refetch();
    reportUSDTQuery.refetch();
    if (reportFilters.includeSalary) {
      salaryPaymentsRUBQuery.refetch();
      salaryPaymentsUSDTQuery.refetch();
    }
  };

  // Обработчики полей форм
  const handleFinRowFormChange = (field, value) => {
    setFinRowForm(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const handleExpenseFormChange = (field, value) => {
    setExpenseForm(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const handleReportFilterChange = (field, value) => {
    setReportFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Обработчик для редактирования финансовой записи
  const handleEditFinRow = (finRow) => {
    setEditingFinRowId(finRow.id);
    
    // Преобразуем данные из базы в формат формы
    // Трансформируем старую структуру в новую с разделением валют
    const isRUB = finRow.currency === "RUB";
    
    setFinRowForm({
      date: dayjs(finRow.date).format("YYYY-MM-DD"),
      time: finRow.time,
      shift: finRow.shift,
      startBalanceRUB: isRUB ? finRow.startBalance?.toString() || "" : "",
      startBalanceUSDT: !isRUB ? finRow.startBalance?.toString() || "" : "",
      endBalanceRUB: isRUB ? finRow.endBalance?.toString() || "" : "",
      endBalanceUSDT: !isRUB ? finRow.endBalance?.toString() || "" : "",
      employeePayments: finRow.employeeId ? [{
        employeeId: finRow.employeeId.toString(),
        amount: finRow.usdtAmount?.toString() || "0",
        currency: finRow.currency
      }] : [],
      comment: finRow.comment || ""
    });
    
    setFinRowErrors({});
    setIsFinRowDialogOpen(true);
  };
  
  // Обработчик для удаления финансовой записи
  const handleDeleteFinRow = (id) => {
    if (window.confirm("Вы уверены, что хотите удалить эту финансовую запись?")) {
      deleteFinRowMutation.mutate({ finRowId: id });
    }
  };
  
  // Обработчик для редактирования расхода
  const handleEditExpense = (expense) => {
    setEditingExpenseId(expense.id);
    
    // Преобразуем данные из базы в формат формы
    const isRUB = expense.currency === "RUB";
    
    setExpenseForm({
      finRowId: expense.finRowId,
      expenseType: expense.expenseType,
      amountRUB: isRUB ? expense.amount?.toString() || "" : "",
      amountUSDT: !isRUB ? expense.amount?.toString() || "" : "",
      date: dayjs(expense.date).format("YYYY-MM-DD"),
      time: expense.time,
      period: expense.period || "",
      description: expense.description || ""
    });
    
    setExpenseErrors({});
    setIsExpenseDialogOpen(true);
  };
  
  // Обработчик для удаления расхода
  const handleDeleteExpense = (id) => {
    if (window.confirm("Вы уверены, что хотите удалить этот расход?")) {
      deleteExpenseMutation.mutate({ expenseId: id });
    }
  };

  // Обработчики пагинации
  const handleIncomePageChange = (page) => {
    setCurrentPageIncome(page);
  };
  
  const handleExpensesPageChange = (page) => {
    setCurrentPageExpenses(page);
  };

  // Вспомогательные функции
  const formatMoney = (amount, currency = "RUB") => {
    if (!amount || amount === 0) return "—";
    
    return new Intl.NumberFormat('ru-RU', { 
      style: 'currency', 
      currency: currency === "USDT" ? "USD" : "RUB"
    }).format(amount) + (currency === "USDT" ? " USDT" : "");
  };
  
  const formatDate = (date) => {
    return dayjs(date).format("DD.MM.YYYY");
  };
  
  const getShiftName = (shift) => {
    return shift === 'morning' ? 'Утренняя' : 'Вечерняя';
  };
  
  const getExpenseTypeName = (type) => {
    return type === 'fixed' ? 'Постоянный' : 'Переменный';
  };
  
  const getPeriodName = (period) => {
    const found = periodOptions.find(p => p.key === period);
    return found ? found.label : period;
  };

  const getCurrencyBadge = (currency) => {
    if (currency === "RUB") {
      return <Badge color="primary">₽</Badge>;
    } else if (currency === "USDT") {
      return <Badge color="success">USDT</Badge>;
    }
    return null;
  };

  return (
    <div className="container mx-auto py-6 px-4">
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
        <h1 className="text-2xl font-bold">Финансовый учет</h1>
      </div>

      <Tabs value={activeTab} onSelectionChange={setActiveTab} aria-label="Разделы финансов">
        <Tab 
          key="income" 
          title={
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              <span>Доходы (отчеты смен)</span>
            </div>
          }
        />
        <Tab 
          key="expenses" 
          title={
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>Расходы</span>
            </div>
          }
        />
        <Tab 
          key="report" 
          title={
            <div className="flex items-center gap-2">
              <BarChart className="w-4 h-4" />
              <span>Прибыль</span>
            </div>
          }
        />
      </Tabs>
      
      <div className="mt-4">
        {/* Вкладка "Доходы (отчеты смен)" */}
        {activeTab === "income" && (
          <Card>
            <CardHeader className="flex justify-between items-center px-6 py-4">
              <div>
                <h2 className="text-xl font-bold">Отчеты смен</h2>
                <p className="text-sm text-gray-500">Управление финансовыми отчетами по сменам</p>
              </div>
              <Button
                color="primary"
                startIcon={<Plus className="w-4 h-4" />}
                onClick={() => {
                  setEditingFinRowId(null);
                  resetFinRowForm();
                  setIsFinRowDialogOpen(true);
                }}
              >
                Добавить отчет
              </Button>
            </CardHeader>
            
            <CardBody className="px-6 py-4">
              {/* Фильтры для отчетов смен */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Начальная дата</label>
                  <Input
                    type="date"
                    value={finRowFilters.startDate || ""}
                    onChange={(e) => setFinRowFilters({...finRowFilters, startDate: e.target.value || null, page: 1})}
                    startContent={<Calendar className="w-4 h-4 text-gray-500" />}
                    aria-label="Начальная дата"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Конечная дата</label>
                  <Input
                    type="date"
                    value={finRowFilters.endDate || ""}
                    onChange={(e) => setFinRowFilters({...finRowFilters, endDate: e.target.value || null, page: 1})}
                    startContent={<Calendar className="w-4 h-4 text-gray-500" />}
                    aria-label="Конечная дата"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Смена</label>
                  <Select
                    placeholder="Все смены"
                    selectedKeys={finRowFilters.shift ? [finRowFilters.shift] : []}
                    onChange={(e) => setFinRowFilters({...finRowFilters, shift: e.target.value || null, page: 1})}
                    aria-label="Выбор смены"
                  >
                    <SelectItem key="" value="">Все смены</SelectItem>
                    <SelectItem key="morning" value="morning">Утренняя</SelectItem>
                    <SelectItem key="evening" value="evening">Вечерняя</SelectItem>
                  </Select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Сотрудник</label>
                  <Select
                    placeholder="Все сотрудники"
                    selectedKeys={finRowFilters.employeeId ? [finRowFilters.employeeId.toString()] : []}
                    onChange={(e) => setFinRowFilters({...finRowFilters, employeeId: e.target.value ? parseInt(e.target.value) : null, page: 1})}
                    aria-label="Выбор сотрудника"
                  >
                    <SelectItem key="" value="">Все сотрудники</SelectItem>
                    {employeesQuery.data?.employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id.toString()}>
                        {employee.fullName}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Валюта</label>
                  <Select
                    placeholder="Все валюты"
                    selectedKeys={finRowFilters.currency ? [finRowFilters.currency] : []}
                    onChange={(e) => setFinRowFilters({...finRowFilters, currency: e.target.value as Currency || null, page: 1})}
                    aria-label="Выбор валюты"
                  >
                    <SelectItem key="" value="">Все валюты</SelectItem>
                    <SelectItem key="RUB" value="RUB">Рубли (₽)</SelectItem>
                    <SelectItem key="USDT" value="USDT">USDT</SelectItem>
                  </Select>
                </div>
              </div>
              
              {/* Таблица отчетов смен */}
              <div className="overflow-x-auto">
                <Table aria-label="Таблица отчетов по сменам">
                  <TableHeader>
                    <TableColumn>Дата/Время</TableColumn>
                    <TableColumn>Смена</TableColumn>
                    <TableColumn>Начальный баланс</TableColumn>
                    <TableColumn>Конечный баланс</TableColumn>
                    <TableColumn>Выручка</TableColumn>
                    <TableColumn>Валюта</TableColumn>
                    <TableColumn>Выплаты сотрудникам</TableColumn>
                    <TableColumn>Комментарий</TableColumn>
                    <TableColumn>Действия</TableColumn>
                  </TableHeader>
                  <TableBody>
                  {finRowsQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10">
                        <div className="flex justify-center">
                          <Spinner size="lg" color="primary" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (!finRowsQuery.data?.finRows || finRowsQuery.data.finRows.length === 0) ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-10 text-gray-500">
                          Нет данных
                        </TableCell>
                      </TableRow>
                    ) : (
                      finRowsQuery.data?.finRows.map((finRow) => (
                        <TableRow key={finRow.id}>
                          <TableCell>
                            {formatDate(finRow.date)} {finRow.time}
                          </TableCell>
                          <TableCell>{getShiftName(finRow.shift)}</TableCell>
                          <TableCell>{formatMoney(finRow.startBalance, finRow.currency)}</TableCell>
                          <TableCell>{formatMoney(finRow.endBalance, finRow.currency)}</TableCell>
                          <TableCell>{formatMoney(finRow.endBalance - finRow.startBalance, finRow.currency)}</TableCell>
                          <TableCell>{getCurrencyBadge(finRow.currency)}</TableCell>
                          <TableCell>
                            {finRow.employeeId ? (
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1">
                                  <span>{finRow.employee?.fullName}: </span>
                                  <span>{formatMoney(finRow.usdtAmount, finRow.currency)}</span>
                                </div>
                              </div>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell>{finRow.comment || '—'}</TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button 
                                isIconOnly 
                                size="sm" 
                                variant="light" 
                                onClick={() => handleEditFinRow(finRow)}
                                aria-label="Редактировать"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button 
                                isIconOnly 
                                size="sm" 
                                variant="light" 
                                color="danger" 
                                onClick={() => handleDeleteFinRow(finRow.id)}
                                aria-label="Удалить"
                              >
                                <Trash className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              
              {/* Пагинация */}
              {finRowsQuery.data?.pagination && finRowsQuery.data.pagination.totalPages > 1 && (
                <div className="flex justify-between items-center mt-4">
                  <span className="text-sm text-gray-500">
                    Страница {currentPageIncome} из {finRowsQuery.data.pagination.totalPages}
                  </span>
                  <Pagination
                    total={finRowsQuery.data.pagination.totalPages}
                    initialPage={currentPageIncome}
                    page={currentPageIncome}
                    onChange={handleIncomePageChange}
                    aria-label="Пагинация списка финансовых записей"
                  />
                </div>
              )}
            </CardBody>
          </Card>
        )}
        
        {/* Вкладка "Расходы" */}
        {activeTab === "expenses" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Постоянные расходы */}
              <Card>
                <CardHeader className="flex justify-between items-center px-6 py-4">
                  <div>
                    <h2 className="text-xl font-bold">Постоянные расходы</h2>
                    <p className="text-sm text-gray-500">Постоянные расходы с указанием периода</p>
                  </div>
                  <Button
                    color="primary"
                    startIcon={<Plus className="w-4 h-4" />}
                    onClick={() => {
                      setEditingExpenseId(null);
                      setExpenseForm({
                        ...expenseForm,
                        expenseType: "fixed"
                      });
                      setExpenseErrors({});
                      setIsExpenseDialogOpen(true);
                    }}
                  >
                    Добавить
                  </Button>
                </CardHeader>
                
                <CardBody className="px-6 py-4">
                  {/* Фильтры для постоянных расходов */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Начальная дата</label>
                      <Input
                        type="date"
                        value={fixedExpensesFilters.startDate || ""}
                        onChange={(e) => setFixedExpensesFilters({
                          ...fixedExpensesFilters, 
                          startDate: e.target.value || null, 
                          page: 1
                        })}
                        startContent={<Calendar className="w-4 h-4 text-gray-500" />}
                        aria-label="Начальная дата"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Конечная дата</label>
                      <Input
                        type="date"
                        value={fixedExpensesFilters.endDate || ""}
                        onChange={(e) => setFixedExpensesFilters({
                          ...fixedExpensesFilters, 
                          endDate: e.target.value || null, 
                          page: 1
                        })}
                        startContent={<Calendar className="w-4 h-4 text-gray-500" />}
                        aria-label="Конечная дата"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Валюта</label>
                      <Select
                        placeholder="Все валюты"
                        selectedKeys={fixedExpensesFilters.currency ? [fixedExpensesFilters.currency] : []}
                        onChange={(e) => setFixedExpensesFilters({
                          ...fixedExpensesFilters, 
                          currency: e.target.value as Currency || null,
                          page: 1
                        })}
                        aria-label="Выбор валюты"
                      >
                        <SelectItem key="" value="">Все валюты</SelectItem>
                        <SelectItem key="RUB" value="RUB">Рубли (₽)</SelectItem>
                        <SelectItem key="USDT" value="USDT">USDT</SelectItem>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Таблица постоянных расходов */}
                  <div className="overflow-x-auto">
                    <Table aria-label="Таблица постоянных расходов">
                      <TableHeader>
                        <TableColumn>Дата/Время</TableColumn>
                        <TableColumn>Сумма</TableColumn>
                        <TableColumn>Валюта</TableColumn>
                        <TableColumn>Период</TableColumn>
                        <TableColumn>Описание</TableColumn>
                        <TableColumn>Действия</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {fixedExpensesQuery.isLoading ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-10">
                              <div className="flex justify-center">
                                <Spinner size="lg" color="primary" />
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : fixedExpensesQuery.data?.expenses.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-10 text-gray-500">
                              Нет данных
                            </TableCell>
                          </TableRow>
                        ) : (
                          fixedExpensesQuery.data?.expenses.map((expense) => (
                            <TableRow key={expense.id}>
                              <TableCell>
                                {formatDate(expense.date)} {expense.time}
                              </TableCell>
                              <TableCell>{formatMoney(expense.amount, expense.currency)}</TableCell>
                              <TableCell>{getCurrencyBadge(expense.currency)}</TableCell>
                              <TableCell>{getPeriodName(expense.period) || '—'}</TableCell>
                              <TableCell>{expense.description || '—'}</TableCell>
                              <TableCell>
                                <div className="flex space-x-2">
                                  <Button 
                                    isIconOnly 
                                    size="sm" 
                                    variant="light" 
                                    onClick={() => handleEditExpense(expense)}
                                    aria-label="Редактировать"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button 
                                    isIconOnly 
                                    size="sm" 
                                    variant="light" 
                                    color="danger" 
                                    onClick={() => handleDeleteExpense(expense.id)}
                                    aria-label="Удалить"
                                  >
                                    <Trash className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardBody>
              </Card>
              
              {/* Переменные расходы */}
              <Card>
                <CardHeader className="flex justify-between items-center px-6 py-4">
                  <div>
                    <h2 className="text-xl font-bold">Переменные расходы</h2>
                    <p className="text-sm text-gray-500">Переменные (разовые) расходы</p>
                  </div>
                  <Button
                    color="primary"
                    startIcon={<Plus className="w-4 h-4" />}
                    onClick={() => {
                      setEditingExpenseId(null);
                      setExpenseForm({
                        ...expenseForm,
                        expenseType: "variable"
                      });
                      setExpenseErrors({});
                      setIsExpenseDialogOpen(true);
                    }}
                  >
                    Добавить
                  </Button>
                </CardHeader>
                
                <CardBody className="px-6 py-4">
                  {/* Фильтры для переменных расходов (независимые от других фильтров) */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Начальная дата</label>
                      <Input
                        type="date"
                        value={variableExpensesFilters.startDate || ""}
                        onChange={(e) => setVariableExpensesFilters({
                          ...variableExpensesFilters, 
                          startDate: e.target.value || null, 
                          page: 1
                        })}
                        startContent={<Calendar className="w-4 h-4 text-gray-500" />}
                        aria-label="Начальная дата"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Конечная дата</label>
                      <Input
                        type="date"
                        value={variableExpensesFilters.endDate || ""}
                        onChange={(e) => setVariableExpensesFilters({
                          ...variableExpensesFilters, 
                          endDate: e.target.value || null, 
                          page: 1
                        })}
                        startContent={<Calendar className="w-4 h-4 text-gray-500" />}
                        aria-label="Конечная дата"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Валюта</label>
                      <Select
                        placeholder="Все валюты"
                        selectedKeys={variableExpensesFilters.currency ? [variableExpensesFilters.currency] : []}
                        onChange={(e) => setVariableExpensesFilters({
                          ...variableExpensesFilters, 
                          currency: e.target.value as Currency || null,
                          page: 1
                        })}
                        aria-label="Выбор валюты"
                      >
                        <SelectItem key="" value="">Все валюты</SelectItem>
                        <SelectItem key="RUB" value="RUB">Рубли (₽)</SelectItem>
                        <SelectItem key="USDT" value="USDT">USDT</SelectItem>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Таблица переменных расходов */}
                  <div className="overflow-x-auto">
                    <Table aria-label="Таблица переменных расходов">
                      <TableHeader>
                        <TableColumn>Дата/Время</TableColumn>
                        <TableColumn>Сумма</TableColumn>
                        <TableColumn>Валюта</TableColumn>
                        <TableColumn>Описание</TableColumn>
                        <TableColumn>Действия</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {variableExpensesQuery.isLoading ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-10">
                              <div className="flex justify-center">
                                <Spinner size="lg" color="primary" />
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : variableExpensesQuery.data?.expenses.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-10 text-gray-500">
                              Нет данных
                            </TableCell>
                          </TableRow>
                        ) : (
                          variableExpensesQuery.data?.expenses.map((expense) => (
                            <TableRow key={expense.id}>
                              <TableCell>
                                {formatDate(expense.date)} {expense.time}
                              </TableCell>
                              <TableCell>{formatMoney(expense.amount, expense.currency)}</TableCell>
                              <TableCell>{getCurrencyBadge(expense.currency)}</TableCell>
                              <TableCell>{expense.description || '—'}</TableCell>
                              <TableCell>
                                <div className="flex space-x-2">
                                  <Button 
                                    isIconOnly 
                                    size="sm" 
                                    variant="light" 
                                    onClick={() => handleEditExpense(expense)}
                                    aria-label="Редактировать"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button 
                                    isIconOnly 
                                    size="sm" 
                                    variant="light" 
                                    color="danger" 
                                    onClick={() => handleDeleteExpense(expense.id)}
                                    aria-label="Удалить"
                                  >
                                    <Trash className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardBody>
              </Card>
            </div>
            
            {/* Сводная информация по расходам */}
            <Card>
              <CardHeader className="px-6 py-4">
                <h2 className="text-xl font-bold">Сводная информация по расходам</h2>
              </CardHeader>
              <CardBody className="px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-8 gap-4">
                  <Card className="md:col-span-2">
                    <CardHeader className="px-6 py-3">
                      <h3 className="text-lg font-semibold">Постоянные расходы</h3>
                    </CardHeader>
                    <CardBody className="px-6 py-3">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <Badge color="primary">₽</Badge>
                          <p className="text-lg font-bold">
                            {reportRUBQuery.data?.report ? formatMoney(reportRUBQuery.data.report.expenses.fixed, "RUB") : '—'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge color="success">USDT</Badge>
                          <p className="text-lg font-bold">
                            {reportUSDTQuery.data?.report ? formatMoney(reportUSDTQuery.data.report.expenses.fixed, "USDT") : '—'}
                          </p>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                  
                  <Card className="md:col-span-2">
                    <CardHeader className="px-6 py-3">
                      <h3 className="text-lg font-semibold">Переменные расходы</h3>
                    </CardHeader>
                    <CardBody className="px-6 py-3">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <Badge color="primary">₽</Badge>
                          <p className="text-lg font-bold">
                            {reportRUBQuery.data?.report ? formatMoney(reportRUBQuery.data.report.expenses.variable, "RUB") : '—'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge color="success">USDT</Badge>
                          <p className="text-lg font-bold">
                            {reportUSDTQuery.data?.report ? formatMoney(reportUSDTQuery.data.report.expenses.variable, "USDT") : '—'}
                          </p>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                  
                  <Card className="md:col-span-2">
                    <CardHeader className="px-6 py-3">
                      <h3 className="text-lg font-semibold">Зарплатные расходы</h3>
                    </CardHeader>
                    <CardBody className="px-6 py-3">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <Badge color="primary">₽</Badge>
                          <p className="text-lg font-bold">
                            {reportRUBQuery.data?.report ? formatMoney(reportRUBQuery.data.report.expenses.salary, "RUB") : '—'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge color="success">USDT</Badge>
                          <p className="text-lg font-bold">
                            {reportUSDTQuery.data?.report ? formatMoney(reportUSDTQuery.data.report.expenses.salary, "USDT") : '—'}
                          </p>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                  
                  <Card className="md:col-span-2">
                    <CardHeader className="px-6 py-3">
                      <h3 className="text-lg font-semibold">Общие расходы</h3>
                    </CardHeader>
                    <CardBody className="px-6 py-3">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <Badge color="primary">₽</Badge>
                          <p className="text-lg font-bold">
                            {reportRUBQuery.data?.report ? formatMoney(reportRUBQuery.data.report.expenses.total, "RUB") : '—'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge color="success">USDT</Badge>
                          <p className="text-lg font-bold">
                            {reportUSDTQuery.data?.report ? formatMoney(reportUSDTQuery.data.report.expenses.total, "USDT") : '—'}
                          </p>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </CardBody>
            </Card>
          </>
        )}
        
        {/* Вкладка "Прибыль" */}
        {activeTab === "report" && (
          <Card>
            <CardHeader className="px-6 py-4">
              <h2 className="text-xl font-bold">Отчет о прибыли</h2>
              <p className="text-sm text-gray-500">Анализ доходов, расходов и прибыли за выбранный период</p>
            </CardHeader>
            
            <CardBody className="px-6 py-4">
              {/* Фильтры отчета */}
              <form onSubmit={handleReportFilterSubmit} className="space-y-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Начальная дата</label>
                    <Input
                      type="date"
                      value={reportFilters.startDate}
                      onChange={(e) => handleReportFilterChange('startDate', e.target.value)}
                      startContent={<Calendar className="w-4 h-4 text-gray-500" />}
                      aria-label="Начальная дата отчета"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Конечная дата</label>
                    <Input
                      type="date"
                      value={reportFilters.endDate}
                      onChange={(e) => handleReportFilterChange('endDate', e.target.value)}
                      startContent={<Calendar className="w-4 h-4 text-gray-500" />}
                      aria-label="Конечная дата отчета"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Включить в отчет</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        checked={reportFilters.includeFixed} 
                        onChange={(e) => handleReportFilterChange('includeFixed', e.target.checked)} 
                        className="h-4 w-4"
                        id="includeFixed"
                      />
                      <label htmlFor="includeFixed" className="text-sm">Постоянные расходы</label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        checked={reportFilters.includeVariable} 
                        onChange={(e) => handleReportFilterChange('includeVariable', e.target.checked)}
                        className="h-4 w-4"
                        id="includeVariable"
                      />
                      <label htmlFor="includeVariable" className="text-sm">Переменные расходы</label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        checked={reportFilters.includeSalary} 
                        onChange={(e) => handleReportFilterChange('includeSalary', e.target.checked)}
                        className="h-4 w-4"
                        id="includeSalary"
                      />
                      <label htmlFor="includeSalary" className="text-sm">Зарплаты</label>
                    </div>
                  </div>
                </div>
                
                <Button 
                  color="primary" 
                  type="submit"
                  isLoading={reportRUBQuery.isLoading || reportUSDTQuery.isLoading}
                >
                  {(reportRUBQuery.isLoading || reportUSDTQuery.isLoading) ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Формирование...
                    </>
                  ) : (
                    "Сформировать отчет"
                  )}
                </Button>
              </form>
              
              <hr className="my-6" />
              
              {/* Отчет о прибыли с двойными показателями */}
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="px-6 py-4">
                      <h3 className="text-lg font-bold">Доходы</h3>
                    </CardHeader>
                    <CardBody className="px-6 py-4">
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                          <Badge color="primary">₽</Badge>
                          <p className="text-3xl font-bold">
                            {reportRUBQuery.data?.report ? formatMoney(reportRUBQuery.data.report.income.total, "RUB") : '—'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge color="success">USDT</Badge>
                          <p className="text-3xl font-bold">
                            {reportUSDTQuery.data?.report ? formatMoney(reportUSDTQuery.data.report.income.total, "USDT") : '—'}
                          </p>
                        </div>
                        <p className="text-sm text-gray-500">
                          За период с {reportRUBQuery.data?.report ? formatDate(reportRUBQuery.data.report.period.startDate) : '—'} по {reportRUBQuery.data?.report ? formatDate(reportRUBQuery.data.report.period.endDate) : '—'}
                        </p>
                      </div>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardHeader className="px-6 py-4">
                      <h3 className="text-lg font-bold">Расходы</h3>
                    </CardHeader>
                    <CardBody className="px-6 py-4">
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge color="primary">₽</Badge>
                          <p className="text-3xl font-bold">
                            {reportRUBQuery.data?.report ? formatMoney(reportRUBQuery.data.report.expenses.total, "RUB") : '—'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge color="success">USDT</Badge>
                          <p className="text-3xl font-bold">
                            {reportUSDTQuery.data?.report ? formatMoney(reportUSDTQuery.data.report.expenses.total, "USDT") : '—'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 mt-6 gap-2 text-sm">
                        <div>
                          <p className="font-semibold text-center">Постоянные</p>
                          <div className="flex flex-col gap-1 items-center mt-2">
                            <div className="flex items-center gap-1">
                              <Badge color="primary" size="sm">₽</Badge>
                              <p>{reportRUBQuery.data?.report ? formatMoney(reportRUBQuery.data.report.expenses.fixed, "RUB") : '—'}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge color="success" size="sm">USDT</Badge>
                              <p>{reportUSDTQuery.data?.report ? formatMoney(reportUSDTQuery.data.report.expenses.fixed, "USDT") : '—'}</p>
                            </div>
                          </div>
                        </div>
                        <div>
                          <p className="font-semibold text-center">Переменные</p>
                          <div className="flex flex-col gap-1 items-center mt-2">
                            <div className="flex items-center gap-1">
                              <Badge color="primary" size="sm">₽</Badge>
                              <p>{reportRUBQuery.data?.report ? formatMoney(reportRUBQuery.data.report.expenses.variable, "RUB") : '—'}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge color="success" size="sm">USDT</Badge>
                              <p>{reportUSDTQuery.data?.report ? formatMoney(reportUSDTQuery.data.report.expenses.variable, "USDT") : '—'}</p>
                            </div>
                          </div>
                        </div>
                        <div>
                          <p className="font-semibold text-center">Зарплаты</p>
                          <div className="flex flex-col gap-1 items-center mt-2">
                            <div className="flex items-center gap-1">
                              <Badge color="primary" size="sm">₽</Badge>
                              <p>{reportRUBQuery.data?.report ? formatMoney(reportRUBQuery.data.report.expenses.salary, "RUB") : '—'}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge color="success" size="sm">USDT</Badge>
                              <p>{reportUSDTQuery.data?.report ? formatMoney(reportUSDTQuery.data.report.expenses.salary, "USDT") : '—'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </div>
                
                <Card>
                  <CardHeader className="px-6 py-4">
                    <h3 className="text-lg font-bold">Прибыль</h3>
                  </CardHeader>
                  <CardBody className="px-6 py-4">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                        <Badge color="primary" size="lg">₽</Badge>
                        <p className={`text-4xl font-bold ${reportRUBQuery.data?.report && reportRUBQuery.data.report.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {reportRUBQuery.data?.report ? formatMoney(reportRUBQuery.data.report.profit, "RUB") : '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge color="success" size="lg">USDT</Badge>
                        <p className={`text-4xl font-bold ${reportUSDTQuery.data?.report && reportUSDTQuery.data.report.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {reportUSDTQuery.data?.report ? formatMoney(reportUSDTQuery.data.report.profit, "USDT") : '—'}
                        </p>
                      </div>
                      <p className="text-sm text-gray-500 mt-2">
                        Прибыль = Доходы - Расходы
                      </p>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
      
      {/* Модальное окно добавления/редактирования финансовой записи - увеличена ширина */}
      <Modal 
        isOpen={isFinRowDialogOpen} 
        onClose={() => setIsFinRowDialogOpen(false)}
        size="3xl" // Увеличенный размер
        className="max-w-5xl" // Дополнительное увеличение ширины через класс
      >
        <ModalContent className="w-full max-w-5xl"> {/* Увеличиваем ширину для всех полей */}
          <ModalHeader>
            <h3 className="text-lg font-medium">
              {editingFinRowId ? 'Редактирование отчета смены' : 'Добавление отчета смены'}
            </h3>
            <p className="text-sm text-gray-500">
              Заполните информацию о финансовом отчете смены
            </p>
          </ModalHeader>
          <ModalBody>
            <form onSubmit={handleFinRowSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Дата</label>
                  <Input
                    type="date"
                    value={finRowForm.date}
                    onChange={(e) => handleFinRowFormChange('date', e.target.value)}
                    isInvalid={!!finRowErrors.date}
                    errorMessage={finRowErrors.date}
                    startContent={<Calendar className="w-4 h-4 text-gray-500" />}
                    aria-label="Дата отчета"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Время</label>
                  <Input
                    type="time"
                    value={finRowForm.time}
                    onChange={(e) => handleFinRowFormChange('time', e.target.value)}
                    isInvalid={!!finRowErrors.time}
                    errorMessage={finRowErrors.time}
                    aria-label="Время отчета"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Смена</label>
                  <Select
                    selectedKeys={[finRowForm.shift]}
                    onChange={(e) => handleFinRowFormChange('shift', e.target.value)}
                    aria-label="Выбор смены"
                  >
                    <SelectItem key="morning" value="morning">Утренняя</SelectItem>
                    <SelectItem key="evening" value="evening">Вечерняя</SelectItem>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="font-medium">Начальный баланс</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Рубли (₽)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={finRowForm.startBalanceRUB}
                        onChange={(e) => handleFinRowFormChange('startBalanceRUB', e.target.value)}
                        isInvalid={!!finRowErrors.startBalanceRUB}
                        errorMessage={finRowErrors.startBalanceRUB}
                        aria-label="Начальный баланс в рублях"
                        placeholder="0.00"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">USDT</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={finRowForm.startBalanceUSDT}
                        onChange={(e) => handleFinRowFormChange('startBalanceUSDT', e.target.value)}
                        isInvalid={!!finRowErrors.startBalanceUSDT}
                        errorMessage={finRowErrors.startBalanceUSDT}
                        aria-label="Начальный баланс в USDT"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-medium">Конечный баланс</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Рубли (₽)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={finRowForm.endBalanceRUB}
                        onChange={(e) => handleFinRowFormChange('endBalanceRUB', e.target.value)}
                        isInvalid={!!finRowErrors.endBalanceRUB}
                        errorMessage={finRowErrors.endBalanceRUB}
                        aria-label="Конечный баланс в рублях"
                        placeholder="0.00"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">USDT</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={finRowForm.endBalanceUSDT}
                        onChange={(e) => handleFinRowFormChange('endBalanceUSDT', e.target.value)}
                        isInvalid={!!finRowErrors.endBalanceUSDT}
                        errorMessage={finRowErrors.endBalanceUSDT}
                        aria-label="Конечный баланс в USDT"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Секция с выплатами сотрудникам */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-gray-700">Выплаты сотрудникам</label>
                  <Button 
                    size="sm"
                    color="primary"
                    variant="flat"
                    onClick={addEmployeePayment}
                    startIcon={<Plus className="w-4 h-4" />}
                  >
                    Добавить сотрудника
                  </Button>
                </div>
                
                {finRowForm.employeePayments.length === 0 ? (
                  <p className="text-sm text-gray-500">Нет выплат сотрудникам</p>
                ) : (
                  <div className="space-y-3">
                    {finRowForm.employeePayments.map((payment, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 border rounded-md">
                        <div className="flex-1">
                          <Select
                            placeholder="Выберите сотрудника"
                            selectedKeys={payment.employeeId ? [payment.employeeId] : []}
                            onChange={(e) => updateEmployeePayment(index, 'employeeId', e.target.value)}
                            aria-label="Выбор сотрудника"
                            isInvalid={finRowErrors.employeePayments && finRowErrors.employeePayments[`employee_${index}`]}
                            errorMessage={finRowErrors.employeePayments && finRowErrors.employeePayments[`employee_${index}`]}
                          >
                            {employeesQuery.data?.employees.map((employee) => (
                              <SelectItem key={employee.id.toString()} value={employee.id.toString()}>
                                {employee.fullName}
                              </SelectItem>
                            ))}
                          </Select>
                        </div>
                        
                        <div className="flex-1">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Сумма"
                            value={payment.amount}
                            onChange={(e) => updateEmployeePayment(index, 'amount', e.target.value)}
                            aria-label="Сумма выплаты"
                            isInvalid={finRowErrors.employeePayments && finRowErrors.employeePayments[`amount_${index}`]}
                            errorMessage={finRowErrors.employeePayments && finRowErrors.employeePayments[`amount_${index}`]}
                          />
                        </div>
                        
                        <div className="flex-none w-32">
                          <Select
                            selectedKeys={[payment.currency]}
                            onChange={(e) => updateEmployeePayment(index, 'currency', e.target.value)}
                            aria-label="Валюта выплаты"
                          >
                            <SelectItem key="RUB" value="RUB">₽</SelectItem>
                            <SelectItem key="USDT" value="USDT">USDT</SelectItem>
                          </Select>
                        </div>
                        
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          color="danger"
                          onClick={() => removeEmployeePayment(index)}
                          aria-label="Удалить выплату"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Комментарий</label>
                <Textarea
                  placeholder="Добавьте комментарий (необязательно)"
                  value={finRowForm.comment}
                  onChange={(e) => handleFinRowFormChange('comment', e.target.value)}
                  aria-label="Комментарий к отчету"
                />
              </div>
            </form>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              color="default"
              onClick={() => setIsFinRowDialogOpen(false)}
            >
              Отмена
            </Button>
            <Button
              color="primary"
              onClick={handleFinRowSubmit}
              isLoading={createFinRowMutation.isLoading || updateFinRowMutation.isLoading}
            >
              {(createFinRowMutation.isLoading || updateFinRowMutation.isLoading) ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  {editingFinRowId ? 'Сохранение...' : 'Добавление...'}
                </>
              ) : (
                editingFinRowId ? 'Сохранить' : 'Добавить'
              )}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Модальное окно добавления/редактирования расхода - увеличена ширина */}
      <Modal 
        isOpen={isExpenseDialogOpen} 
        onClose={() => setIsExpenseDialogOpen(false)}
        size="2xl" // Увеличенный размер
        className="max-w-3xl" // Дополнительное увеличение ширины через класс
      >
        <ModalContent className="w-full max-w-3xl"> {/* Увеличиваем ширину для всех полей */}
          <ModalHeader>
            <h3 className="text-lg font-medium">
              {editingExpenseId ? 'Редактирование расхода' : 'Добавление расхода'}
            </h3>
            <p className="text-sm text-gray-500">
              Заполните информацию о расходе
            </p>
          </ModalHeader>
          <ModalBody>
            <form onSubmit={handleExpenseSubmit} className="space-y-4">
              <div className="space-y-2 mb-4">
                <label className="block text-sm font-medium text-gray-700">Тип расхода</label>
                <div className="flex space-x-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="fixed"
                      name="expenseType"
                      value="fixed"
                      checked={expenseForm.expenseType === "fixed"}
                      onChange={() => handleExpenseFormChange('expenseType', 'fixed')}
                      className="h-4 w-4"
                    />
                    <label htmlFor="fixed">Постоянный</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="variable"
                      name="expenseType"
                      value="variable"
                      checked={expenseForm.expenseType === "variable"}
                      onChange={() => handleExpenseFormChange('expenseType', 'variable')}
                      className="h-4 w-4"
                    />
                    <label htmlFor="variable">Переменный</label>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Дата</label>
                  <Input
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => handleExpenseFormChange('date', e.target.value)}
                    isInvalid={!!expenseErrors.date}
                    errorMessage={expenseErrors.date}
                    startContent={<Calendar className="w-4 h-4 text-gray-500" />}
                    aria-label="Дата расхода"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Время</label>
                  <Input
                    type="time"
                    value={expenseForm.time}
                    onChange={(e) => handleExpenseFormChange('time', e.target.value)}
                    isInvalid={!!expenseErrors.time}
                    errorMessage={expenseErrors.time}
                    aria-label="Время расхода"
                  />
                </div>
                
                {expenseForm.expenseType === 'fixed' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Период</label>
                    <Select
                      placeholder="Выберите период"
                      selectedKeys={expenseForm.period ? [expenseForm.period] : []}
                      onChange={(e) => handleExpenseFormChange('period', e.target.value)}
                      isInvalid={!!expenseErrors.period}
                      errorMessage={expenseErrors.period}
                      aria-label="Период расхода"
                    >
                      {periodOptions.map(option => (
                        <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>
                      ))}
                    </Select>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Сумма (₽)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={expenseForm.amountRUB}
                    onChange={(e) => handleExpenseFormChange('amountRUB', e.target.value)}
                    isInvalid={!!expenseErrors.amountRUB}
                    errorMessage={expenseErrors.amountRUB}
                    aria-label="Сумма расхода в рублях"
                    placeholder="0.00"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Сумма (USDT)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={expenseForm.amountUSDT}
                    onChange={(e) => handleExpenseFormChange('amountUSDT', e.target.value)}
                    isInvalid={!!expenseErrors.amountUSDT}
                    errorMessage={expenseErrors.amountUSDT}
                    aria-label="Сумма расхода в USDT"
                    placeholder="0.00"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Описание</label>
                <Textarea
                  placeholder="Добавьте описание расхода (необязательно)"
                  value={expenseForm.description}
                  onChange={(e) => handleExpenseFormChange('description', e.target.value)}
                  aria-label="Описание расхода"
                />
              </div>
            </form>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              color="default"
              onClick={() => setIsExpenseDialogOpen(false)}
            >
              Отмена
            </Button>
            <Button
              color="primary"
              onClick={handleExpenseSubmit}
              isLoading={createExpenseMutation.isLoading || updateExpenseMutation.isLoading}
            >
              {(createExpenseMutation.isLoading || updateExpenseMutation.isLoading) ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  {editingExpenseId ? 'Сохранение...' : 'Добавление...'}
                </>
              ) : (
                editingExpenseId ? 'Сохранить' : 'Добавить'
              )}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}