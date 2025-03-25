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
import { 
  Calendar, 
  User, 
  Plus, 
  CheckCircle, 
  AlertCircle, 
  Loader 
} from "lucide-react";
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
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isAddEmployeeDialogOpen, setIsAddEmployeeDialogOpen] = useState(false);
  
  // Состояния для форм
  const [employeeForm, setEmployeeForm] = useState({
    fullName: "",
    position: "",
    startDate: dayjs().format("YYYY-MM-DD"),
    payday: 10,
    paydayMonth: "",
    fixedSalary: ""
  });
  
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentDate: dayjs().format("YYYY-MM-DD"),
    comment: ""
  });
  
  // Состояния для валидации
  const [employeeErrors, setEmployeeErrors] = useState({});
  const [paymentErrors, setPaymentErrors] = useState({});
  
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

  // Получение сотрудников с пагинацией
  const employeesQuery = api.salary.getAllEmployees.useQuery({
    page: currentPage,
    pageSize,
    searchQuery: searchQuery.length > 0 ? searchQuery : undefined,
  });

  // Получение выплат для выбранного сотрудника
  const paymentsQuery = api.salary.getEmployeePayments.useQuery(
    { employeeId: selectedEmployee || 0 },
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
      showAlert("Успешно", "Сотрудник успешно добавлен", "success");
      setIsAddEmployeeDialogOpen(false);
      employeesQuery.refetch();
      // Сбросить форму
      setEmployeeForm({
        fullName: "",
        position: "",
        startDate: dayjs().format("YYYY-MM-DD"),
        payday: 10,
        paydayMonth: "",
        fixedSalary: ""
      });
      setEmployeeErrors({});
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при добавлении сотрудника: ${error.message}`, "danger");
    },
  });

  const addPaymentMutation = api.salary.addPayment.useMutation({
    onSuccess: () => {
      showAlert("Успешно", "Выплата успешно добавлена", "success");
      setIsPaymentDialogOpen(false);
      if (selectedEmployee) {
        paymentsQuery.refetch();
        employeesQuery.refetch();
      }
      // Сбросить форму
      setPaymentForm({
        amount: "",
        paymentDate: dayjs().format("YYYY-MM-DD"),
        comment: ""
      });
      setPaymentErrors({});
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка при добавлении выплаты: ${error.message}`, "danger");
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
      errors.payday = "День выплаты должен быть от 1 до 31";
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
      paydayMonth: employeeForm.paydayMonth ? parseInt(employeeForm.paydayMonth) : undefined,
      fixedSalary: employeeForm.fixedSalary ? parseFloat(employeeForm.fixedSalary) : undefined,
    });
  };

  const handlePaymentSubmit = (e) => {
    e.preventDefault();
    
    if (!validatePaymentForm()) {
      return;
    }
    
    if (!selectedEmployee) return;
    
    addPaymentMutation.mutate({
      salaryId: selectedEmployee,
      amount: parseFloat(paymentForm.amount),
      paymentDate: new Date(paymentForm.paymentDate),
      comment: paymentForm.comment,
    });
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
        <h1 className="text-2xl font-bold">Зарплаты сотрудников</h1>
        <Button
          color="primary"
          startIcon={<Plus className="w-4 h-4" />}
          onClick={() => setIsAddEmployeeDialogOpen(true)}
        >
          Добавить сотрудника
        </Button>
      </div>

      <div className="mb-6">
        <div className="flex gap-2">
          <Input
            placeholder="Поиск по ФИО или должности..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
            aria-label="Поиск по ФИО или должности"
          />
        </div>
      </div>
      
      <Card>
        <CardBody className="p-0">
          <Table aria-label="Таблица сотрудников">
            <TableHeader>
              <TableColumn>ФИО</TableColumn>
              <TableColumn>Должность</TableColumn>
              <TableColumn>Дата начала работы</TableColumn>
              <TableColumn>День выплаты</TableColumn>
              <TableColumn>Фиксированная зарплата</TableColumn>
              <TableColumn>Последняя выплата</TableColumn>
            </TableHeader>
            <TableBody>
              {employeesQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">
                    <div className="flex justify-center">
                      <Spinner size="lg" color="primary" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : employeesQuery.data?.employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-gray-500">
                    Нет данных о сотрудниках
                  </TableCell>
                </TableRow>
              ) : (
                employeesQuery.data?.employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>{employee.fullName}</TableCell>
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
                        onClick={() => {
                          setSelectedEmployee(employee.id);
                          setIsPaymentDialogOpen(true);
                        }}
                        className="text-left w-full justify-start hover:bg-transparent hover:underline h-auto p-0"
                      >
                        {employee.payments && employee.payments.length > 0 ? (
                          <div>
                            <div>{formatDate(employee.payments[0].paymentDate)}</div>
                            <div>{formatCurrency(employee.payments[0].amount)}</div>
                          </div>
                        ) : (
                          <span className="text-gray-500">Нет выплат</span>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardBody>
        
        {/* Пагинация */}
        {employeesQuery.data && employeesQuery.data.pagination.totalPages > 1 && (
          <CardFooter className="flex justify-between px-6 py-4">
            <div className="text-sm text-gray-500">
              Страница {currentPage} из {employeesQuery.data.pagination.totalPages}
            </div>
            <Pagination
              total={employeesQuery.data.pagination.totalPages}
              initialPage={currentPage}
              page={currentPage}
              onChange={handlePageChange}
              aria-label="Пагинация списка сотрудников"
            />
          </CardFooter>
        )}
      </Card>

      {/* Модальное окно деталей сотрудника и выплат */}
      <Modal 
        isOpen={isPaymentDialogOpen} 
        onClose={() => setIsPaymentDialogOpen(false)}
        size="md"
      >
        <ModalContent>
          <ModalHeader>
            <h3 className="text-lg font-medium">История выплат</h3>
            <p className="text-sm text-gray-500">
              {employeeDetailsQuery.data?.employee 
                ? `Выплаты сотруднику: ${employeeDetailsQuery.data.employee.fullName}`
                : "Загрузка данных..."
              }
            </p>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="flex justify-between">
                <h3 className="text-md font-medium">Список выплат</h3>
                <Button 
                  size="sm" 
                  onClick={() => {
                    setPaymentForm({
                      amount: "",
                      paymentDate: dayjs().format("YYYY-MM-DD"),
                      comment: ""
                    });
                    setPaymentErrors({});
                  }}
                >
                  Добавить выплату
                </Button>
              </div>
              {paymentsQuery.isLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner size="lg" color="primary" />
                </div>
              ) : paymentsQuery.data?.payments.length === 0 ? (
                <p className="text-center py-4 text-gray-500">
                  Нет данных о выплатах
                </p>
              ) : (
                <div className="max-h-80 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableColumn>Дата</TableColumn>
                      <TableColumn>Сумма</TableColumn>
                      <TableColumn>Комментарий</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {paymentsQuery.data?.payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                          <TableCell>
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell>{payment.comment || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              
              <form onSubmit={handlePaymentSubmit} className="space-y-4 border-t pt-4 mt-4">
                <h3 className="text-md font-medium">Добавить выплату</h3>
                
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
                    startContent={<Calendar className="w-4 h-4 text-gray-500" />}
                    aria-label="Дата выплаты"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Комментарий</label>
                  <Textarea
                    placeholder="Добавьте комментарий к выплате (необязательно)"
                    value={paymentForm.comment}
                    onChange={(e) => handlePaymentFormChange('comment', e.target.value)}
                    aria-label="Комментарий к выплате"
                  />
                </div>
              </form>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              color="default"
              onClick={() => setIsPaymentDialogOpen(false)}
            >
              Отмена
            </Button>
            <Button
              color="primary"
              onClick={handlePaymentSubmit}
              isLoading={addPaymentMutation.isLoading}
            >
              {addPaymentMutation.isLoading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Добавление...
                </>
              ) : (
                "Добавить выплату"
              )}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Модальное окно добавления сотрудника */}
      <Modal 
        isOpen={isAddEmployeeDialogOpen} 
        onClose={() => setIsAddEmployeeDialogOpen(false)}
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
                  startContent={<Calendar className="w-4 h-4 text-gray-500" />}
                  aria-label="Дата начала работы"
                />
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">День выплаты зарплаты</label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={employeeForm.payday}
                  onChange={(e) => handleEmployeeFormChange('payday', e.target.value)}
                  isInvalid={!!employeeErrors.payday}
                  errorMessage={employeeErrors.payday}
                  aria-label="День выплаты зарплаты"
                />
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Месяц выплаты (если не каждый месяц)</label>
                <Select
                  placeholder="Выберите месяц (опционально)"
                  selectedKeys={employeeForm.paydayMonth ? [employeeForm.paydayMonth.toString()] : []}
                  onChange={(e) => handleEmployeeFormChange('paydayMonth', e.target.value)}
                  aria-label="Месяц выплаты"
                >
                  <SelectItem key="" value="">Ежемесячно</SelectItem>
                  <SelectItem key="1" value="1">Январь</SelectItem>
                  <SelectItem key="2" value="2">Февраль</SelectItem>
                  <SelectItem key="3" value="3">Март</SelectItem>
                  <SelectItem key="4" value="4">Апрель</SelectItem>
                  <SelectItem key="5" value="5">Май</SelectItem>
                  <SelectItem key="6" value="6">Июнь</SelectItem>
                  <SelectItem key="7" value="7">Июль</SelectItem>
                  <SelectItem key="8" value="8">Август</SelectItem>
                  <SelectItem key="9" value="9">Сентябрь</SelectItem>
                  <SelectItem key="10" value="10">Октябрь</SelectItem>
                  <SelectItem key="11" value="11">Ноябрь</SelectItem>
                  <SelectItem key="12" value="12">Декабрь</SelectItem>
                </Select>
                {employeeErrors.paydayMonth && (
                  <p className="text-xs text-red-500 mt-1">{employeeErrors.paydayMonth}</p>
                )}
              </div>
              
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
                />
              </div>
            </form>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              color="default"
              onClick={() => setIsAddEmployeeDialogOpen(false)}
            >
              Отмена
            </Button>
            <Button
              color="primary"
              onClick={handleEmployeeSubmit}
              isLoading={createEmployeeMutation.isLoading}
            >
              {createEmployeeMutation.isLoading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Добавление...
                </>
              ) : (
                "Добавить сотрудника"
              )}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}