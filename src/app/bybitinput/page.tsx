"use client";

import { useState, useEffect } from "react";
import { api } from "@/trpc/react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Spinner } from "@heroui/spinner";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Tooltip } from "@heroui/tooltip";
import { Tabs, Tab } from "@heroui/tabs";
import { Chip } from "@heroui/chip";
import { Switch } from "@heroui/switch";
import { Badge } from "@heroui/badge";
import { Pagination } from "@heroui/pagination";
import { 
  PlusIcon, 
  Search, 
  RefreshCw, 
  Edit, 
  Trash, 
  CreditCard, 
  Filter, 
  AlertCircle,
  CheckCircle, 
  XCircle, 
  Calendar, 
  DollarSign,
  Info,
  Eye,
  ArrowUpDown
} from "lucide-react";

type BybitOrderInfo = {
  id: number;
  orderNo: string;
  phoneNumbers: string[];
  createdAt: Date;
  updatedAt: Date;
  userId: number;
  userName: string;
};

export default function BybitOrderInfoPage() {
  // State для хранения данных и управления интерфейсом
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedOrder, setSelectedOrder] = useState<BybitOrderInfo | null>(null);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<number | null>(null);

  // Фетчинг данных с использованием tRPC
  const { data, isLoading, refetch } = api.bybitOrderInfo.getAll.useQuery({
    page: currentPage,
    pageSize,
    searchQuery: searchQuery.trim() !== "" ? searchQuery : undefined,
  });

  // Хук для удаления записи
  const deleteOrderMutation = api.bybitOrderInfo.delete.useMutation({
    onSuccess: () => {
      setIsDeleteModalOpen(false);
      setOrderToDelete(null);
      refetch();
    },
  });

  // Функция для открытия модального окна с телефонами
  const openPhoneModal = (order: BybitOrderInfo) => {
    setSelectedOrder(order);
    setIsPhoneModalOpen(true);
  };

  // Функция для открытия модального окна подтверждения удаления
  const openDeleteModal = (id: number) => {
    setOrderToDelete(id);
    setIsDeleteModalOpen(true);
  };

  // Функция для удаления записи
  const handleDelete = () => {
    if (orderToDelete) {
      deleteOrderMutation.mutate({ id: orderToDelete });
    }
  };

  // Функция форматирования даты
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Рендеринг загрузки
  if (isLoading) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="shadow-md">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">Информация о заказах Bybit</h1>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative">
              <Input
                className="pl-10 pr-4"
                placeholder="Поиск по всем полям..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
            </div>
            <Button
              color="primary"
              className="ml-2 flex items-center gap-2"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4" />
              Обновить
            </Button>
          </div>
        </CardHeader>

        <CardBody className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200 dark:divide-zinc-700">
            <thead className="bg-gray-50 dark:bg-zinc-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                  Номер заказа
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                  Пользователь
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                  Последний номер
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                  Все телефоны
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                  Дата создания
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                  Последнее обновление
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-zinc-700 dark:bg-zinc-900">
              {data?.items.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-4 text-center text-sm text-gray-500 dark:text-zinc-400"
                  >
                    Записи не найдены
                  </td>
                </tr>
              ) : (
                data?.items.map((order) => (
                  <tr key={order.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-zinc-200">
                      {order.id}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-zinc-400">
                      {order.orderNo}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-zinc-400">
                      {order.userName}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-zinc-400">
                      {order.phoneNumbers && order.phoneNumbers.length > 0 ? (
                        <span className="font-medium">
                          {order.phoneNumbers[order.phoneNumbers.length - 1]}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-zinc-500 italic">Нет номеров</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      <Button
                        color="primary"
                        variant="light"
                        size="sm"
                        className="flex items-center gap-1"
                        onClick={() => openPhoneModal(order)}
                      >
                        <Eye className="h-4 w-4" />
                        {order.phoneNumbers.length} тел.
                      </Button>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-zinc-400">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-zinc-400">
                      {formatDate(order.updatedAt)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <Tooltip content="Удалить">
                          <Button
                            color="danger"
                            variant="light"
                            size="sm"
                            isIconOnly
                            onClick={() => openDeleteModal(order.id)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardBody>

        {/* Пагинация */}
        {data && data.pageCount > 1 && (
          <div className="flex items-center justify-between px-6 py-3 dark:bg-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700 dark:text-zinc-300">
                Показано {pageSize * (currentPage - 1) + 1} -{
                  Math.min(pageSize * currentPage, data.totalCount)
                } из {data.totalCount}
              </span>
              <Select
                size="sm"
                value={pageSize.toString()}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="w-20"
              >
                <SelectItem key="10" value="10">
                  10
                </SelectItem>
                <SelectItem key="25" value="25">
                  25
                </SelectItem>
                <SelectItem key="50" value="50">
                  50
                </SelectItem>
                <SelectItem key="100" value="100">
                  100
                </SelectItem>
              </Select>
            </div>

            <Pagination
              size="sm"
              total={data.pageCount}
              initialPage={currentPage}
              onChange={(page) => setCurrentPage(page)}
            />
          </div>
        )}
      </Card>

      {/* Модальное окно с телефонами */}
      <Modal
        isOpen={isPhoneModalOpen}
        onClose={() => setIsPhoneModalOpen(false)}
        placement="center"
        backdrop="blur"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            Телефонные номера для заказа {selectedOrder?.orderNo}
          </ModalHeader>
          <ModalBody>
            {selectedOrder?.phoneNumbers.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-zinc-400">
                Нет телефонных номеров
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {selectedOrder?.phoneNumbers.map((phone, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-md border p-3 dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    <span className="font-medium">{phone}</span>
                    <Button
                      color="primary"
                      variant="light"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(phone)}
                    >
                      Копировать
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              color="primary"
              onClick={() => setIsPhoneModalOpen(false)}
            >
              Закрыть
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Модальное окно подтверждения удаления */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        placement="center"
        backdrop="blur"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            Подтверждение удаления
          </ModalHeader>
          <ModalBody>
            <p>Вы уверены, что хотите удалить эту запись?</p>
            <p className="text-gray-500 dark:text-zinc-400">Это действие нельзя отменить.</p>
          </ModalBody>
          <ModalFooter>
            <Button
              color="danger"
              variant="solid"
              onClick={handleDelete}
              isLoading={deleteOrderMutation.isLoading}
            >
              Удалить
            </Button>
            <Button
              color="default"
              variant="light"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Отмена
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
