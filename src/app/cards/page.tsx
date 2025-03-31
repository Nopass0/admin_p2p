"use client";

import { useState, useEffect } from "react";
import { api } from "@/trpc/react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/table";
import { Pagination } from "@heroui/pagination";
import { Spinner } from "@heroui/spinner";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { PlusIcon, Search, RefreshCw, Edit, Trash, CreditCard } from "lucide-react";
import { Badge } from "@heroui/badge";
import { Select, SelectItem } from "@heroui/select";

export default function Cards() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDirection, setSortDirection] = useState("desc");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [formData, setFormData] = useState({
    externalId: 0,
    provider: "",
    cardNumber: "",
    bank: "",
    phoneNumber: "",
    appPin: 0,
    terminalPin: "",
    comment: "",
    status: "active",
    picachu: "",
    initialBalance: 0
  });

  const cardsQuery = api.cards.getAll.useQuery({
    page,
    pageSize,
    searchQuery,
    sortBy,
    sortDirection,
  });

  const createMutation = api.cards.create.useMutation({
    onSuccess: () => {
      cardsQuery.refetch();
      setIsCreateModalOpen(false);
      resetForm();
    },
  });

  const updateMutation = api.cards.update.useMutation({
    onSuccess: () => {
      cardsQuery.refetch();
      setIsEditModalOpen(false);
    },
  });

  const deleteMutation = api.cards.delete.useMutation({
    onSuccess: () => {
      cardsQuery.refetch();
    },
  });

  const resetForm = () => {
    setFormData({
      externalId: 0,
      provider: "",
      cardNumber: "",
      bank: "",
      phoneNumber: "",
      appPin: 0,
      terminalPin: "",
      comment: "",
      status: "active",
      picachu: "",
      initialBalance: 0
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === "externalId" || name === "appPin" || name === "initialBalance" 
        ? Number(value) 
        : value,
    });
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate({
      id: selectedCard.id,
      ...formData
    });
  };

  const handleEditClick = (card) => {
    setSelectedCard(card);
    setFormData({
      externalId: card.externalId,
      provider: card.provider,
      cardNumber: card.cardNumber,
      bank: card.bank,
      phoneNumber: card.phoneNumber,
      appPin: card.appPin,
      terminalPin: card.terminalPin,
      comment: card.comment || "",
      status: card.status,
      picachu: card.picachu || "",
    });
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (id) => {
    if (confirm("Are you sure you want to delete this card?")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDirection("asc");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="w-full">
        <CardHeader className="flex justify-between items-center">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Карты
          </h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <Input
                className="pl-10 w-64"
                placeholder="Поиск карт..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button
              color="primary"
              startContent={<PlusIcon size={18} />}
              onClick={() => setIsCreateModalOpen(true)}
            >
              Добавить карту
            </Button>
            <Button
              isIconOnly
              variant="light"
              onClick={() => cardsQuery.refetch()}
            >
              <RefreshCw size={18} />
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {cardsQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="lg" />
            </div>
          ) : (
            <>
              <Table aria-label="Cards table">
                <TableHeader>
                  <TableColumn className="cursor-pointer" onClick={() => handleSort("externalId")}>
                    Внешний ID {sortBy === "externalId" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableColumn>
                  <TableColumn className="cursor-pointer" onClick={() => handleSort("provider")}>
                    Провайдер {sortBy === "provider" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableColumn>
                  <TableColumn className="cursor-pointer" onClick={() => handleSort("cardNumber")}>
                    Номер карты {sortBy === "cardNumber" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableColumn>
                  <TableColumn className="cursor-pointer" onClick={() => handleSort("bank")}>
                    Банк {sortBy === "bank" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableColumn>
                  <TableColumn>Баланс</TableColumn>
                  <TableColumn className="cursor-pointer" onClick={() => handleSort("status")}>
                    Статус {sortBy === "status" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableColumn>
                  <TableColumn>Действия</TableColumn>
                </TableHeader>
                <TableBody>
                  {cardsQuery.data?.cards.map((card) => (
                    <TableRow key={card.id}>
                      <TableCell>{card.externalId}</TableCell>
                      <TableCell>{card.provider}</TableCell>
                      <TableCell>{card.cardNumber}</TableCell>
                      <TableCell>{card.bank}</TableCell>
                      <TableCell>
                        {card.balances[0] ? card.balances[0].endBalance : "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge color={card.status === "active" ? "success" : "danger"}>
                          {card.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            onClick={() => handleEditClick(card)}
                          >
                            <Edit size={16} />
                          </Button>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            onClick={() => handleDeleteClick(card.id)}
                          >
                            <Trash size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-gray-500">
                  Всего: {cardsQuery.data?.totalCount || 0} карт
                </div>
                <Pagination
                  total={cardsQuery.data?.totalPages || 1}
                  initialPage={page}
                  onChange={setPage}
                />
              </div>
            </>
          )}
        </CardBody>
      </Card>

      {/* Create Card Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}>
        <ModalContent>
          <form onSubmit={handleCreateSubmit}>
            <ModalHeader>Добавить новую карту</ModalHeader>
            <ModalBody>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Внешний ID</label>
                  <Input
                    name="externalId"
                    type="number"
                    value={formData.externalId}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Провайдер</label>
                  <Input
                    name="provider"
                    value={formData.provider}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Номер карты</label>
                  <Input
                    name="cardNumber"
                    value={formData.cardNumber}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Банк</label>
                  <Input
                    name="bank"
                    value={formData.bank}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Номер телефона</label>
                  <Input
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">PIN приложения</label>
                  <Input
                    name="appPin"
                    type="number"
                    value={formData.appPin}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">PIN терминала</label>
                  <Input
                    name="terminalPin"
                    value={formData.terminalPin}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Статус</label>
                  <Select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                  >
                    <SelectItem key="active" value="active">Активна</SelectItem>
                    <SelectItem key="inactive" value="inactive">Неактивна</SelectItem>
                    <SelectItem key="blocked" value="blocked">Заблокирована</SelectItem>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Пикачу</label>
                  <Input
                    name="picachu"
                    value={formData.picachu}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Начальный баланс</label>
                  <Input
                    name="initialBalance"
                    type="number"
                    value={formData.initialBalance}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Комментарий</label>
                  <Input
                    name="comment"
                    value={formData.comment}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onClick={() => setIsCreateModalOpen(false)}>
                Отмена
              </Button>
              <Button color="primary" type="submit" isLoading={createMutation.isLoading}>
                Создать
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* Edit Card Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)}>
        <ModalContent>
          <form onSubmit={handleEditSubmit}>
            <ModalHeader>Редактировать карту</ModalHeader>
            <ModalBody>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Внешний ID</label>
                  <Input
                    name="externalId"
                    type="number"
                    value={formData.externalId}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Провайдер</label>
                  <Input
                    name="provider"
                    value={formData.provider}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Номер карты</label>
                  <Input
                    name="cardNumber"
                    value={formData.cardNumber}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Банк</label>
                  <Input
                    name="bank"
                    value={formData.bank}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Номер телефона</label>
                  <Input
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">ПИН приложения</label>
                  <Input
                    name="appPin"
                    type="number"
                    value={formData.appPin}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">ПИН терминала</label>
                  <Input
                    name="terminalPin"
                    value={formData.terminalPin}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Статус</label>
                  <Select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    required
                  >
                    <SelectItem value="active">Активна</SelectItem>
                    <SelectItem value="inactive">Неактивна</SelectItem>
                    <SelectItem value="blocked">Заблокирована</SelectItem>
                  </Select>
                </div>
                <div>
                <label className="block text-sm font-medium mb-1">Пикачу</label>
                <Input
                    name="picachu"
                    value={formData.picachu}
                    onChange={handleInputChange}
                />
                </div>
                <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Комментарий</label>
                <Input
                    name="comment"
                    value={formData.comment}
                    onChange={handleInputChange}
                />
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onClick={() => setIsEditModalOpen(false)}>
                Отмена
              </Button>
              <Button color="primary" type="submit" isLoading={updateMutation.isLoading}>
                Обновить
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  );
}