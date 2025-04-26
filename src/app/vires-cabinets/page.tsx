"use client";

import { useState, useEffect } from "react";
import { api } from "@/trpc/react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Textarea } from "@heroui/input";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/table";
import dayjs from "dayjs";
import "dayjs/locale/ru";
// Set Russian locale globally for dayjs
dayjs.locale("ru");
import { PlusCircle, Edit, Trash2, Search, Filter, ChevronLeft, ChevronRight, Calendar, Clipboard } from "lucide-react";
import { Alert } from "@heroui/alert";
import { Spinner } from "@heroui/spinner";

type Cabinet = {
  id: number;
  name: string | null;
  login: string;
  password: string;
  comment: string | null;
  userId: number;
  lastUpdate: Date;
  _count: { ViresTransactionPayin: number };
  User: { id: number; name: string };
};

type Transaction = {
  id: number;
  cabinetId: number;
  createdAt: Date;
  sum_rub: number;
  sum_usdt: number;
  card: string;
  fio: string;
  bank: string;
  uuid: string;
};

type User = {
  id: number;
  name: string;
};

type AlertState = {
  isVisible: boolean;
  message: string;
  type: "success" | "danger" | "primary" | "warning" | "default" | "secondary";
};

export default function ViresCabinetsPage() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [transactionsModalOpen, setTransactionsModalOpen] = useState(false);
  const [editingCabinet, setEditingCabinet] = useState<Cabinet | null>(null);
  const [selectedCabinet, setSelectedCabinet] = useState<Cabinet | null>(null);
  const [transactionPage, setTransactionPage] = useState(1);

  // Alert state
  const [alert, setAlert] = useState<AlertState>({
    isVisible: false,
    message: "",
    type: "default"
  });

  // Form fields
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  // Filter dates
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [isFiltering, setIsFiltering] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Queries and mutations
  const cabinetsQuery = api.vires.getAll.useQuery();
  const usersQuery = api.vires.getUsers.useQuery();
  const createMutation = api.vires.create.useMutation({
    onSuccess: () => {
      cabinetsQuery.refetch();
      resetForm();
      setCreateModalOpen(false);
      showAlert("Кабинет успешно создан", "success");
    },
    onError: (error) => {
      showAlert(`Ошибка: ${error.message}`, "danger");
    }
  });

  const updateMutation = api.vires.update.useMutation({
    onSuccess: () => {
      cabinetsQuery.refetch();
      resetForm();
      setCreateModalOpen(false);
      showAlert("Кабинет успешно обновлен", "success");
    },
    onError: (error) => {
      showAlert(`Ошибка: ${error.message}`, "danger");
    }
  });

  const deleteMutation = api.vires.delete.useMutation({
    onSuccess: () => {
      cabinetsQuery.refetch();
      setDeleteModalOpen(false);
      showAlert("Кабинет успешно удален", "success");
    },
    onError: (error) => {
      showAlert(`Ошибка: ${error.message}`, "danger");
    }
  });

  const transactionsQuery = api.vires.getTransactions.useQuery(
    {
      cabinetId: selectedCabinet?.id ?? 0,
      page: transactionPage,
      pageSize: 10,
      startDate: startDate,
      endDate: endDate,
    },
    {
      enabled: !!selectedCabinet && transactionsModalOpen,
    }
  );

  const filteredCabinetsQuery = api.vires.getTransactionsByPeriod.useQuery(
    {
      startDate: startDate ?? new Date(2000, 0, 1),
      endDate: endDate ?? new Date(),
    },
    {
      enabled: isFiltering && !!startDate && !!endDate,
    }
  );

  // Alert handling
  const showAlert = (message: string, type: AlertState["type"] = "default") => {
    setAlert({
      isVisible: true,
      message,
      type
    });
    
    // Auto-hide alert after 3 seconds
    setTimeout(() => {
      setAlert(prev => ({...prev, isVisible: false}));
    }, 3000);
  };

  // Reset form fields
  const resetForm = () => {
    setName("");
    setLogin("");
    setPassword("");
    setUserId(null);
    setComment("");
    setEditingCabinet(null);
  };

  // Open modal for adding new cabinet
  const handleAddNew = () => {
    resetForm();
    setCreateModalOpen(true);
  };

  // Open modal for editing cabinet
  const handleEdit = (cabinet: Cabinet) => {
    setEditingCabinet(cabinet);
    setName(cabinet.name ?? "");
    setLogin(cabinet.login);
    setPassword(cabinet.password);
    setUserId(cabinet.userId);
    setComment(cabinet.comment ?? "");
    setCreateModalOpen(true);
  };

  // Handle delete confirmation
  const handleDeleteConfirm = (cabinet: Cabinet) => {
    setSelectedCabinet(cabinet);
    setDeleteModalOpen(true);
  };

  // Handle delete action
  const handleDelete = () => {
    if (selectedCabinet) {
      deleteMutation.mutate({ id: selectedCabinet.id });
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!login || !password || !userId) {
      showAlert("Пожалуйста, заполните все обязательные поля", "warning");
      return;
    }
    
    if (editingCabinet) {
      updateMutation.mutate({
        id: editingCabinet.id,
        name: name || undefined,
        login,
        password,
        userId,
        comment: comment || undefined,
      });
    } else {
      createMutation.mutate({
        name: name || undefined,
        login,
        password,
        userId,
        comment: comment || undefined,
      });
    }
  };

  // Open transactions modal
  const handleViewTransactions = (cabinet: Cabinet) => {
    setSelectedCabinet(cabinet);
    setTransactionPage(1);
    setTransactionsModalOpen(true);
  };

  // Apply date filter
  const applyFilter = () => {
    if (startDate && endDate) {
      setIsFiltering(true);
      setFilterModalOpen(false);
      cabinetsQuery.refetch();
    } else {
      showAlert("Пожалуйста, выберите обе даты", "warning");
    }
  };

  // Reset filter
  const resetFilter = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setIsFiltering(false);
    cabinetsQuery.refetch();
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return dayjs(date).subtract(3, 'hour').format("DD.MM.YYYY HH:mm");
  };

  // Get cabinets data
  const cabinets = isFiltering && filteredCabinetsQuery.data
    ? filteredCabinetsQuery.data
    : cabinetsQuery.data || [];

  return (
    <div className="container mx-auto py-6">
      {/* Alert notification */}
      {alert.isVisible && (
        <div className="fixed top-4 right-4 z-50 w-96">
          <Alert
            color={alert.type}
            isVisible={alert.isVisible}
            onClose={() => setAlert(prev => ({ ...prev, isVisible: false }))}
          >
            {alert.message}
          </Alert>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Vires Кабинеты</h1>
        <div className="flex gap-2">
          <Button 
            color="secondary" 
            variant="bordered" 
            onClick={() => setFilterModalOpen(true)} 
            startIcon={<Filter className="h-4 w-4" />}
          >
            Фильтр по периоду
          </Button>
          {isFiltering && (
            <Button 
              variant="bordered" 
              onClick={resetFilter}
            >
              Сбросить фильтр
            </Button>
          )}
          <Button 
            color="primary" 
            onClick={handleAddNew} 
            startIcon={<PlusCircle className="h-4 w-4" />}
          >
            Добавить кабинет
          </Button>
        </div>
      </div>

      {isFiltering && startDate && endDate && (
        <Alert className="mb-4" color="primary">
          Фильтр активен: {dayjs(startDate).format("DD.MM.YYYY")} - {dayjs(endDate).format("DD.MM.YYYY")}
        </Alert>
      )}

      <Card>
        <CardHeader>Список кабинетов Vires</CardHeader>
        <CardBody>
          {cabinetsQuery.isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner size="lg" color="primary" />
            </div>
          ) : cabinetsQuery.isError ? (
            <div className="text-center text-red-500 py-10">Ошибка загрузки данных</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableColumn>ID</TableColumn>
                  <TableColumn>Имя</TableColumn>
                  <TableColumn>Логин</TableColumn>
                  <TableColumn>Пароль</TableColumn>
                  <TableColumn>Пользователь</TableColumn>
                  <TableColumn>Транзакции</TableColumn>
                  <TableColumn>Последнее обновление</TableColumn>
                  <TableColumn>Комментарий</TableColumn>
                  <TableColumn>Действия</TableColumn>
                </TableHeader>
                <TableBody>
                  {cabinets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9}>
                        <div className="text-center py-4">Кабинеты не найдены</div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    cabinets.map((cabinet) => (
                      <TableRow key={cabinet.id}>
                        <TableCell>{cabinet.id}</TableCell>
                        <TableCell>{cabinet.name || "-"}</TableCell>
                        <TableCell>{cabinet.login}</TableCell>
                        <TableCell>{cabinet.password}</TableCell>
                        <TableCell>{cabinet.User.name}</TableCell>
                        <TableCell>
                          <Button
                            color="primary"
                            variant="light"
                            onClick={() => handleViewTransactions(cabinet)}
                          >
                            {cabinet._count.ViresTransactionPayin}
                          </Button>
                        </TableCell>
                        <TableCell>{formatDate(cabinet.lastUpdate)}</TableCell>
                        <TableCell>{cabinet.comment || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="light"
                              onClick={() => handleEdit(cabinet)}
                              startIcon={<Edit className="h-4 w-4" />}
                            >
                              Изменить
                            </Button>
                            <Button
                              size="sm"
                              variant="light"
                              color="danger"
                              onClick={() => handleDeleteConfirm(cabinet)}
                              startIcon={<Trash2 className="h-4 w-4" />}
                            >
                              Удалить
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </>
          )}
        </CardBody>
      </Card>

      {/* Модальное окно добавления/редактирования кабинета */}
      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)}>
        <ModalContent>
          <ModalHeader>
            {editingCabinet ? "Редактировать кабинет" : "Добавить новый кабинет"}
          </ModalHeader>
          <form onSubmit={handleSubmit}>
            <ModalBody>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Имя</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Название кабинета (необязательно)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Логин*</label>
                  <Input
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    placeholder="Введите логин"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Пароль*</label>
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Введите пароль"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Пользователь*</label>
                  <Select
                    selectedKeys={userId ? [userId.toString()] : []}
                    onChange={(e) => setUserId(Number(e.target.value))}
                  >
                    {usersQuery.data?.map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Комментарий</label>
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Комментарий (необязательно)"
                  />
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="flat"
                onClick={() => setCreateModalOpen(false)}
              >
                Отмена
              </Button>
              <Button
                color="primary"
                type="submit"
                isLoading={createMutation.isLoading || updateMutation.isLoading}
              >
                {editingCabinet ? "Сохранить" : "Добавить"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* Модальное окно подтверждения удаления */}
      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)}>
        <ModalContent>
          <ModalHeader>Подтверждение удаления</ModalHeader>
          <ModalBody>
            <p>
              Вы уверены, что хотите удалить кабинет{" "}
              {selectedCabinet?.name || selectedCabinet?.login}?
            </p>
            <p className="text-red-500 mt-2">Это действие нельзя отменить.</p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onClick={() => setDeleteModalOpen(false)}
            >
              Отмена
            </Button>
            <Button
              color="danger"
              onClick={handleDelete}
              isLoading={deleteMutation.isLoading}
            >
              Удалить
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Модальное окно фильтра по периоду */}
      <Modal isOpen={filterModalOpen} onClose={() => setFilterModalOpen(false)}>
        <ModalContent>
          <ModalHeader>Фильтр по периоду</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Начальная дата</label>
                <Input
                  type="datetime-local"
                  value={startDate ? format(startDate, "yyyy-MM-dd'T'HH:mm", { locale: ru }) : ""}
                  onChange={(e) => {
                    const date = e.target.value ? new Date(e.target.value) : undefined;
                    setStartDate(date);
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Конечная дата</label>
                <Input
                  type="datetime-local"
                  value={endDate ? format(endDate, "yyyy-MM-dd'T'HH:mm", { locale: ru }) : ""}
                  onChange={(e) => {
                    const date = e.target.value ? new Date(e.target.value) : undefined;
                    setEndDate(date);
                  }}
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onClick={() => setFilterModalOpen(false)}
            >
              Отмена
            </Button>
            <Button
              color="primary"
              onClick={applyFilter}
              disabled={!startDate || !endDate}
            >
              Применить
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Модальное окно просмотра транзакций */}
      <Modal 
        isOpen={transactionsModalOpen} 
        onClose={() => setTransactionsModalOpen(false)}
        size="5xl"
      >
        <ModalContent>
          <ModalHeader>
            Транзакции кабинета {selectedCabinet?.name || selectedCabinet?.login}
          </ModalHeader>
          <ModalBody>
            {transactionsQuery.isLoading ? (
              <div className="flex justify-center py-10">
                <Spinner size="lg" color="primary" />
              </div>
            ) : transactionsQuery.isError ? (
              <div className="text-center text-red-500 py-10">
                Ошибка загрузки транзакций
              </div>
            ) : transactionsQuery.data?.transactions.length === 0 ? (
              <div className="text-center py-10">Транзакции не найдены</div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableColumn>ID</TableColumn>
                    <TableColumn>Дата</TableColumn>
                    <TableColumn>Сумма RUB</TableColumn>
                    <TableColumn>Сумма USDT</TableColumn>
                    <TableColumn>Карта/Телефон</TableColumn>
                    <TableColumn>ФИО</TableColumn>
                    <TableColumn>Банк</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {transactionsQuery.data?.transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>{transaction.id}</TableCell>
                        <TableCell>{formatDate(transaction.createdAt)}</TableCell>
                        <TableCell>{transaction.sum_rub}</TableCell>
                        <TableCell>{transaction.sum_usdt}</TableCell>
                        <TableCell>{transaction.card}</TableCell>
                        <TableCell>{transaction.fio}</TableCell>
                        <TableCell>{transaction.bank}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {/* Пагинация */}
                {transactionsQuery.data && transactionsQuery.data.totalPages > 1 && (
                  <div className="flex justify-center mt-4">
                    <Button
                      variant="light"
                      onClick={() => setTransactionPage((prev) => Math.max(prev - 1, 1))}
                      disabled={transactionPage === 1}
                      startIcon={<ChevronLeft className="h-4 w-4" />}
                    >
                      Назад
                    </Button>
                    <span className="mx-4 flex items-center">
                      Страница {transactionPage} из {transactionsQuery.data.totalPages}
                    </span>
                    <Button
                      variant="light"
                      onClick={() =>
                        setTransactionPage((prev) =>
                          Math.min(prev + 1, transactionsQuery.data.totalPages)
                        )
                      }
                      disabled={transactionPage === transactionsQuery.data.totalPages}
                      endIcon={<ChevronRight className="h-4 w-4" />}
                    >
                      Вперед
                    </Button>
                  </div>
                )}
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setTransactionsModalOpen(false)}>
              Закрыть
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
