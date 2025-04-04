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
  ModalHeader,
  useDisclosure 
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Pagination } from "@heroui/pagination";
import { Spinner } from "@heroui/spinner";
import { Alert } from "@heroui/alert";
import { Textarea } from "@heroui/input";
import { Badge } from "@heroui/badge";
import { 
  Calendar, 
  User, 
  Plus, 
  CheckCircle, 
  AlertCircle, 
  Loader,
  DollarSign,
  Filter,
  Trash2,
  Edit,
  Eye,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  MoreHorizontal,
  Clock,
  Save,
  X
} from "lucide-react";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { Tooltip } from "@heroui/tooltip";
import { Divider } from "@heroui/divider";
import { Tabs, Tab } from "@heroui/tabs";
import dayjs from "dayjs";
import "dayjs/locale/ru"; // Импортируем русскую локаль
import localeData from "dayjs/plugin/localeData";

// Подключаем плагины
dayjs.extend(localeData);
dayjs.locale("ru"); // Устанавливаем русскую локаль

export default function SalaryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [selectedEarning, setSelectedEarning] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isEarningEditMode, setIsEarningEditMode] = useState(false);
  
  // Текущий раздел (Выплаты или Трактор)
  const [currentSection, setCurrentSection] = useState("PAYMENTS");
  
  // Использование useDisclosure для модальных окон
  const { 
    isOpen: isPaymentDialogOpen, 
    onOpen: openPaymentDialog, 
    onClose: closePaymentDialog 
  } = useDisclosure();
  
  const { 
    isOpen: isDebtDialogOpen, 
    onOpen: openDebtDialog, 
    onClose: closeDebtDialog 
  } = useDisclosure();
  
  const { 
    isOpen: isEarningDialogOpen, 
    onOpen: openEarningDialog, 
    onClose: closeEarningDialog 
  } = useDisclosure();
  
  const { 
    isOpen: isAddEmployeeDialogOpen, 
    onOpen: openAddEmployeeDialog, 
    onClose: closeAddEmployeeDialog 
  } = useDisclosure();
  
  const { 
    isOpen: isEditEmployeeDialogOpen, 
    onOpen: openEditEmployeeDialog, 
    onClose: closeEditEmployeeDialog 
  } = useDisclosure();
  
  // Состояния для дат фильтрации
  const [dateFilter, setDateFilter] = useState({
    startDate: "",
    endDate: ""
  });
  
  // Состояния для форм
  const [employeeForm, setEmployeeForm] = useState({
    fullName: "",
    position: "",
    startDate: dayjs().format("YYYY-MM-DD"),
    payday: 10,
    payday2: 20,  // Второй день выплаты (для TWICE_MONTH)
    payday3: 30,  // Третий день выплаты (для THRICE_MONTH)
    paydayMonth: "",
    fixedSalary: "",
    comment: "",
    periodic: "ONCE_MONTH",
    section: "PAYMENTS" // Раздел по умолчанию
  });
  
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentDate: dayjs().format("YYYY-MM-DD"),
    comment: ""
  });

  const [debtForm, setDebtForm] = useState({
    amount: "",
    debtDate: dayjs().format("YYYY-MM-DD"),
    description: ""
  });
  
  const [earningForm, setEarningForm] = useState({
    amount: "",
    earningDate: dayjs().format("YYYY-MM-DD"),
    description: ""
  });
  
  // Состояния для валидации
  const [employeeErrors, setEmployeeErrors] = useState({});
  const [paymentErrors, setPaymentErrors] = useState({});
  const [debtErrors, setDebtErrors] = useState({});
  const [earningErrors, setEarningErrors] = useState({});
  
  // Состояние для уведомлений
  const [alert, setAlert] = useState({
    isVisible: false,
    title: "",
    description: "",
    color: "default"
  });

  // Текущая вкладка в диалоговых окнах
  const [activeTab, setActiveTab] = useState("payments");

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

  // Запрос на получение списка сотрудников с пагинацией и фильтрацией
  const { data: employeesData, refetch: refetchEmployees, isLoading } = api.salary.getAllEmployees.useQuery({
    page: currentPage,
    pageSize,
    searchQuery,
    startDate: dateFilter.startDate || undefined,
    endDate: dateFilter.endDate || undefined,
    section: currentSection, // Фильтрация по текущему разделу
  }, {
    refetchOnWindowFocus: false,
    onError: (err) => {
      showAlert(
        "Ошибка при загрузке", 
        "Не удалось загрузить список сотрудников. " + err.message, 
        "danger"
      );
    }
  });

  // Получение выплат для выбранного сотрудника с учетом фильтра дат
  const paymentsQuery = api.salary.getEmployeePayments.useQuery(
    { 
      employeeId: selectedEmployee || 0,
      startDate: dateFilter.startDate ? new Date(dateFilter.startDate) : undefined,
      endDate: dateFilter.endDate ? new Date(dateFilter.endDate) : undefined
    },
    { enabled: !!selectedEmployee }
  );

  // Получение долгов для выбранного сотрудника
  const debtsQuery = api.salary.getEmployeeDebts.useQuery(
    { employeeId: selectedEmployee || 0 },
    { enabled: !!selectedEmployee }
  );

  // Получение заработков для выбранного сотрудника с учетом фильтра дат
  const earningsQuery = api.salary.getEmployeeEarnings.useQuery(
    { 
      employeeId: selectedEmployee || 0,
      startDate: dateFilter.startDate ? new Date(dateFilter.startDate) : undefined,
      endDate: dateFilter.endDate ? new Date(dateFilter.endDate) : undefined
    },
    { enabled: !!selectedEmployee }
  );

  // Детали выбранного сотрудника
  const employeeDetailsQuery = api.salary.getEmployeeById.useQuery(
    { employeeId: selectedEmployee || 0 },
    { enabled: !!selectedEmployee }
  );

  // Мутации для работы с данными
  const createEmployeeMutation = api.salary.createEmployee.useMutation({
    onSuccess: () => {
      // Закрываем модалку, обновляем список
      closeAddEmployeeDialog();
      setCurrentPage(1); // Возвращаемся на первую страницу
      refetchEmployees();
      // Сбрасываем форму
      setEmployeeForm({
        fullName: "",
        position: "",
        startDate: dayjs().format("YYYY-MM-DD"),
        payday: 10,
        payday2: 20,
        payday3: 30,
        paydayMonth: "",
        fixedSalary: "",
        comment: "",
        periodic: "ONCE_MONTH",
        section: currentSection // Устанавливаем текущий раздел
      });
      setEmployeeErrors({});
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при добавлении сотрудника: ${error.message}`, "danger");
    },
  });

  const updateEmployeeMutation = api.salary.updateEmployee.useMutation({
    onSuccess: () => {
      showAlert("Успешно", "Данные сотрудника успешно обновлены", "success");
      closeEditEmployeeDialog();
      refetchEmployees();
      // Сбросить форму
      setEmployeeForm({
        fullName: "",
        position: "",
        startDate: dayjs().format("YYYY-MM-DD"),
        payday: 10,
        payday2: 20,
        payday3: 30,
        paydayMonth: "",
        fixedSalary: "",
        comment: "",
        periodic: "ONCE_MONTH",
        section: currentSection // Устанавливаем текущий раздел
      });
      setEmployeeErrors({});
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при редактировании сотрудника: ${error.message}`, "danger");
    }
  });

  const deleteEmployeeMutation = api.salary.deleteEmployee.useMutation({
    onSuccess: () => {
      showAlert("Успешно", "Сотрудник успешно удален", "success");
      refetchEmployees();
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при удалении сотрудника: ${error.message}`, "danger");
    }
  });

  const addPaymentMutation = api.salary.addPayment.useMutation({
    onSuccess: () => {
      showAlert("Успешно", "Выплата успешно добавлена", "success");
      if (selectedEmployee) {
        paymentsQuery.refetch();
        refetchEmployees();
      }
      // Сбросить форму
      setPaymentForm({
        amount: "",
        paymentDate: dayjs().format("YYYY-MM-DD"),
        comment: ""
      });
      setPaymentErrors({});
      setIsEditMode(false);
      setSelectedPayment(null);
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при добавлении выплаты: ${error.message}`, "danger");
    },
  });

  const updatePaymentMutation = api.salary.updatePayment.useMutation({
    onSuccess: () => {
      showAlert("Успешно", "Выплата успешно обновлена", "success");
      if (selectedEmployee) {
        paymentsQuery.refetch();
        refetchEmployees();
      }
      setIsEditMode(false);
      setSelectedPayment(null);
      // Сбросить форму
      setPaymentForm({
        amount: "",
        paymentDate: dayjs().format("YYYY-MM-DD"),
        comment: ""
      });
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при обновлении выплаты: ${error.message}`, "danger");
    },
  });

  const deletePaymentMutation = api.salary.deletePayment.useMutation({
    onSuccess: () => {
      showAlert("Успешно", "Выплата успешно удалена", "success");
      if (selectedEmployee) {
        paymentsQuery.refetch();
        refetchEmployees();
      }
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при удалении выплаты: ${error.message}`, "danger");
    },
  });

  const addDebtMutation = api.salary.addDebt.useMutation({
    onSuccess: () => {
      showAlert("Успешно", "Долг успешно добавлен", "success");
      if (selectedEmployee) {
        debtsQuery.refetch();
        refetchEmployees();
      }
      // Сбросить форму
      setDebtForm({
        amount: "",
        debtDate: dayjs().format("YYYY-MM-DD"),
        description: ""
      });
      setDebtErrors({});
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при добавлении долга: ${error.message}`, "danger");
    },
  });

  const updateDebtMutation = api.salary.updateDebt.useMutation({
    onSuccess: () => {
      showAlert("Успешно", "Статус долга успешно обновлен", "success");
      if (selectedEmployee) {
        debtsQuery.refetch();
        refetchEmployees();
      }
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при обновлении долга: ${error.message}`, "danger");
    },
  });

  const deleteDebtMutation = api.salary.deleteDebt.useMutation({
    onSuccess: () => {
      showAlert("Успешно", "Долг успешно удален", "success");
      if (selectedEmployee) {
        debtsQuery.refetch();
        refetchEmployees();
      }
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при удалении долга: ${error.message}`, "danger");
    },
  });

  // Мутации для работы с заработками
  const addEarningMutation = api.salary.addEarning.useMutation({
    onSuccess: () => {
      showAlert("Успешно", "Заработок успешно добавлен", "success");
      if (selectedEmployee) {
        earningsQuery.refetch();
        refetchEmployees();
      }
      // Сбросить форму
      setEarningForm({
        amount: "",
        earningDate: dayjs().format("YYYY-MM-DD"),
        description: ""
      });
      setEarningErrors({});
      setIsEarningEditMode(false);
      setSelectedEarning(null);
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при добавлении заработка: ${error.message}`, "danger");
    },
  });

  const updateEarningMutation = api.salary.updateEarning.useMutation({
    onSuccess: () => {
      showAlert("Успешно", "Заработок успешно обновлен", "success");
      if (selectedEmployee) {
        earningsQuery.refetch();
        refetchEmployees();
      }
      setIsEarningEditMode(false);
      setSelectedEarning(null);
      // Сбросить форму
      setEarningForm({
        amount: "",
        earningDate: dayjs().format("YYYY-MM-DD"),
        description: ""
      });
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при обновлении заработка: ${error.message}`, "danger");
    },
  });

  const deleteEarningMutation = api.salary.deleteEarning.useMutation({
    onSuccess: () => {
      showAlert("Успешно", "Заработок успешно удален", "success");
      if (selectedEmployee) {
        earningsQuery.refetch();
        refetchEmployees();
      }
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при удалении заработка: ${error.message}`, "danger");
    },
  });

  // Валидация формы сотрудника
  const validateEmployeeForm = () => {
    const errors = {};
    
    if (!employeeForm.fullName || employeeForm.fullName.length < 2) {
      errors.fullName = "ФИО должно содержать минимум 2 символа";
    }
    
    if (!employeeForm.position || employeeForm.position.length < 2) {
      errors.position = "Должность должна содержать минимум 2 символа";
    }
    
    if (!employeeForm.startDate) {
      errors.startDate = "Укажите дату начала работы";
    }
    
    if (!employeeForm.payday || employeeForm.payday < 1 || employeeForm.payday > 31) {
      errors.payday = "Первый день выплаты должен быть от 1 до 31";
    }
    
    // Проверка второго дня выплаты для TWICE_MONTH и THRICE_MONTH
    if ((employeeForm.periodic === "TWICE_MONTH" || employeeForm.periodic === "THRICE_MONTH") && 
        (!employeeForm.payday2 || employeeForm.payday2 < 1 || employeeForm.payday2 > 31)) {
      errors.payday2 = "Второй день выплаты должен быть от 1 до 31";
    }
    
    // Проверка третьего дня выплаты для THRICE_MONTH
    if (employeeForm.periodic === "THRICE_MONTH" && 
        (!employeeForm.payday3 || employeeForm.payday3 < 1 || employeeForm.payday3 > 31)) {
      errors.payday3 = "Третий день выплаты должен быть от 1 до 31";
    }
    
    if (employeeForm.paydayMonth && (employeeForm.paydayMonth < 1 || employeeForm.paydayMonth > 12)) {
      errors.paydayMonth = "Месяц должен быть от 1 до 12";
    }
    
    if (employeeForm.fixedSalary && parseFloat(employeeForm.fixedSalary) <= 0) {
      errors.fixedSalary = "Зарплата должна быть положительным числом";
    }
    
    setEmployeeErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Валидация формы выплаты
  const validatePaymentForm = () => {
    const errors = {};
    
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      errors.amount = "Сумма должна быть положительным числом";
    }
    
    if (!paymentForm.paymentDate) {
      errors.paymentDate = "Укажите дату выплаты";
    }
    
    setPaymentErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Валидация формы долга
  const validateDebtForm = () => {
    const errors = {};
    
    if (!debtForm.amount || parseFloat(debtForm.amount) <= 0) {
      errors.amount = "Сумма долга должна быть положительным числом";
    }
    
    if (!debtForm.debtDate) {
      errors.debtDate = "Укажите дату долга";
    }
    
    setDebtErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Валидация формы заработка
  const validateEarningForm = () => {
    const errors = {};
    
    if (!earningForm.amount || parseFloat(earningForm.amount) <= 0) {
      errors.amount = "Сумма заработка должна быть положительным числом";
    }
    
    if (!earningForm.earningDate) {
      errors.earningDate = "Укажите дату заработка";
    }
    
    setEarningErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Обработчики форм
  const handleEmployeeSubmit = (e) => {
    e.preventDefault();
    
    if (!validateEmployeeForm()) {
      return;
    }
    
    createEmployeeMutation.mutate({
      fullName: employeeForm.fullName,
      position: employeeForm.position,
      startDate: new Date(employeeForm.startDate),
      payday: parseInt(employeeForm.payday),
      payday2: employeeForm.periodic !== "ONCE_MONTH" ? parseInt(employeeForm.payday2) : undefined,
      payday3: employeeForm.periodic === "THRICE_MONTH" ? parseInt(employeeForm.payday3) : undefined,
      paydayMonth: employeeForm.paydayMonth ? parseInt(employeeForm.paydayMonth) : undefined,
      fixedSalary: employeeForm.fixedSalary ? parseFloat(employeeForm.fixedSalary) : undefined,
      comment: employeeForm.comment,
      periodic: employeeForm.periodic,
      section: currentSection // Всегда используем текущий раздел
    });
  };

  const handlePaymentSubmit = (e) => {
    e.preventDefault();
    
    if (!validatePaymentForm()) {
      return;
    }
    
    if (!selectedEmployee) return;
    
    if (isEditMode && selectedPayment) {
      // Обновляем существующую выплату
      updatePaymentMutation.mutate({
        paymentId: selectedPayment,
        amount: parseFloat(paymentForm.amount),
        paymentDate: new Date(paymentForm.paymentDate),
        comment: paymentForm.comment,
      });
    } else {
      // Добавляем новую выплату
      addPaymentMutation.mutate({
        salaryId: selectedEmployee,
        amount: parseFloat(paymentForm.amount),
        paymentDate: new Date(paymentForm.paymentDate),
        comment: paymentForm.comment,
      });
    }
  };

  const handleDebtSubmit = (e) => {
    e.preventDefault();
    
    if (!validateDebtForm()) {
      return;
    }
    
    if (!selectedEmployee) return;
    
    addDebtMutation.mutate({
      salaryId: selectedEmployee,
      amount: parseFloat(debtForm.amount),
      debtDate: new Date(debtForm.debtDate),
      description: debtForm.description,
    });
  };

  // Обработчик формы заработка
  const handleEarningSubmit = (e) => {
    e.preventDefault();
    
    if (!validateEarningForm()) {
      return;
    }
    
    if (!selectedEmployee) return;
    
    if (isEarningEditMode && selectedEarning) {
      // Обновляем существующий заработок
      updateEarningMutation.mutate({
        earningId: selectedEarning,
        amount: parseFloat(earningForm.amount),
        earningDate: new Date(earningForm.earningDate),
        description: earningForm.description,
      });
    } else {
      // Добавляем новый заработок
      addEarningMutation.mutate({
        salaryId: selectedEmployee,
        amount: parseFloat(earningForm.amount),
        earningDate: new Date(earningForm.earningDate),
        description: earningForm.description,
      });
    }
  };

  // Обработчик редактирования выплаты
  const handleEditPayment = (payment) => {
    setSelectedPayment(payment.id);
    setPaymentForm({
      amount: payment.amount.toString(),
      paymentDate: dayjs(payment.paymentDate).format("YYYY-MM-DD"),
      comment: payment.comment || ""
    });
    setIsEditMode(true);
  };

  // Обработчик редактирования заработка
  const handleEditEarning = (earning) => {
    setSelectedEarning(earning.id);
    setEarningForm({
      amount: earning.amount.toString(),
      earningDate: dayjs(earning.earningDate).format("YYYY-MM-DD"),
      description: earning.description || ""
    });
    setIsEarningEditMode(true);
  };

  // Обработчик удаления выплаты
  const handleDeletePayment = (paymentId) => {
    if (confirm("Вы уверены, что хотите удалить эту выплату?")) {
      deletePaymentMutation.mutate({ paymentId });
    }
  };

  // Обработчик удаления заработка
  const handleDeleteEarning = (earningId) => {
    if (confirm("Вы уверены, что хотите удалить этот заработок?")) {
      deleteEarningMutation.mutate({ earningId });
    }
  };

  // Отмена редактирования выплаты
  const cancelEditPayment = () => {
    setIsEditMode(false);
    setSelectedPayment(null);
    setPaymentForm({
      amount: "",
      paymentDate: dayjs().format("YYYY-MM-DD"),
      comment: ""
    });
  };

  // Отмена редактирования заработка
  const cancelEditEarning = () => {
    setIsEarningEditMode(false);
    setSelectedEarning(null);
    setEarningForm({
      amount: "",
      earningDate: dayjs().format("YYYY-MM-DD"),
      description: ""
    });
  };

  // Изменение статуса долга (оплачен/не оплачен)
  const handleToggleDebtStatus = (debtId, currentStatus) => {
    updateDebtMutation.mutate({
      debtId,
      isPaid: !currentStatus
    });
  };

  // Удаление долга
  const handleDeleteDebt = (debtId) => {
    if (confirm("Вы уверены, что хотите удалить этот долг?")) {
      deleteDebtMutation.mutate({ debtId });
    }
  };

  // Обработчики полей форм
  const handleEmployeeFormChange = (field, value) => {
    setEmployeeForm(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const handlePaymentFormChange = (field, value) => {
    setPaymentForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleDebtFormChange = (field, value) => {
    setDebtForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEarningFormChange = (field, value) => {
    setEarningForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Обработка фильтра дат
  const handleDateFilterChange = (field, value) => {
    setDateFilter(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Применение фильтра дат
  const applyDateFilter = () => {
    refetchEmployees();
    if (selectedEmployee) {
      paymentsQuery.refetch();
      earningsQuery.refetch();
    }
  };

  // Сброс фильтра дат
  const resetDateFilter = () => {
    setDateFilter({
      startDate: "",
      endDate: ""
    });
    
    refetchEmployees();
    if (selectedEmployee) {
      paymentsQuery.refetch();
      earningsQuery.refetch();
    }
  };

  // Открытие модального окна выплат
  const handleOpenPaymentDialog = (employeeId) => {
    setSelectedEmployee(employeeId);
    setActiveTab("payments");
    openPaymentDialog();
  };

  // Открытие модального окна долгов
  const handleOpenDebtDialog = (employeeId) => {
    setSelectedEmployee(employeeId);
    setActiveTab("debts");
    openDebtDialog();
  };

  // Открытие модального окна заработков
  const handleOpenEarningDialog = (employeeId) => {
    setSelectedEmployee(employeeId);
    setActiveTab("earnings");
    openEarningDialog();
  };

  // Открытие модального окна редактирования сотрудника
  const handleEditEmployee = (employee) => {
    setSelectedEmployee(employee.id);
    // Заполняем форму данными сотрудника
    setEmployeeForm({
      fullName: employee.fullName,
      position: employee.position,
      startDate: dayjs(employee.startDate).format("YYYY-MM-DD"),
      payday: employee.payday,
      payday2: employee.payday2 || 20, // Второй день выплаты (используем значение из БД или дефолтное)
      payday3: employee.payday3 || 30, // Третий день выплаты (используем значение из БД или дефолтное)
      paydayMonth: employee.paydayMonth ? employee.paydayMonth.toString() : "",
      fixedSalary: employee.fixedSalary ? employee.fixedSalary.toString() : "",
      comment: employee.comment || "",
      periodic: employee.periodic,
      section: employee.section || "PAYMENTS" // Раздел сотрудника
    });
    openEditEmployeeDialog();
  };

  // Обработка пагинации
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Форматирование даты в российском формате
  const formatDate = (date) => {
    return dayjs(date).format("DD.MM.YYYY");
  };

  // Получение строки с информацией о дне выплаты
  const getPaydayInfo = (employee) => {
    if (employee.paydayMonth) {
      return `${employee.payday} ${getMonthName(employee.paydayMonth)}`;
    }
    return `${employee.payday} число каждого месяца`;
  };

  // Получение названия месяца в родительном падеже
  const getMonthName = (monthNumber) => {
    const months = [
      "января", "февраля", "марта", "апреля", "мая", "июня",
      "июля", "августа", "сентября", "октября", "ноября", "декабря"
    ];
    return months[monthNumber - 1];
  };

  // Форматирование суммы в российском формате
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(amount);
  };

  // Получение текста периода для отображения
  const getPeriodText = () => {
    if (dateFilter.startDate && dateFilter.endDate) {
      return `${formatDate(dateFilter.startDate)} - ${formatDate(dateFilter.endDate)}`;
    } else if (dateFilter.startDate) {
      return `с ${formatDate(dateFilter.startDate)}`;
    } else if (dateFilter.endDate) {
      return `по ${formatDate(dateFilter.endDate)}`;
    }
    return "за все время";
  };

  // Получение имени сотрудника по ID
  const getEmployeeName = (id) => {
    const employee = employeesData?.employees.find(emp => emp.id === id);
    return employee ? employee.fullName : "...";
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Шапка страницы с заголовком и кнопками */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <h1 className="text-2xl font-bold mb-4 sm:mb-0">
          Управление зарплатами - {currentSection === "PAYMENTS" ? "Раздел выплат" : "Раздел трактор"}
        </h1>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
          <Button 
            color="primary"
            startIcon={<Plus className="w-4 h-4" />}
            onClick={openAddEmployeeDialog}
            size="sm"
          >
            Добавить сотрудника
          </Button>
        </div>
      </div>
      
      {/* Переключатель разделов */}
      <div className="mb-6">
        <Tabs 
          selectedKey={currentSection} 
          onSelectionChange={setCurrentSection}
          aria-label="Разделы зарплат"
          classNames={{
            base: "w-full",
            tabList: "bg-gray-100 dark:bg-zinc-800 rounded-lg p-1",
            tab: "data-[selected=true]:bg-white dark:data-[selected=true]:bg-zinc-700 data-[selected=true]:text-blue-600 dark:data-[selected=true]:text-blue-400 py-2 px-4 rounded-md font-medium"
          }}
        >
          <Tab key="PAYMENTS" title="Раздел выплат" />
          <Tab key="TRACTOR" title="Раздел трактор" />
        </Tabs>
      </div>
      
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
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">Зарплаты сотрудников</h1>
        <div className="flex gap-2">
          <Button
            color="primary"
            startIcon={<Plus className="w-4 h-4" />}
            onClick={openAddEmployeeDialog}
          >
            Добавить сотрудника
          </Button>
          <Button
            variant="outline"
            startIcon={<RefreshCw className="w-4 h-4" />}
            onClick={() => refetchEmployees()}
            isLoading={isLoading}
          >
            Обновить
          </Button>
        </div>
      </div>

      {/* Поиск и фильтры */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
            <div className="w-full md:w-1/3">
              <label className="text-sm text-gray-600 mb-1 block">Поиск сотрудника</label>
              <Input
                placeholder="Поиск по ФИО или должности..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                fullWidth
                aria-label="Поиск по ФИО или должности"
                startContent={<User className="w-4 h-4 text-gray-400" />}
              />
            </div>
            
            <div className="flex flex-col md:flex-row gap-2 items-end w-full md:w-2/3">
              <div className="space-y-1 w-full">
                <label className="text-sm text-gray-600">Начало периода</label>
                <Input
                  type="date"
                  value={dateFilter.startDate}
                  onChange={(e) => handleDateFilterChange('startDate', e.target.value)}
                  startContent={<Calendar className="w-4 h-4 text-gray-400" />}
                  aria-label="Дата начала периода"
                  fullWidth
                />
              </div>
              
              <div className="space-y-1 w-full">
                <label className="text-sm text-gray-600">Конец периода</label>
                <Input
                  type="date"
                  value={dateFilter.endDate}
                  onChange={(e) => handleDateFilterChange('endDate', e.target.value)}
                  startContent={<Calendar className="w-4 h-4 text-gray-400" />}
                  aria-label="Дата конца периода"
                  fullWidth
                />
              </div>
              
              <div className="flex gap-2">
                <Button
                  color="primary"
                  onClick={applyDateFilter}
                  startIcon={<Filter className="w-4 h-4" />}
                >
                  Применить
                </Button>
                
                <Button
                  variant="flat"
                  onClick={resetDateFilter}
                >
                  Сбросить
                </Button>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
      
      {/* Информация о периоде */}
      {(dateFilter.startDate || dateFilter.endDate) && (
        <div className="mb-4 bg-blue-50 p-3 rounded-lg">
          <div className="flex items-center text-blue-700">
            <Clock className="h-4 w-4 mr-2" />
            <span className="text-sm font-medium">Данные показаны {getPeriodText()}</span>
          </div>
        </div>
      )}
      
      <Card>
        <CardHeader className="pb-0">
          <h2 className="text-lg font-medium">
            Список сотрудников - {currentSection === "PAYMENTS" ? "Раздел выплат" : "Раздел трактор"}
          </h2>
        </CardHeader>
        <CardBody className="p-0">
          <Table aria-label="Таблица сотрудников">
            <TableHeader>
              <TableColumn>ФИО</TableColumn>
              <TableColumn>Должность</TableColumn>
              <TableColumn>Дата начала работы</TableColumn>
              <TableColumn>День выплаты</TableColumn>
              <TableColumn>Фиксированная зарплата</TableColumn>
              <TableColumn>Выплаты {getPeriodText()}</TableColumn>
              <TableColumn>Долги {getPeriodText()}</TableColumn>
              <TableColumn>Заработки {getPeriodText()}</TableColumn>
              <TableColumn>Действия</TableColumn>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10">
                    <div className="flex justify-center">
                      <Spinner size="lg" color="primary" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : employeesData?.employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-gray-500">
                    Нет данных о сотрудниках
                  </TableCell>
                </TableRow>
              ) : (
                employeesData?.employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <div className="font-medium">{employee.fullName}</div>
                    </TableCell>
                    <TableCell>{employee.position}</TableCell>
                    <TableCell>{formatDate(employee.startDate)}</TableCell>
                    <TableCell>{getPaydayInfo(employee)}</TableCell>
                    <TableCell>
                      {employee.fixedSalary 
                        ? formatCurrency(employee.fixedSalary)
                        : "—"
                      }
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        onClick={() => handleOpenPaymentDialog(employee.id)}
                        className="text-left w-full justify-start hover:bg-transparent hover:underline h-auto p-0"
                      >
                        {employee.payments && employee.payments.length > 0 ? (
                          <div>
                            <div className="font-medium text-primary">
                              {formatCurrency(employee.payments[0].totalPayments)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {employee.payments[0].paymentsCount} {
                                employee.payments[0].paymentsCount === 1 ? "выплата" : 
                                employee.payments[0].paymentsCount < 5 ? "выплаты" : "выплат"
                              }
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-500">Нет выплат</span>
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        onClick={() => handleOpenDebtDialog(employee.id)}
                        className="text-left w-full justify-start hover:bg-transparent hover:underline h-auto p-0"
                        color={employee.totalDebts > 0 ? "danger" : "default"}
                      >
                        {employee.totalDebts > 0 ? (
                          <div>
                            <div className="flex items-center font-medium text-danger">
                              <DollarSign className="w-4 h-4 mr-1" />
                              <span>{formatCurrency(employee.totalDebts)}</span>
                            </div>
                            <div className="text-xs text-gray-500">
                              {employee.debts.length} {
                                employee.debts.length === 1 ? "долг" : 
                                employee.debts.length < 5 ? "долга" : "долгов"
                              }
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-500">Нет долгов</span>
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        onClick={() => handleOpenEarningDialog(employee.id)}
                        className="text-left w-full justify-start hover:bg-transparent hover:underline h-auto p-0"
                      >
                        {employee.totalEarning > 0 ? (
                          <div>
                            <div className="font-medium text-success">
                              {formatCurrency(employee.totalEarning)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {employee.earningsCount} {
                                employee.earningsCount === 1 ? "заработок" : 
                                employee.earningsCount < 5 ? "заработка" : "заработков"
                              }
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-500">Нет заработков</span>
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Dropdown>
                        <DropdownTrigger>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            isIconOnly
                          >
                            <MoreHorizontal className="h-5 w-5" />
                          </Button>
                        </DropdownTrigger>
                        <DropdownMenu aria-label="Действия">
                          <DropdownItem 
                            startContent={<Eye className="w-4 h-4 mr-2" />}
                            onClick={() => handleOpenPaymentDialog(employee.id)}
                          >
                            Выплаты
                          </DropdownItem>
                          <DropdownItem 
                            startContent={<DollarSign className="w-4 h-4 mr-2" />}
                            onClick={() => handleOpenDebtDialog(employee.id)}
                          >
                            Долги
                          </DropdownItem>
                          <DropdownItem 
                            startContent={<DollarSign className="w-4 h-4 mr-2" />}
                            onClick={() => handleOpenEarningDialog(employee.id)}
                          >
                            Заработки
                          </DropdownItem>
                          <DropdownItem 
                            startContent={<Edit className="w-4 h-4 mr-2" />}
                            onClick={() => handleEditEmployee(employee)}
                          >
                            Редактировать сотрудника
                          </DropdownItem>
                          <DropdownItem 
                            startContent={<Trash2 className="w-4 h-4 mr-2" />}
                            onClick={() => {
                              if (confirm("Вы уверены, что хотите удалить этого сотрудника?")) {
                                deleteEmployeeMutation.mutate({ id: employee.id });
                              }
                            }}
                          >
                            Удалить сотрудника
                          </DropdownItem>
                        </DropdownMenu>
                      </Dropdown>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardBody>
        
        {/* Пагинация */}
        {employeesData && employeesData.pagination.totalPages > 1 && (
          <CardFooter className="flex justify-between px-6 py-4">
            <div className="text-sm text-gray-500">
              Страница {currentPage} из {employeesData.pagination.totalPages}
            </div>
            <Pagination
              total={employeesData.pagination.totalPages}
              initialPage={currentPage}
              page={currentPage}
              onChange={handlePageChange}
              aria-label="Пагинация списка сотрудников"
              showControls
              color="primary"
              size="sm"
            />
          </CardFooter>
        )}
      </Card>

      {/* Объединенное модальное окно для выплат, долгов и заработков */}
      <Modal 
        isOpen={isPaymentDialogOpen || isDebtDialogOpen || isEarningDialogOpen} 
        onClose={() => {
          if (isPaymentDialogOpen) closePaymentDialog();
          if (isDebtDialogOpen) closeDebtDialog();
          if (isEarningDialogOpen) closeEarningDialog();
          setIsEditMode(false);
          setIsEarningEditMode(false);
          setSelectedPayment(null);
          setSelectedEarning(null);
        }}
        size="2xl" // Делаем диалог широким
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex flex-col">
              <h3 className="text-lg font-medium">Управление выплатами, долгами и заработками</h3>
              {employeeDetailsQuery.data?.employee && (
                <div className="space-y-1">
                  <p className="text-sm text-gray-700 font-medium">
                    {employeeDetailsQuery.data.employee.fullName}
                  </p>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500">
                    <span className="flex items-center">
                      <User className="w-3.5 h-3.5 mr-1" />
                      {employeeDetailsQuery.data.employee.position}
                    </span>
                    <span className="flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1" />
                      Работает с {formatDate(employeeDetailsQuery.data.employee.startDate)}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <Tabs 
              color="primary" 
              variant="underlined"
              selectedKey={activeTab}
              onSelectionChange={setActiveTab}
              className="w-full mt-4"
            >
              <Tab key="payments" title="Выплаты" />
              <Tab key="debts" title="Долги" />
              <Tab key="earnings" title="Заработки" />
            </Tabs>
          </ModalHeader>
          <ModalBody>
            {/* Период выплат */}
            <div className="flex flex-col md:flex-row gap-4 items-end mb-4">
              <div className="space-y-1 flex-grow">
                <label className="text-sm font-medium text-gray-700">Период</label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="date"
                    value={dateFilter.startDate}
                    onChange={(e) => handleDateFilterChange('startDate', e.target.value)}
                    startContent={<Calendar className="w-4 h-4 text-gray-400" />}
                    aria-label="Дата начала периода"
                    className="w-full"
                    size="sm"
                  />
                  <span>—</span>
                  <Input
                    type="date"
                    value={dateFilter.endDate}
                    onChange={(e) => handleDateFilterChange('endDate', e.target.value)}
                    startContent={<Calendar className="w-4 h-4 text-gray-400" />}
                    aria-label="Дата конца периода"
                    className="w-full"
                    size="sm"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  color="primary"
                  size="sm"
                  onClick={() => {
                    if (selectedEmployee) {
                      paymentsQuery.refetch();
                      debtsQuery.refetch();
                      earningsQuery.refetch();
                    }
                  }}
                  startIcon={<Filter className="w-4 h-4" />}
                >
                  Применить
                </Button>
                
                <Button
                  variant="flat"
                  size="sm"
                  onClick={() => {
                    setDateFilter({
                      startDate: "",
                      endDate: ""
                    });
                    if (selectedEmployee) {
                      paymentsQuery.refetch();
                      debtsQuery.refetch();
                      earningsQuery.refetch();
                    }
                  }}
                >
                  Сбросить
                </Button>
              </div>
            </div>
            
            {activeTab === "payments" && (
              <div className="space-y-4">
                {/* Общая информация о выплатах */}
                {paymentsQuery.data?.totalSum > 0 && (
                  <div className="bg-blue-50 dark:bg-zinc-800 p-4 rounded-lg mb-4">
                    <div className="flex items-center">
                      <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
                      <div>
                        <p className="text-blue-600 dark:text-blue-400 font-medium">
                          Общая сумма выплат {getPeriodText()}: {formatCurrency(paymentsQuery.data.totalSum)}
                        </p>
                        <p className="text-sm text-blue-500 dark:text-zinc-400">
                          Количество выплат: {paymentsQuery.data.payments.length}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <h3 className="text-md font-medium">Список выплат</h3>
                </div>
                
                {paymentsQuery.isLoading ? (
                  <div className="flex justify-center py-8">
                    <Spinner size="lg" color="primary" />
                  </div>
                ) : paymentsQuery.data?.payments.length === 0 ? (
                  <div className="bg-gray-50 dark:bg-zinc-800 text-center py-8 rounded-lg">
                    <p className="text-gray-500">
                      Нет данных о выплатах{dateFilter.startDate || dateFilter.endDate ? " за выбранный период" : ""}
                    </p>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-auto border dark:border-zinc-700 rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableColumn>Дата</TableColumn>
                        <TableColumn>Сумма</TableColumn>
                        <TableColumn>Комментарий</TableColumn>
                        <TableColumn width={120}>Действия</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {paymentsQuery.data?.payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                            <TableCell>
                              <span className="font-medium">{formatCurrency(payment.amount)}</span>
                            </TableCell>
                            <TableCell>{payment.comment || "—"}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Tooltip content="Редактировать">
                                  <Button 
                                    size="sm" 
                                    isIconOnly
                                    variant="flat"
                                    onClick={() => handleEditPayment(payment)}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                </Tooltip>
                                <Tooltip content="Удалить">
                                  <Button 
                                    size="sm" 
                                    isIconOnly
                                    variant="flat"
                                    color="danger"
                                    onClick={() => handleDeletePayment(payment.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                
                <Divider className="my-4" />
                
                <form onSubmit={handlePaymentSubmit} className="space-y-4 pt-2">
                  <h3 className="text-md font-medium">
                    {isEditMode ? "Редактировать выплату" : "Добавить выплату"}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Сумма выплаты</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={paymentForm.amount}
                        onChange={(e) => handlePaymentFormChange('amount', e.target.value)}
                        isInvalid={!!paymentErrors.amount}
                        errorMessage={paymentErrors.amount}
                        aria-label="Сумма выплаты"
                        startContent={<DollarSign className="w-4 h-4 text-gray-400" />}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Дата выплаты</label>
                      <Input
                        type="date"
                        value={paymentForm.paymentDate}
                        onChange={(e) => handlePaymentFormChange('paymentDate', e.target.value)}
                        isInvalid={!!paymentErrors.paymentDate}
                        errorMessage={paymentErrors.paymentDate}
                        startContent={<Calendar className="w-4 h-4 text-gray-400" />}
                        aria-label="Дата выплаты"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Комментарий</label>
                    <Textarea
                      placeholder="Добавьте комментарий к выплате (необязательно)"
                      value={paymentForm.comment}
                      onChange={(e) => handlePaymentFormChange('comment', e.target.value)}
                      aria-label="Комментарий к выплате"
                      size="sm"
                      rows={2}
                    />
                  </div>

                  <div className="flex justify-end gap-2 mt-4">
                    {isEditMode && (
                      <Button
                        variant="flat"
                        onClick={cancelEditPayment}
                        startIcon={<X className="w-4 h-4" />}
                      >
                        Отменить
                      </Button>
                    )}
                    <Button
                      color="primary"
                      type="submit"
                      isLoading={addPaymentMutation.isLoading || updatePaymentMutation.isLoading}
                      startIcon={isEditMode ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    >
                      {isEditMode ? "Сохранить изменения" : "Добавить выплату"}
                    </Button>
                  </div>
                </form>
              </div>
            )}
            
            {activeTab === "debts" && (
              <div className="space-y-4">
                {/* Общая информация о долгах */}
                {debtsQuery.data?.totalDebt > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg mb-4">
                    <div className="flex items-center">
                      <DollarSign className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
                      <div>
                        <p className="text-red-600 dark:text-red-400 font-medium">
                          Общая сумма долгов: {formatCurrency(debtsQuery.data.totalDebt)}
                        </p>
                        <p className="text-sm text-red-500 dark:text-red-400">
                          Неоплаченных долгов: {debtsQuery.data.debts.filter(d => !d.isPaid).length}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <h3 className="text-md font-medium">Список долгов</h3>
                </div>
                
                {debtsQuery.isLoading ? (
                  <div className="flex justify-center py-8">
                    <Spinner size="lg" color="primary" />
                  </div>
                ) : debtsQuery.data?.debts.length === 0 ? (
                  <div className="bg-gray-50 dark:bg-gray-900/20 text-center py-8 rounded-lg">
                    <p className="text-gray-500">
                      Нет данных о долгах
                    </p>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableColumn>Дата</TableColumn>
                        <TableColumn>Сумма</TableColumn>
                        <TableColumn>Описание</TableColumn>
                        <TableColumn>Статус</TableColumn>
                        <TableColumn>Действия</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {debtsQuery.data?.debts.map((debt) => (
                          <TableRow key={debt.id}>
                            <TableCell>{formatDate(debt.debtDate)}</TableCell>
                            <TableCell>
                              <span className="font-medium">{formatCurrency(debt.amount)}</span>
                            </TableCell>
                            <TableCell>{debt.description || "—"}</TableCell>
                            <TableCell>
                              <Badge color={debt.isPaid ? "success" : "danger"} variant="flat">
                                {debt.isPaid ? "Оплачен" : "Не оплачен"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Tooltip content={debt.isPaid ? "Отметить как неоплаченный" : "Отметить как оплаченный"}>
                                  <Button 
                                    size="sm" 
                                    isIconOnly
                                    variant="flat"
                                    color={debt.isPaid ? "default" : "success"}
                                    onClick={() => handleToggleDebtStatus(debt.id, debt.isPaid)}
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </Button>
                                </Tooltip>
                                <Tooltip content="Удалить">
                                  <Button 
                                    size="sm" 
                                    isIconOnly
                                    variant="flat"
                                    color="danger"
                                    onClick={() => handleDeleteDebt(debt.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                
                <Divider className="my-4" />
                
                <form onSubmit={handleDebtSubmit} className="space-y-4 pt-2">
                  <h3 className="text-md font-medium">Добавить долг</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Сумма долга</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={debtForm.amount}
                        onChange={(e) => handleDebtFormChange('amount', e.target.value)}
                        isInvalid={!!debtErrors.amount}
                        errorMessage={debtErrors.amount}
                        aria-label="Сумма долга"
                        startContent={<DollarSign className="w-4 h-4 text-gray-400" />}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Дата долга</label>
                      <Input
                        type="date"
                        value={debtForm.debtDate}
                        onChange={(e) => handleDebtFormChange('debtDate', e.target.value)}
                        isInvalid={!!debtErrors.debtDate}
                        errorMessage={debtErrors.debtDate}
                        startContent={<Calendar className="w-4 h-4 text-gray-400" />}
                        aria-label="Дата долга"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Описание</label>
                    <Textarea
                      placeholder="Добавьте описание долга (необязательно)"
                      value={debtForm.description}
                      onChange={(e) => handleDebtFormChange('description', e.target.value)}
                      aria-label="Описание долга"
                      size="sm"
                      rows={2}
                    />
                  </div>

                  <div className="flex justify-end mt-4">
                    <Button
                      color="primary"
                      type="submit"
                      isLoading={addDebtMutation.isLoading}
                      startIcon={<Plus className="w-4 h-4" />}
                    >
                      Добавить долг
                    </Button>
                  </div>
                </form>
              </div>
            )}
            
            {/* Вкладка заработков */}
            {activeTab === "earnings" && (
              <div className="space-y-4">
                {/* Общая информация о заработках */}
                {earningsQuery.data?.totalSum > 0 && (
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg mb-4">
                    <div className="flex items-center">
                      <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
                      <div>
                        <p className="text-green-600 dark:text-green-400 font-medium">
                          Общая сумма заработков {getPeriodText()}: {formatCurrency(earningsQuery.data.totalSum)}
                        </p>
                        <p className="text-sm text-green-500 dark:text-green-400">
                          Количество заработков: {earningsQuery.data.earnings.length}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <h3 className="text-md font-medium">Список заработков</h3>
                </div>
                
                {earningsQuery.isLoading ? (
                  <div className="flex justify-center py-8">
                    <Spinner size="lg" color="primary" />
                  </div>
                ) : earningsQuery.data?.earnings.length === 0 ? (
                  <div className="bg-gray-50 dark:bg-gray-900/20 text-center py-8 rounded-lg">
                    <p className="text-gray-500">
                      Нет данных о заработках{dateFilter.startDate || dateFilter.endDate ? " за выбранный период" : ""}
                    </p>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableColumn>Дата</TableColumn>
                        <TableColumn>Сумма</TableColumn>
                        <TableColumn>Описание</TableColumn>
                        <TableColumn width={120}>Действия</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {earningsQuery.data?.earnings.map((earning) => (
                          <TableRow key={earning.id}>
                            <TableCell>{formatDate(earning.earningDate)}</TableCell>
                            <TableCell>
                              <span className="font-medium">{formatCurrency(earning.amount)}</span>
                            </TableCell>
                            <TableCell>{earning.description || "—"}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Tooltip content="Редактировать">
                                  <Button 
                                    size="sm" 
                                    isIconOnly
                                    variant="flat"
                                    onClick={() => handleEditEarning(earning)}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                </Tooltip>
                                <Tooltip content="Удалить">
                                  <Button 
                                    size="sm" 
                                    isIconOnly
                                    variant="flat"
                                    color="danger"
                                    onClick={() => handleDeleteEarning(earning.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                
                <Divider className="my-4" />
                
                <form onSubmit={handleEarningSubmit} className="space-y-4 pt-2">
                  <h3 className="text-md font-medium">
                    {isEarningEditMode ? "Редактировать заработок" : "Добавить заработок"}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Сумма заработка</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={earningForm.amount}
                        onChange={(e) => handleEarningFormChange('amount', e.target.value)}
                        isInvalid={!!earningErrors.amount}
                        errorMessage={earningErrors.amount}
                        aria-label="Сумма заработка"
                        startContent={<DollarSign className="w-4 h-4 text-gray-400" />}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Дата заработка</label>
                      <Input
                        type="date"
                        value={earningForm.earningDate}
                        onChange={(e) => handleEarningFormChange('earningDate', e.target.value)}
                        isInvalid={!!earningErrors.earningDate}
                        errorMessage={earningErrors.earningDate}
                        startContent={<Calendar className="w-4 h-4 text-gray-400" />}
                        aria-label="Дата заработка"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Описание</label>
                    <Textarea
                      placeholder="Добавьте описание заработка (необязательно)"
                      value={earningForm.description}
                      onChange={(e) => handleEarningFormChange('description', e.target.value)}
                      aria-label="Описание заработка"
                      size="sm"
                      rows={2}
                    />
                  </div>

                  <div className="flex justify-end gap-2 mt-4">
                    {isEarningEditMode && (
                      <Button
                        variant="flat"
                        onClick={cancelEditEarning}
                        startIcon={<X className="w-4 h-4" />}
                      >
                        Отменить
                      </Button>
                    )}
                    <Button
                      color="primary"
                      type="submit"
                      isLoading={addEarningMutation.isLoading || updateEarningMutation.isLoading}
                      startIcon={isEarningEditMode ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    >
                      {isEarningEditMode ? "Сохранить изменения" : "Добавить заработок"}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              color="default"
              onClick={() => {
                if (isPaymentDialogOpen) closePaymentDialog();
                if (isDebtDialogOpen) closeDebtDialog();
                if (isEarningDialogOpen) closeEarningDialog();
                setIsEditMode(false);
                setIsEarningEditMode(false);
                setSelectedPayment(null);
                setSelectedEarning(null);
              }}
            >
              Закрыть
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Модальное окно добавления сотрудника */}
      <Modal 
        isOpen={isAddEmployeeDialogOpen} 
        onClose={closeAddEmployeeDialog}
        size="md"
      >
        <ModalContent>
          <ModalHeader>
            <h3 className="text-lg font-medium">Добавить сотрудника</h3>
            <p className="text-sm text-gray-500">
              Заполните информацию о новом сотруднике
            </p>
          </ModalHeader>
          <ModalBody>
            <form onSubmit={handleEmployeeSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">ФИО сотрудника</label>
                <Input
                  placeholder="Иванов Иван Иванович"
                  value={employeeForm.fullName}
                  onChange={(e) => handleEmployeeFormChange('fullName', e.target.value)}
                  isInvalid={!!employeeErrors.fullName}
                  errorMessage={employeeErrors.fullName}
                  aria-label="ФИО сотрудника"
                  startContent={<User className="w-4 h-4 text-gray-400" />}
                />
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Должность</label>
                <Input
                  placeholder="Менеджер"
                  value={employeeForm.position}
                  onChange={(e) => handleEmployeeFormChange('position', e.target.value)}
                  isInvalid={!!employeeErrors.position}
                  errorMessage={employeeErrors.position}
                  aria-label="Должность"
                />
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Дата начала работы</label>
                <Input
                  type="date"
                  value={employeeForm.startDate}
                  onChange={(e) => handleEmployeeFormChange('startDate', e.target.value)}
                  isInvalid={!!employeeErrors.startDate}
                  errorMessage={employeeErrors.startDate}
                  startContent={<Calendar className="w-4 h-4 text-gray-400" />}
                  aria-label="Дата начала работы"
                />
              </div>
              
              {/* Основной день выплаты */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {employeeForm.periodic === "ONCE_MONTH" ? "День выплаты зарплаты" : 
                   employeeForm.periodic === "TWICE_MONTH" ? "Первый день выплаты" : "Первый день выплаты"}  
                </label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={employeeForm.payday}
                  onChange={(e) => handleEmployeeFormChange('payday', e.target.value)}
                  isInvalid={!!employeeErrors.payday}
                  errorMessage={employeeErrors.payday}
                  aria-label="Первый день выплаты зарплаты"
                />
              </div>
              
              {/* Второй день выплаты (отображается только если выбрано два или три раза в месяц) */}
              {(employeeForm.periodic === "TWICE_MONTH" || employeeForm.periodic === "THRICE_MONTH") && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Второй день выплаты</label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={employeeForm.payday2}
                    onChange={(e) => handleEmployeeFormChange('payday2', e.target.value)}
                    isInvalid={!!employeeErrors.payday2}
                    errorMessage={employeeErrors.payday2}
                    aria-label="Второй день выплаты зарплаты"
                  />
                </div>
              )}
              
              {/* Третий день выплаты (отображается только если выбрано три раза в месяц) */}
              {employeeForm.periodic === "THRICE_MONTH" && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Третий день выплаты</label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={employeeForm.payday3}
                    onChange={(e) => handleEmployeeFormChange('payday3', e.target.value)}
                    isInvalid={!!employeeErrors.payday3}
                    errorMessage={employeeErrors.payday3}
                    aria-label="Третий день выплаты зарплаты"
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Фиксированная зарплата (если есть)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Оставьте пустым, если нет фиксированной зарплаты"
                  value={employeeForm.fixedSalary}
                  onChange={(e) => handleEmployeeFormChange('fixedSalary', e.target.value)}
                  isInvalid={!!employeeErrors.fixedSalary}
                  errorMessage={employeeErrors.fixedSalary}
                  aria-label="Фиксированная зарплата"
                  startContent={<DollarSign className="w-4 h-4 text-gray-400" />}
                />
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Периодичность оплаты</label>
                <Select
                  placeholder="Выберите периодичность"
                  selectedKeys={[employeeForm.periodic]}
                  onChange={(e) => handleEmployeeFormChange('periodic', e.target.value)}
                  aria-label="Периодичность оплаты"
                >
                  <SelectItem key="ONCE_MONTH" value="ONCE_MONTH">Раз в месяц</SelectItem>
                  <SelectItem key="TWICE_MONTH" value="TWICE_MONTH">Два раза в месяц</SelectItem>
                  <SelectItem key="THRICE_MONTH" value="THRICE_MONTH">Три раза в месяц</SelectItem>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Комментарий</label>
                <Textarea
                  placeholder="Добавьте комментарий о сотруднике (необязательно)"
                  value={employeeForm.comment}
                  onChange={(e) => handleEmployeeFormChange('comment', e.target.value)}
                  aria-label="Комментарий о сотруднике"
                  size="sm"
                  rows={2}
                />
              </div>
            </form>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              color="default"
              onClick={closeAddEmployeeDialog}
            >
              Отмена
            </Button>
            <Button
              color="primary"
              onClick={handleEmployeeSubmit}
              isLoading={createEmployeeMutation.isLoading}
              startIcon={<Plus className="w-4 h-4" />}
            >
              Добавить сотрудника
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Модальное окно редактирования сотрудника */}
      <Modal 
        isOpen={isEditEmployeeDialogOpen} 
        onClose={closeEditEmployeeDialog}
        size="md"
      >
        <ModalContent>
          <ModalHeader>
            <h3 className="text-lg font-medium">Редактировать сотрудника</h3>
            <p className="text-sm text-gray-500">
              Измените информацию о сотруднике
            </p>
          </ModalHeader>
          <ModalBody>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!validateEmployeeForm()) {
                return;
              }
              updateEmployeeMutation.mutate({
                id: selectedEmployee,
                fullName: employeeForm.fullName,
                position: employeeForm.position,
                startDate: new Date(employeeForm.startDate),
                payday: parseInt(employeeForm.payday),
                paydayMonth: employeeForm.paydayMonth ? parseInt(employeeForm.paydayMonth) : undefined,
                fixedSalary: employeeForm.fixedSalary ? parseFloat(employeeForm.fixedSalary) : undefined,
                comment: employeeForm.comment,
                periodic: employeeForm.periodic
              });
            }} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">ФИО сотрудника</label>
                <Input
                  placeholder="Иванов Иван Иванович"
                  value={employeeForm.fullName}
                  onChange={(e) => handleEmployeeFormChange('fullName', e.target.value)}
                  isInvalid={!!employeeErrors.fullName}
                  errorMessage={employeeErrors.fullName}
                  aria-label="ФИО сотрудника"
                  startContent={<User className="w-4 h-4 text-gray-400" />}
                />
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Должность</label>
                <Input
                  placeholder="Менеджер"
                  value={employeeForm.position}
                  onChange={(e) => handleEmployeeFormChange('position', e.target.value)}
                  isInvalid={!!employeeErrors.position}
                  errorMessage={employeeErrors.position}
                  aria-label="Должность"
                />
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Дата начала работы</label>
                <Input
                  type="date"
                  value={employeeForm.startDate}
                  onChange={(e) => handleEmployeeFormChange('startDate', e.target.value)}
                  isInvalid={!!employeeErrors.startDate}
                  errorMessage={employeeErrors.startDate}
                  startContent={<Calendar className="w-4 h-4 text-gray-400" />}
                  aria-label="Дата начала работы"
                />
              </div>
              
              {/* Основной день выплаты */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {employeeForm.periodic === "ONCE_MONTH" ? "День выплаты зарплаты" : 
                   employeeForm.periodic === "TWICE_MONTH" ? "Первый день выплаты" : "Первый день выплаты"}  
                </label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={employeeForm.payday}
                  onChange={(e) => handleEmployeeFormChange('payday', e.target.value)}
                  isInvalid={!!employeeErrors.payday}
                  errorMessage={employeeErrors.payday}
                  aria-label="Первый день выплаты зарплаты"
                />
              </div>
              
              {/* Второй день выплаты (отображается только если выбрано два или три раза в месяц) */}
              {(employeeForm.periodic === "TWICE_MONTH" || employeeForm.periodic === "THRICE_MONTH") && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Второй день выплаты</label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={employeeForm.payday2}
                    onChange={(e) => handleEmployeeFormChange('payday2', e.target.value)}
                    isInvalid={!!employeeErrors.payday2}
                    errorMessage={employeeErrors.payday2}
                    aria-label="Второй день выплаты зарплаты"
                  />
                </div>
              )}
              
              {/* Третий день выплаты (отображается только если выбрано три раза в месяц) */}
              {employeeForm.periodic === "THRICE_MONTH" && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Третий день выплаты</label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={employeeForm.payday3}
                    onChange={(e) => handleEmployeeFormChange('payday3', e.target.value)}
                    isInvalid={!!employeeErrors.payday3}
                    errorMessage={employeeErrors.payday3}
                    aria-label="Третий день выплаты зарплаты"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Фиксированная зарплата (если есть)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Оставьте пустым, если нет фиксированной зарплаты"
                  value={employeeForm.fixedSalary}
                  onChange={(e) => handleEmployeeFormChange('fixedSalary', e.target.value)}
                  isInvalid={!!employeeErrors.fixedSalary}
                  errorMessage={employeeErrors.fixedSalary}
                  aria-label="Фиксированная зарплата"
                  startContent={<DollarSign className="w-4 h-4 text-gray-400" />}
                />
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Периодичность оплаты</label>
                <Select
                  placeholder="Выберите периодичность"
                  selectedKeys={[employeeForm.periodic]}
                  onChange={(e) => handleEmployeeFormChange('periodic', e.target.value)}
                  aria-label="Периодичность оплаты"
                >
                  <SelectItem key="ONCE_MONTH" value="ONCE_MONTH">Раз в месяц</SelectItem>
                  <SelectItem key="TWICE_MONTH" value="TWICE_MONTH">Два раза в месяц</SelectItem>
                  <SelectItem key="THRICE_MONTH" value="THRICE_MONTH">Три раза в месяц</SelectItem>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Комментарий</label>
                <Textarea
                  placeholder="Добавьте комментарий о сотруднике (необязательно)"
                  value={employeeForm.comment}
                  onChange={(e) => handleEmployeeFormChange('comment', e.target.value)}
                  aria-label="Комментарий о сотруднике"
                  size="sm"
                  rows={2}
                />
              </div>
            </form>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              color="default"
              onClick={closeEditEmployeeDialog}
            >
              Отмена
            </Button>
            <Button
              color="primary"
              onClick={(e) => {
                e.preventDefault();
                if (!validateEmployeeForm()) {
                  return;
                }
                updateEmployeeMutation.mutate({
                  id: selectedEmployee,
                  fullName: employeeForm.fullName,
                  position: employeeForm.position,
                  startDate: new Date(employeeForm.startDate),
                  payday: parseInt(employeeForm.payday),
                  payday2: employeeForm.periodic !== "ONCE_MONTH" ? parseInt(employeeForm.payday2) : undefined,
                  payday3: employeeForm.periodic === "THRICE_MONTH" ? parseInt(employeeForm.payday3) : undefined,
                  paydayMonth: employeeForm.paydayMonth ? parseInt(employeeForm.paydayMonth) : undefined,
                  fixedSalary: employeeForm.fixedSalary ? parseFloat(employeeForm.fixedSalary) : undefined,
                  comment: employeeForm.comment,
                  periodic: employeeForm.periodic
                });
              }}
              isLoading={updateEmployeeMutation.isLoading}
              startIcon={<Save className="w-4 h-4" />}
            >
              Сохранить изменения
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}