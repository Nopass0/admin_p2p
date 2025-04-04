"use client";

// app/finances/client.tsx
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { 
  Card, CardBody, CardHeader, 
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Button, Input, Modal, ModalContent, ModalBody, ModalFooter, ModalHeader,
  Select, SelectItem, Pagination, Spinner, Alert, Textarea, Badge, Tabs, Tab
} from "@heroui";
import { 
  Calendar, Plus, CheckCircle, AlertCircle, Loader, Edit, Trash,
  DollarSign, FileText, BarChart, X
} from "lucide-react";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import localeData from "dayjs/plugin/localeData";

dayjs.extend(localeData);
dayjs.locale("ru");

// Types and constants
type Currency = "RUB" | "USDT";
type EmployeePayment = { employeeId: string; amount: string; currency: Currency };

const periodOptions = [
  { key: "daily", label: "Ежедневно" },
  { key: "weekly", label: "Еженедельно" },
  { key: "monthly", label: "Ежемесячно" },
  { key: "quarterly", label: "Ежеквартально" },
  { key: "yearly", label: "Ежегодно" }
];

export default function FinanceClientPage() {
  // Router and URL params
  const searchParams = useSearchParams();
  const sectionFromUrl = searchParams.get('section');
  const router = useRouter();
  
  // State management
  const [activeTab, setActiveTab] = useState("income");
  const [activeSection, setActiveSection] = useState(sectionFromUrl || "ALL");
  const [currentPageIncome, setCurrentPageIncome] = useState(1);
  const [currentPageExpenses, setCurrentPageExpenses] = useState(1);
  const [incomeTableKey, setIncomeTableKey] = useState(0);
  const [reportTableKey, setReportTableKey] = useState(0);
  
  // Modal states
  const [isFinRowDialogOpen, setIsFinRowDialogOpen] = useState(false);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [editingFinRowId, setEditingFinRowId] = useState(null);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  
  // Filter states
  const [finRowFilters, setFinRowFilters] = useState({
    startDate: null,
    endDate: null,
    shift: null,
    employeeId: null,
    currency: null as Currency | null,
    section: sectionFromUrl === "PAYMENTS" || sectionFromUrl === "TRACTOR" ? sectionFromUrl : null,
    allSections: sectionFromUrl !== "PAYMENTS" && sectionFromUrl !== "TRACTOR",
  });
  
  const [fixedExpensesFilters, setFixedExpensesFilters] = useState({
    startDate: null,
    endDate: null,
    currency: null as Currency | null,
    section: activeSection !== "ALL" ? activeSection : null
  });
  
  const [variableExpensesFilters, setVariableExpensesFilters] = useState({
    startDate: null,
    endDate: null,
    currency: null as Currency | null,
    section: activeSection !== "ALL" ? activeSection : null
  });
  
  const [reportFilters, setReportFilters] = useState({
    startDate: dayjs().startOf('month').format("YYYY-MM-DD"),
    endDate: dayjs().format("YYYY-MM-DD"),
    includeFixed: true,
    includeVariable: true,
    includeSalary: true,
  });
  
  // Form states
  const [finRowForm, setFinRowForm] = useState({
    date: dayjs().format("YYYY-MM-DD"),
    time: dayjs().format("HH:mm"),
    shift: "morning",
    startBalanceRUB: "",
    startBalanceUSDT: "",
    endBalanceRUB: "",
    endBalanceUSDT: "",
    employeePayments: [] as EmployeePayment[],
    comment: "",
    section: (sectionFromUrl === "PAYMENTS" || sectionFromUrl === "TRACTOR") ? sectionFromUrl : "PAYMENTS"
  });
  
  const [expenseForm, setExpenseForm] = useState({
    date: dayjs().format("YYYY-MM-DD"),
    time: dayjs().format("HH:mm"),
    expenseType: "fixed",
    amountRUB: "",
    amountUSDT: "",
    finRowId: "",
    period: "monthly",
    description: "",
    section: activeSection !== "ALL" ? activeSection : "PAYMENTS"
  });
  
  // Validation states
  const [finRowErrors, setFinRowErrors] = useState({});
  const [expenseErrors, setExpenseErrors] = useState({});
  
  // Alert state
  const [alert, setAlert] = useState({
    isVisible: false,
    title: "",
    description: "",
    color: "default"
  });

  const pageSize = 10;

  // Show notification
  const showAlert = (title, description, color) => {
    setAlert({ isVisible: true, title, description, color });
    setTimeout(() => setAlert(prev => ({ ...prev, isVisible: false })), 5000);
  };

  // API queries
  const getAllFinRowsQuery = api.finance.getAllFinRows.useQuery({
    page: currentPageIncome,
    pageSize: 10,
    startDate: finRowFilters.startDate && new Date(finRowFilters.startDate),
    endDate: finRowFilters.endDate && new Date(finRowFilters.endDate),
    shift: finRowFilters.shift as any,
    employeeId: finRowFilters.employeeId as any,
    currency: finRowFilters.currency as any,
    section: finRowFilters.section as any,
    allSections: finRowFilters.allSections
  }, {
    enabled: activeTab === "income",
    keepPreviousData: false,
  });

  const fixedExpensesQuery = api.finance.getExpenses.useQuery({
    page: currentPageExpenses,
    pageSize,
    startDate: fixedExpensesFilters.startDate && new Date(fixedExpensesFilters.startDate),
    endDate: fixedExpensesFilters.endDate && new Date(fixedExpensesFilters.endDate),
    expenseType: "fixed",
    currency: fixedExpensesFilters.currency as any,
    section: fixedExpensesFilters.section as any,
  });
  
  const variableExpensesQuery = api.finance.getExpenses.useQuery({
    page: currentPageExpenses,
    pageSize,
    startDate: variableExpensesFilters.startDate && new Date(variableExpensesFilters.startDate),
    endDate: variableExpensesFilters.endDate && new Date(variableExpensesFilters.endDate),
    expenseType: "variable",
    currency: variableExpensesFilters.currency as any,
    section: variableExpensesFilters.section as any,
  });

  const employeesQuery = api.salary.getAllEmployees.useQuery({ page: 1, pageSize: 100 });
  
  const salaryPaymentsRUBQuery = api.salary.getAllPayments.useQuery({
    page: 1,
    pageSize: 100,
    startDate: reportFilters.startDate && new Date(reportFilters.startDate),
    endDate: reportFilters.endDate && new Date(reportFilters.endDate),
    currency: "RUB"
  }, { enabled: reportFilters.includeSalary });
  
  const salaryPaymentsUSDTQuery = api.salary.getAllPayments.useQuery({
    page: 1,
    pageSize: 100,
    startDate: reportFilters.startDate && new Date(reportFilters.startDate),
    endDate: reportFilters.endDate && new Date(reportFilters.endDate),
    currency: "USDT"
  }, { enabled: reportFilters.includeSalary });

  const reportRUBQuery = api.finance.getSummaryReport.useQuery({
    startDate: new Date(reportFilters.startDate),
    endDate: new Date(reportFilters.endDate),
    includeFixed: reportFilters.includeFixed,
    includeVariable: reportFilters.includeVariable,
    includeSalary: reportFilters.includeSalary,
    currency: "RUB",
    section: activeSection !== "ALL" ? activeSection : null,
  });
  
  const reportUSDTQuery = api.finance.getSummaryReport.useQuery({
    startDate: new Date(reportFilters.startDate),
    endDate: new Date(reportFilters.endDate),
    includeFixed: reportFilters.includeFixed,
    includeVariable: reportFilters.includeVariable,
    includeSalary: reportFilters.includeSalary,
    currency: "USDT",
    section: activeSection !== "ALL" ? activeSection : null,
  });

  // CRUD mutations
  const createFinRowMutation = api.finance.createFinRow.useMutation({
    onSuccess: () => {
      showAlert("Успешно", "Финансовая запись успешно создана", "success");
      setIsFinRowDialogOpen(false);
      resetFinRowForm();
      getAllFinRowsQuery.refetch();
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при создании записи: ${error.message}`, "danger");
    },
  });
  
  const updateFinRowMutation = api.finance.updateFinRow.useMutation({
    onSuccess: () => {
      showAlert("Успешно", "Финансовая запись успешно обновлена", "success");
      setIsFinRowDialogOpen(false);
      setEditingFinRowId(null);
      resetFinRowForm();
      getAllFinRowsQuery.refetch();
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при обновлении записи: ${error.message}`, "danger");
    },
  });
  
  const deleteFinRowMutation = api.finance.deleteFinRow.useMutation({
    onSuccess: () => {
      showAlert("Успешно", "Финансовая запись успешно удалена", "success");
      getAllFinRowsQuery.refetch();
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при удалении записи: ${error.message}`, "danger");
    },
  });
  
  const createExpenseMutation = api.finance.createExpense.useMutation({
    onSuccess: () => {
      showAlert("Успешно", "Расход успешно добавлен", "success");
      setIsExpenseDialogOpen(false);
      resetExpenseForm();
      refreshExpenseData();
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при добавлении расхода: ${error.message}`, "danger");
    },
  });
  
  const updateExpenseMutation = api.finance.updateExpense.useMutation({
    onSuccess: () => {
      showAlert("Успешно", "Расход успешно обновлен", "success");
      setIsExpenseDialogOpen(false);
      setEditingExpenseId(null);
      resetExpenseForm();
      refreshExpenseData();
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при обновлении расхода: ${error.message}`, "danger");
    },
  });
  
  const deleteExpenseMutation = api.finance.deleteExpense.useMutation({
    onSuccess: () => {
      showAlert("Успешно", "Расход успешно удален", "success");
      refreshExpenseData();
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при удалении расхода: ${error.message}`, "danger");
    },
  });

  // Utility functions to refresh data
  const refreshExpenseData = () => {
    fixedExpensesQuery.refetch();
    variableExpensesQuery.refetch();
    reportRUBQuery.refetch();
    reportUSDTQuery.refetch();
  };
  
  const refreshAllQueries = () => {
    getAllFinRowsQuery.refetch();
    fixedExpensesQuery.refetch();
    variableExpensesQuery.refetch();
    if (activeTab === "report") {
      reportRUBQuery.refetch();
      reportUSDTQuery.refetch();
      if (reportFilters.includeSalary) {
        salaryPaymentsRUBQuery.refetch();
        salaryPaymentsUSDTQuery.refetch();
      }
    }
  };

  // Reset forms
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
      comment: "",
      section: activeSection === "ALL" ? "PAYMENTS" : activeSection as "PAYMENTS" | "TRACTOR"
    });
    setFinRowErrors({});
  };
  
  const resetExpenseForm = () => {
    setExpenseForm({
      date: dayjs().format("YYYY-MM-DD"),
      time: dayjs().format("HH:mm"),
      expenseType: "fixed",
      amountRUB: "",
      amountUSDT: "",
      finRowId: "",
      period: "monthly",
      description: "",
      section: activeSection !== "ALL" ? activeSection : "PAYMENTS"
    });
    setExpenseErrors({});
  };

  // Employee payment handlers
  const addEmployeePayment = () => {
    setFinRowForm(prev => ({
      ...prev,
      employeePayments: [...prev.employeePayments, {employeeId: "", amount: "", currency: "RUB"}]
    }));
  };

  const removeEmployeePayment = (index) => {
    setFinRowForm(prev => ({
      ...prev,
      employeePayments: prev.employeePayments.filter((_, i) => i !== index)
    }));
  };

  const updateEmployeePayment = (index, field, value) => {
    setFinRowForm(prev => {
      const updatedPayments = [...prev.employeePayments];
      updatedPayments[index] = {...updatedPayments[index], [field]: value};
      return {...prev, employeePayments: updatedPayments};
    });
  };

  // Form validation
  const validateFinRowForm = () => {
    const errors = {};
    
    if (!finRowForm.date) errors.date = "Укажите дату";
    if (!finRowForm.time) errors.time = "Укажите время";
    
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
    
    if (!expenseForm.date) errors.date = "Укажите дату";
    if (!expenseForm.time) errors.time = "Укажите время";
    
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

  // Form submission handlers
  const handleFinRowSubmit = (e) => {
    e.preventDefault();
    if (!validateFinRowForm()) return;
    
    const hasRUB = !!finRowForm.startBalanceRUB || !!finRowForm.endBalanceRUB;
    const currency = hasRUB ? "RUB" : "USDT";
    
    const formData = {
      date: new Date(finRowForm.date),
      time: finRowForm.time,
      shift: finRowForm.shift,
      startBalance: hasRUB 
        ? parseFloat(finRowForm.startBalanceRUB || "0") 
        : parseFloat(finRowForm.startBalanceUSDT || "0"),
      endBalance: hasRUB 
        ? parseFloat(finRowForm.endBalanceRUB || "0") 
        : parseFloat(finRowForm.endBalanceUSDT || "0"),
      employeeId: finRowForm.employeePayments.length > 0 
        ? parseInt(finRowForm.employeePayments[0].employeeId) 
        : undefined,
      usdtAmount: finRowForm.employeePayments.length > 0 
        ? parseFloat(finRowForm.employeePayments[0].amount) 
        : 0,
      currency: currency,
      comment: finRowForm.comment || undefined,
      section: finRowForm.section
    };
    
    if (editingFinRowId) {
      updateFinRowMutation.mutate({ id: editingFinRowId, ...formData });
    } else {
      createFinRowMutation.mutate(formData);
    }
    
    // Additional employee payments handling
    if (finRowForm.employeePayments.length > 1) {
      finRowForm.employeePayments.slice(1).forEach(payment => {
        if (payment.employeeId && payment.amount) {
          api.salary.addPayment.mutate({
            salaryId: parseInt(payment.employeeId),
            amount: parseFloat(payment.amount),
            paymentDate: new Date(finRowForm.date),
            currency: payment.currency,
            comment: `Выплата за смену (${finRowForm.shift === 'morning' ? 'утро' : 'вечер'})`
          });
        }
      });
    }
  };
  
  const handleExpenseSubmit = (e) => {
    e.preventDefault();
    if (!validateExpenseForm()) return;
    
    const hasRUB = !!expenseForm.amountRUB;
    const currency = hasRUB ? "RUB" : "USDT";
    
    const formData = {
      finRowId: expenseForm.finRowId ? parseInt(expenseForm.finRowId) : undefined,
      expenseType: expenseForm.expenseType,
      amount: hasRUB ? parseFloat(expenseForm.amountRUB) : parseFloat(expenseForm.amountUSDT),
      currency: currency,
      date: new Date(expenseForm.date),
      time: expenseForm.time,
      period: expenseForm.period || undefined,
      description: expenseForm.description || undefined,
      section: expenseForm.section
    };
    
    if (editingExpenseId) {
      updateExpenseMutation.mutate({ id: editingExpenseId, ...formData });
    } else {
      createExpenseMutation.mutate(formData);
    }
  };
  
  const handleReportFilterSubmit = (e) => {
    e.preventDefault();
    reportRUBQuery.refetch();
    reportUSDTQuery.refetch();
    if (reportFilters.includeSalary) {
      salaryPaymentsRUBQuery.refetch();
      salaryPaymentsUSDTQuery.refetch();
    }
  };

  // Section and form field handlers
  const handleSectionChange = (section) => {
    setActiveSection(section);
    setCurrentPageIncome(1);
    
    if (section === "ALL") {
      setFinRowFilters(prev => ({ ...prev, section: null, allSections: true }));
      setFixedExpensesFilters(prev => ({ ...prev, section: null }));
      setVariableExpensesFilters(prev => ({ ...prev, section: null }));
      router.push('/finances');
    } else {
      setFinRowFilters(prev => ({ ...prev, section: section, allSections: false }));
      setFixedExpensesFilters(prev => ({ ...prev, section: section }));
      setVariableExpensesFilters(prev => ({ ...prev, section: section }));
      router.push(`/finances?section=${section}`);
    }
    
    // Update section in expense form
    setExpenseForm(prev => ({
      ...prev,
      section: section !== "ALL" ? section : "PAYMENTS"
    }));
    
    setTimeout(refreshAllQueries, 0);
  };

  const handleFinRowFormChange = (field, value) => {
    setFinRowForm(prev => ({ ...prev, [field]: value }));
  };
  
  const handleExpenseFormChange = (field, value) => {
    setExpenseForm(prev => ({ ...prev, [field]: value }));
  };
  
  const handleReportFilterChange = (field, value) => {
    setReportFilters(prev => ({ ...prev, [field]: value }));
  };

  // CRUD operation handlers
  const handleEditFinRow = (finRow) => {
    setEditingFinRowId(finRow.id);
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
      comment: finRow.comment || "",
      section: finRow.section
    });
    
    setFinRowErrors({});
    setIsFinRowDialogOpen(true);
  };
  
  const handleDeleteFinRow = (id) => {
    if (window.confirm("Вы уверены, что хотите удалить эту финансовую запись?")) {
      deleteFinRowMutation.mutate({ finRowId: id });
    }
  };
  
  const handleEditExpense = (expense) => {
    setEditingExpenseId(expense.id);
    const isRUB = expense.currency === "RUB";
    
    setExpenseForm({
      finRowId: expense.finRowId,
      expenseType: expense.expenseType,
      amountRUB: isRUB ? expense.amount?.toString() || "" : "",
      amountUSDT: !isRUB ? expense.amount?.toString() || "" : "",
      date: dayjs(expense.date).format("YYYY-MM-DD"),
      time: expense.time,
      period: expense.period || "",
      description: expense.description || "",
      section: expense.section || (activeSection !== "ALL" ? activeSection : "PAYMENTS")
    });
    
    setExpenseErrors({});
    setIsExpenseDialogOpen(true);
  };
  
  const handleDeleteExpense = (id) => {
    if (window.confirm("Вы уверены, что хотите удалить этот расход?")) {
      deleteExpenseMutation.mutate({ expenseId: id });
    }
  };

  // Pagination handlers
  const handleIncomePageChange = (page) => setCurrentPageIncome(page);
  const handleExpensesPageChange = (page) => setCurrentPageExpenses(page);

  // Formatter functions
  const formatMoney = (amount, currency = "RUB") => {
    if (!amount || amount === 0) return "—";
    return new Intl.NumberFormat('ru-RU', { 
      style: 'currency', 
      currency: currency === "USDT" ? "USD" : "RUB"
    }).format(amount) + (currency === "USDT" ? " USDT" : "");
  };
  
  const formatDate = (date) => dayjs(date).format("DD.MM.YYYY");
  const getShiftName = (shift) => shift === 'morning' ? 'Утренняя' : 'Вечерняя';
  const getPeriodName = (period) => {
    const found = periodOptions.find(p => p.key === period);
    return found ? found.label : period;
  };

  const getCurrencyBadge = (currency) => {
    if (currency === "RUB") return <Badge color="primary">₽</Badge>;
    if (currency === "USDT") return <Badge color="success">USDT</Badge>;
    return null;
  };

  // Component initialization
  useEffect(() => {
    if (sectionFromUrl) {
      setActiveSection(sectionFromUrl);
      setFinRowFilters(prev => ({
        ...prev,
        section: sectionFromUrl === "PAYMENTS" || sectionFromUrl === "TRACTOR" ? sectionFromUrl : null,
        allSections: sectionFromUrl !== "PAYMENTS" && sectionFromUrl !== "TRACTOR"
      }));
      
      // Update expense filters with section
      setFixedExpensesFilters(prev => ({ ...prev, section: sectionFromUrl !== "ALL" ? sectionFromUrl : null }));
      setVariableExpensesFilters(prev => ({ ...prev, section: sectionFromUrl !== "ALL" ? sectionFromUrl : null }));
      
      setTimeout(refreshAllQueries, 100);
    }
  }, []);

  // Section change effect
  useEffect(() => {
    // Update expense filters when section changes
    setCurrentPageExpenses(1);
    refreshAllQueries();
  }, [activeSection]);
  
  // Tab change effect
  useEffect(() => {
    if (activeTab === 'income') {
      setIncomeTableKey(prevKey => prevKey + 1);
    } else if (activeTab === 'report') {
      setReportTableKey(prevKey => prevKey + 1);
    }
    refreshAllQueries();
  }, [activeTab]);

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
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <h1 className="text-2xl font-bold">Финансовый учет</h1>
      </div>

      {/* Section tabs */}
      <div className="mb-6">
        <Tabs 
          selectedKey={activeSection} 
          onSelectionChange={(key) => handleSectionChange(key.toString())}
          aria-label="Секции финансов"
          variant="bordered"
          classNames={{
            tabList: "bg-gray-50 dark:bg-zinc-900",
            cursor: "bg-white dark:bg-zinc-800 shadow-md",
            tab: "px-8 py-2 font-medium"
          }}
        >
          <Tab key="ALL" title="Общее" />
          <Tab key="PAYMENTS" title="Выплаты" />
          <Tab key="TRACTOR" title="Трактор" />
        </Tabs>
      </div>

      {/* Finance type tabs */}
      <Tabs value={activeTab} onSelectionChange={setActiveTab} aria-label="Типы финансов">
        <Tab key="income" title={<div className="flex items-center gap-2"><DollarSign className="w-4 h-4" /><span>Доходы (отчеты смен)</span></div>} />
        <Tab key="expenses" title={<div className="flex items-center gap-2"><FileText className="w-4 h-4" /><span>Расходы</span></div>} />
        <Tab key="report" title={<div className="flex items-center gap-2"><BarChart className="w-4 h-4" /><span>Прибыль</span></div>} />
      </Tabs>
      
      <div className="mt-4">
        {/* Income tab */}
        {activeTab === "income" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center">
                <h2 className="text-xl font-semibold">Доходы от смен</h2>
                {activeSection !== 'ALL' && (
                  <Badge color={activeSection === 'PAYMENTS' ? 'primary' : 'warning'} className="ml-3 px-3 py-1">
                    {activeSection === 'PAYMENTS' ? 'Выплаты' : 'Трактор'}
                  </Badge>
                )}
              </div>
              <Button color="primary" onClick={() => {
                setEditingFinRowId(null);
                resetFinRowForm();
                setIsFinRowDialogOpen(true);
              }}>
                <Plus className="w-4 h-4 mr-2" /> Добавить запись
              </Button>
            </div>
            <Card>
              <CardHeader className="flex justify-between items-center px-6 py-4">
                <div>
                  <h2 className="text-xl font-bold">Отчеты смен {activeSection !== "ALL" && (
                    <Badge color={activeSection === "PAYMENTS" ? "primary" : "warning"} className="ml-2">
                      {activeSection === "PAYMENTS" ? "Выплаты" : "Трактор"}
                    </Badge>
                  )}</h2>
                  <p className="text-sm text-gray-500">Управление финансовыми отчетами по сменам</p>
                </div>
              </CardHeader>
              
              <CardBody className="px-6 py-4">
                {/* Income report filters */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Начальная дата</label>
                    <Input
                      type="date"
                      value={finRowFilters.startDate || ""}
                      onChange={(e) => setFinRowFilters({...finRowFilters, startDate: e.target.value || null, page: 1})}
                      startContent={<Calendar className="w-4 h-4 text-gray-500" />}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Конечная дата</label>
                    <Input
                      type="date"
                      value={finRowFilters.endDate || ""}
                      onChange={(e) => setFinRowFilters({...finRowFilters, endDate: e.target.value || null, page: 1})}
                      startContent={<Calendar className="w-4 h-4 text-gray-500" />}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Смена</label>
                    <Select
                      placeholder="Все смены"
                      selectedKeys={finRowFilters.shift ? [finRowFilters.shift] : []}
                      onChange={(e) => setFinRowFilters({...finRowFilters, shift: e.target.value || null, page: 1})}
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
                    >
                      <SelectItem key="" value="">Все валюты</SelectItem>
                      <SelectItem key="RUB" value="RUB">Рубли (₽)</SelectItem>
                      <SelectItem key="USDT" value="USDT">USDT</SelectItem>
                    </Select>
                  </div>
                </div>
                
                {/* Income reports table */}
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
                      {getAllFinRowsQuery.isLoading ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-10">
                            <div className="flex justify-center">
                              <Spinner size="lg" color="primary" />
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : getAllFinRowsQuery.data?.finRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-10 text-gray-500">
                            Нет данных
                          </TableCell>
                        </TableRow>
                      ) : (
                        getAllFinRowsQuery.data?.finRows.map((finRow) => (
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
                                <div className="flex items-center gap-1">
                                  <span>{finRow.employee?.fullName}: </span>
                                  <span>{formatMoney(finRow.usdtAmount, finRow.currency)}</span>
                                </div>
                              ) : '—'}
                            </TableCell>
                            <TableCell>{finRow.comment || '—'}</TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button isIconOnly size="sm" variant="light" onClick={() => handleEditFinRow(finRow)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button isIconOnly size="sm" variant="light" color="danger" onClick={() => handleDeleteFinRow(finRow.id)}>
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
                
                {/* Pagination */}
                {getAllFinRowsQuery.data?.pagination && getAllFinRowsQuery.data.pagination.totalPages > 1 && (
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-sm text-gray-500">
                      Страница {currentPageIncome} из {getAllFinRowsQuery.data.pagination.totalPages}
                    </span>
                    <Pagination
                      total={getAllFinRowsQuery.data.pagination.totalPages}
                      initialPage={currentPageIncome}
                      page={currentPageIncome}
                      onChange={handleIncomePageChange}
                    />
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        )}
        
        {/* Expenses tab */}
        {activeTab === "expenses" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Fixed expenses */}
              <Card>
                <CardHeader className="flex justify-between items-center px-6 py-4">
                  <div>
                    <h2 className="text-xl font-bold">Постоянные расходы {activeSection !== "ALL" && (
                    <Badge color={activeSection === "PAYMENTS" ? "primary" : "warning"} className="ml-2">
                      {activeSection === "PAYMENTS" ? "Выплаты" : "Трактор"}
                    </Badge>
                  )}</h2>
                  <p className="text-sm text-gray-500">Постоянные расходы или расходы с фиксированной периодичностью</p>
                  </div>
                  <Button
                    color="primary"
                    startIcon={<Plus className="w-4 h-4" />}
                    onClick={() => {
                      setEditingExpenseId(null);
                      setExpenseForm({...expenseForm, expenseType: "fixed"});
                      setExpenseErrors({});
                      setIsExpenseDialogOpen(true);
                    }}
                  >
                    Добавить
                  </Button>
                </CardHeader>
                
                <CardBody className="px-6 py-4">
                  {/* Fixed expenses filters */}
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
                      >
                        <SelectItem key="" value="">Все валюты</SelectItem>
                        <SelectItem key="RUB" value="RUB">Рубли (₽)</SelectItem>
                        <SelectItem key="USDT" value="USDT">USDT</SelectItem>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Fixed expenses table */}
                  <div className="overflow-x-auto">
                    <Table>
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
                                  <Button isIconOnly size="sm" variant="light" onClick={() => handleEditExpense(expense)}>
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button isIconOnly size="sm" variant="light" color="danger" onClick={() => handleDeleteExpense(expense.id)}>
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
              
              {/* Variable expenses */}
              <Card>
                <CardHeader className="flex justify-between items-center px-6 py-4">
                  <div>
                    <h2 className="text-xl font-bold">Переменные расходы {activeSection !== "ALL" && (
                    <Badge color={activeSection === "PAYMENTS" ? "primary" : "warning"} className="ml-2">
                      {activeSection === "PAYMENTS" ? "Выплаты" : "Трактор"}
                    </Badge>
                  )}</h2>
                  <p className="text-sm text-gray-500">Переменные или разовые расходы</p>
                  </div>
                  <Button
                    color="primary"
                    startIcon={<Plus className="w-4 h-4" />}
                    onClick={() => {
                      setEditingExpenseId(null);
                      setExpenseForm({...expenseForm, expenseType: "variable"});
                      setExpenseErrors({});
                      setIsExpenseDialogOpen(true);
                    }}
                  >
                    Добавить
                  </Button>
                </CardHeader>
                
                <CardBody className="px-6 py-4">
                  {/* Variable expenses filters */}
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
                      >
                        <SelectItem key="" value="">Все валюты</SelectItem>
                        <SelectItem key="RUB" value="RUB">Рубли (₽)</SelectItem>
                        <SelectItem key="USDT" value="USDT">USDT</SelectItem>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Variable expenses table */}
                  <div className="overflow-x-auto">
                    <Table>
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
                                  <Button isIconOnly size="sm" variant="light" onClick={() => handleEditExpense(expense)}>
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button isIconOnly size="sm" variant="light" color="danger" onClick={() => handleDeleteExpense(expense.id)}>
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
            
            {/* Expense summary */}
            <Card>
              <CardHeader className="px-6 py-4">
                <h2 className="text-xl font-bold">Сводная информация по расходам</h2>
              </CardHeader>
              <CardBody className="px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Fixed expenses */}
                  <Card>
                    <CardHeader className="px-6 py-3">
                      <h3 className="text-lg font-bold">Постоянные расходы</h3>
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
                  
                  {/* Variable expenses */}
                  <Card>
                    <CardHeader className="px-6 py-3">
                      <h3 className="text-lg font-bold">Переменные расходы</h3>
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
                  
                  {/* Salary expenses */}
                  <Card>
                    <CardHeader className="px-6 py-3">
                      <h3 className="text-lg font-bold">Зарплатные расходы</h3>
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
                  
                  {/* Total expenses */}
                  <Card>
                    <CardHeader className="px-6 py-3">
                      <h3 className="text-lg font-bold">Общие расходы</h3>
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
        
        {/* Profit tab */}
        {activeTab === "report" && (
          <Card>
            <CardHeader className="px-6 py-4">
              <h2 className="text-xl font-bold">Отчет о прибыли</h2>
              <p className="text-sm text-gray-500">Анализ доходов, расходов и прибыли за выбранный период</p>
            </CardHeader>
            
            <CardBody className="px-6 py-4">
              {/* Report filters */}
              <form onSubmit={handleReportFilterSubmit} className="space-y-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Начальная дата</label>
                    <Input
                      type="date"
                      value={reportFilters.startDate}
                      onChange={(e) => handleReportFilterChange('startDate', e.target.value)}
                      startContent={<Calendar className="w-4 h-4 text-gray-500" />}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Конечная дата</label>
                    <Input
                      type="date"
                      value={reportFilters.endDate}
                      onChange={(e) => handleReportFilterChange('endDate', e.target.value)}
                      startContent={<Calendar className="w-4 h-4 text-gray-500" />}
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
              
              {/* Profit report cards */}
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Income card */}
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
                      </div>
                    </CardBody>
                  </Card>
                  
                  {/* Expenses card */}
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
                      
                      <div className="grid grid-cols-3 gap-2 text-sm">
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
                
                {/* Profit card */}
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
                    </div>
                  </CardBody>
                </Card>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
      
      {/* FinRow modal */}
      <Modal isOpen={isFinRowDialogOpen} onClose={() => setIsFinRowDialogOpen(false)} size="3xl" className="max-w-5xl">
        <ModalContent className="w-full max-w-5xl">
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
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Смена</label>
                  <Select
                    placeholder="Выберите смену"
                    selectedKeys={[finRowForm.shift]}
                    onChange={(e) => handleFinRowFormChange('shift', e.target.value)}
                    isInvalid={!!finRowErrors.shift}
                    errorMessage={finRowErrors.shift}
                  >
                    <SelectItem key="morning" value="morning">Утро</SelectItem>
                    <SelectItem key="evening" value="evening">Вечер</SelectItem>
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
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Section selection */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Секция</label>
                <Select
                  selectedKeys={[finRowForm.section]}
                  onChange={(e) => handleFinRowFormChange('section', e.target.value)}
                >
                  <SelectItem key="PAYMENTS" value="PAYMENTS">Выплаты</SelectItem>
                  <SelectItem key="TRACTOR" value="TRACTOR">Трактор</SelectItem>
                </Select>
              </div>
              
              {/* Employee payments */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-gray-700">Выплаты сотрудникам</label>
                  <Button size="sm" color="primary" variant="flat" onClick={addEmployeePayment} startIcon={<Plus className="w-4 h-4" />}>
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
                            isInvalid={finRowErrors.employeePayments && finRowErrors.employeePayments[`amount_${index}`]}
                            errorMessage={finRowErrors.employeePayments && finRowErrors.employeePayments[`amount_${index}`]}
                          />
                        </div>
                        
                        <div className="flex-none w-32">
                          <Select
                            selectedKeys={[payment.currency]}
                            onChange={(e) => updateEmployeePayment(index, 'currency', e.target.value)}
                          >
                            <SelectItem key="RUB" value="RUB">₽</SelectItem>
                            <SelectItem key="USDT" value="USDT">USDT</SelectItem>
                          </Select>
                        </div>
                        
                        <Button isIconOnly size="sm" variant="light" color="danger" onClick={() => removeEmployeePayment(index)}>
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
                />
              </div>
            </form>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" color="default" onClick={() => setIsFinRowDialogOpen(false)}>
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
                <>
                  {editingFinRowId ? 'Сохранить' : 'Добавить'} 
                  <Badge color={finRowForm.section === 'PAYMENTS' ? 'primary' : 'warning'} className="ml-2 px-2 py-1 text-xs">
                    {finRowForm.section === 'PAYMENTS' ? 'Выплаты' : 'Трактор'}
                  </Badge>
                </>
              )}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Expense modal */}
      <Modal isOpen={isExpenseDialogOpen} onClose={() => setIsExpenseDialogOpen(false)} size="2xl" className="max-w-3xl">
        <ModalContent className="w-full max-w-3xl">
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
                    placeholder="0.00"
                  />
                </div>
              </div>
              
              {/* Section selection for expenses */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Секция</label>
                <Select
                  selectedKeys={[expenseForm.section]}
                  onChange={(e) => handleExpenseFormChange('section', e.target.value)}
                >
                  <SelectItem key="PAYMENTS" value="PAYMENTS">Выплаты</SelectItem>
                  <SelectItem key="TRACTOR" value="TRACTOR">Трактор</SelectItem>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Описание</label>
                <Textarea
                  placeholder="Добавьте описание расхода (необязательно)"
                  value={expenseForm.description}
                  onChange={(e) => handleExpenseFormChange('description', e.target.value)}
                />
              </div>
            </form>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" color="default" onClick={() => setIsExpenseDialogOpen(false)}>
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
                <>
                  {editingExpenseId ? 'Сохранить' : 'Добавить'}
                  <Badge color={expenseForm.section === 'PAYMENTS' ? 'primary' : 'warning'} className="ml-2 px-2 py-1 text-xs">
                    {expenseForm.section === 'PAYMENTS' ? 'Выплаты' : 'Трактор'}
                  </Badge>
                </>
              )}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}