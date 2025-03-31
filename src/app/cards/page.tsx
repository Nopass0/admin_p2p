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
  DollarSign
} from "lucide-react";
import { Badge } from "@heroui/badge";
import { Select, SelectItem } from "@heroui/select";
import { Tooltip } from "@heroui/tooltip";
import { Tabs, Tab } from "@heroui/tabs";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { Chip } from "@heroui/chip";

export default function Cards() {
  // Pagination and sorting state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDirection, setSortDirection] = useState("desc");
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProvider, setFilterProvider] = useState("");
  const [filterBank, setFilterBank] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCollector, setFilterCollector] = useState("");
  const [filterPicachu, setFilterPicachu] = useState("");
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  
  // Modal and form state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPouringModalOpen, setIsPouringModalOpen] = useState(false);
  const [isViewPouringsModalOpen, setIsViewPouringsModalOpen] = useState(false);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [isViewBalancesModalOpen, setIsViewBalancesModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedPouring, setSelectedPouring] = useState(null);
  const [selectedBalance, setSelectedBalance] = useState(null);
  const [cardFormData, setCardFormData] = useState({
    externalId: 0,
    provider: "",
    cardNumber: "",
    bank: "",
    phoneNumber: "",
    appPin: 0,
    terminalPin: "",
    comment: "",
    status: "ACTIVE",
    picachu: "",
    initialBalance: 0,
    // Pouring data
    pouringAmount: 0,
    initialAmount: 0,
    initialDate: new Date().toISOString().split('T')[0],
    collectorName: "",
  });
  
  const [pouringFormData, setPouringFormData] = useState({
    cardId: 0,
    pouringDate: new Date().toISOString().split('T')[0],
    initialAmount: 0,
    initialDate: new Date().toISOString().split('T')[0],
    finalAmount: null,
    finalDate: null,
    pouringAmount: 0,
    withdrawalAmount: null,
    withdrawalDate: null,
    collectorName: "",
    status: "ACTIVE",
    comment: "",
  });
  
  const [balanceFormData, setBalanceFormData] = useState({
    cardId: 0,
    date: new Date().toISOString().split('T')[0],
    startBalance: 0,
    endBalance: 0
  });

  // Fetch cards with filters
  const cardsQuery = api.cards.getAll.useQuery({
    page,
    pageSize,
    searchQuery,
    sortBy,
    sortDirection,
    provider: filterProvider || undefined,
    bank: filterBank || undefined,
    status: filterStatus || undefined,
    collectorName: filterCollector || undefined,
    picachu: filterPicachu || undefined,
  });

  // Fetch filter options
  const filterOptionsQuery = api.cards.getFilterOptions.useQuery();

  // Card mutations
  const createCardMutation = api.cards.create.useMutation({
    onSuccess: () => {
      cardsQuery.refetch();
      setIsCreateModalOpen(false);
      resetCardForm();
    },
  });

  const updateCardMutation = api.cards.update.useMutation({
    onSuccess: () => {
      cardsQuery.refetch();
      setIsEditModalOpen(false);
    },
  });

  const deleteCardMutation = api.cards.delete.useMutation({
    onSuccess: () => {
      cardsQuery.refetch();
    },
  });

  // Pouring mutations
  const createPouringMutation = api.cards.createPouring.useMutation({
    onSuccess: () => {
      cardsQuery.refetch();
      setIsPouringModalOpen(false);
      resetPouringForm();
    },
  });

  const updatePouringMutation = api.cards.updatePouring.useMutation({
    onSuccess: () => {
      cardsQuery.refetch();
      setIsPouringModalOpen(false);
    },
  });

  const deletePouringMutation = api.cards.deletePouring.useMutation({
    onSuccess: () => {
      if (isViewPouringsModalOpen && selectedCard) {
        // Refetch card details to update pourings list
        cardDetailsQuery.refetch();
      } else {
        cardsQuery.refetch();
      }
    },
  });

  // Card details query for viewing pourings
  const cardDetailsQuery = api.cards.getById.useQuery(
    { id: selectedCard?.id || 0 },
    { enabled: !!selectedCard && (isViewPouringsModalOpen || isViewBalancesModalOpen) }
  );
  
  // Get card balances
  const cardBalancesQuery = api.cards.getCardBalances.useQuery(
    { cardId: selectedCard?.id || 0 },
    { enabled: !!selectedCard && isViewBalancesModalOpen }
  );
  
  // Balance mutations
  const createBalanceMutation = api.cards.createBalance.useMutation({
    onSuccess: () => {
      cardsQuery.refetch();
      if (isViewBalancesModalOpen) {
        cardBalancesQuery.refetch();
      }
      setIsBalanceModalOpen(false);
      resetBalanceForm();
    },
  });
  
  const updateBalanceMutation = api.cards.updateBalance.useMutation({
    onSuccess: () => {
      cardsQuery.refetch();
      if (isViewBalancesModalOpen) {
        cardBalancesQuery.refetch();
      }
      setIsBalanceModalOpen(false);
    },
  });
  
  const deleteBalanceMutation = api.cards.deleteBalance.useMutation({
    onSuccess: () => {
      cardsQuery.refetch();
      if (isViewBalancesModalOpen) {
        cardBalancesQuery.refetch();
      }
    },
  });

  // Reset form functions
  const resetCardForm = () => {
    setCardFormData({
      externalId: 0,
      provider: "",
      cardNumber: "",
      bank: "",
      phoneNumber: "",
      appPin: 0,
      terminalPin: "",
      comment: "",
      status: "ACTIVE",
      picachu: "",
      initialBalance: 0,
      pouringAmount: 0,
      initialAmount: 0,
      initialDate: new Date().toISOString().split('T')[0],
      collectorName: "",
    });
  };

  const resetPouringForm = () => {
    setPouringFormData({
      cardId: selectedCard?.id || 0,
      pouringDate: new Date().toISOString().split('T')[0],
      initialAmount: 0,
      initialDate: new Date().toISOString().split('T')[0],
      finalAmount: null,
      finalDate: null,
      pouringAmount: 0,
      withdrawalAmount: null,
      withdrawalDate: null,
      collectorName: "",
      status: "ACTIVE",
      comment: "",
    });
  };
  
  const resetBalanceForm = () => {
    setBalanceFormData({
      cardId: selectedCard?.id || 0,
      date: new Date().toISOString().split('T')[0],
      startBalance: 0,
      endBalance: 0
    });
  };

  // Form change handlers
  const handleCardFormChange = (e) => {
    const { name, value, type } = e.target;
    
    setCardFormData({
      ...cardFormData,
      [name]: type === "number" ? Number(value) : value,
    });
  };

  const handlePouringFormChange = (e) => {
    const { name, value, type } = e.target;
    
    setPouringFormData({
      ...pouringFormData,
      [name]: type === "number" ? Number(value) : value,
    });
  };
  
  const handleBalanceFormChange = (e) => {
    const { name, value, type } = e.target;
    
    setBalanceFormData({
      ...balanceFormData,
      [name]: type === "number" ? Number(value) : value,
    });
  };

  // Form submit handlers
  const handleCreateCardSubmit = (e) => {
    e.preventDefault();
    createCardMutation.mutate(cardFormData);
  };

  const handleEditCardSubmit = (e) => {
    e.preventDefault();
    updateCardMutation.mutate({
      id: selectedCard.id,
      ...cardFormData
    });
  };

  const handleCreatePouringSubmit = (e) => {
    e.preventDefault();
    createPouringMutation.mutate({
      ...pouringFormData,
      cardId: selectedCard.id,
    });
  };

  const handleUpdatePouringSubmit = (e) => {
    e.preventDefault();
    updatePouringMutation.mutate({
      id: selectedPouring.id,
      ...pouringFormData,
    });
  };
  
  const handleCreateBalanceSubmit = (e) => {
    e.preventDefault();
    createBalanceMutation.mutate({
      ...balanceFormData,
      cardId: selectedCard.id,
    });
  };
  
  const handleUpdateBalanceSubmit = (e) => {
    e.preventDefault();
    updateBalanceMutation.mutate({
      ...balanceFormData,
    });
  };

  // Click handlers
  const handleEditCardClick = (card) => {
    setSelectedCard(card);
    setCardFormData({
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

  const handleDeleteCardClick = (id) => {
    if (confirm("Вы уверены, что хотите удалить эту карту? Это действие нельзя отменить.")) {
      deleteCardMutation.mutate({ id });
    }
  };

  const handleAddPouringClick = (card) => {
    setSelectedCard(card);
    resetPouringForm();
    setIsPouringModalOpen(true);
  };

  const handleViewPouringsClick = (card) => {
    setSelectedCard(card);
    setIsViewPouringsModalOpen(true);
  };

  const handleEditPouringClick = (pouring) => {
    setSelectedPouring(pouring);
    setPouringFormData({
      cardId: pouring.cardId,
      pouringDate: new Date(pouring.pouringDate).toISOString().split('T')[0],
      initialAmount: pouring.initialAmount,
      initialDate: new Date(pouring.initialDate).toISOString().split('T')[0],
      finalAmount: pouring.finalAmount || null,
      finalDate: pouring.finalDate ? new Date(pouring.finalDate).toISOString().split('T')[0] : null,
      pouringAmount: pouring.pouringAmount,
      withdrawalAmount: pouring.withdrawalAmount || null,
      withdrawalDate: pouring.withdrawalDate ? new Date(pouring.withdrawalDate).toISOString().split('T')[0] : null,
      collectorName: pouring.collectorName || "",
      status: pouring.status,
      comment: pouring.comment || "",
    });
    setIsPouringModalOpen(true);
  };

  const handleDeletePouringClick = (id) => {
    if (confirm("Вы уверены, что хотите удалить этот пролив? Это действие нельзя отменить.")) {
      deletePouringMutation.mutate({ id });
    }
  };
  
  const handleAddBalanceClick = (card) => {
    setSelectedCard(card);
    resetBalanceForm();
    setIsBalanceModalOpen(true);
  };
  
  const handleViewBalancesClick = (card) => {
    setSelectedCard(card);
    setIsViewBalancesModalOpen(true);
  };
  
  const handleEditBalanceClick = (balance) => {
    setSelectedBalance(balance);
    setBalanceFormData({
      cardId: balance.cardId,
      date: new Date(balance.date).toISOString().split('T')[0],
      startBalance: balance.startBalance,
      endBalance: balance.endBalance
    });
    setIsBalanceModalOpen(true);
  };
  
  const handleDeleteBalanceClick = (id) => {
    if (confirm("Вы уверены, что хотите удалить эту запись баланса? Это действие нельзя отменить.")) {
      deleteBalanceMutation.mutate({ id });
    }
  };

  // Utility functions
  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDirection("asc");
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString();
  };

  const clearFilters = () => {
    setFilterProvider("");
    setFilterBank("");
    setFilterStatus("");
    setFilterCollector("");
    setFilterPicachu("");
    setSearchQuery("");
  };

  // Status badge component
  const StatusBadge = ({ status }) => {
    switch (status) {
      case "ACTIVE":
        return (
          <Badge color="success" className="flex items-center gap-1">
            <CheckCircle size={14} />
            Активна
          </Badge>
        );
      case "WARNING":
        return (
          <Badge color="warning" className="flex items-center gap-1">
            <AlertCircle size={14} />
            Внимание
          </Badge>
        );
      case "BLOCKED":
        return (
          <Badge color="danger" className="flex items-center gap-1">
            <XCircle size={14} />
            Заблокирована
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Get the latest pouring for a card
  const getLatestPouring = (card) => {
    return card.pourings && card.pourings.length > 0 ? card.pourings[0] : null;
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
            
            <Dropdown>
              <DropdownTrigger>
                <Button
                  variant="flat"
                  startContent={<Filter size={18} />}
                >
                  Фильтры
                  {(filterProvider || filterBank || filterStatus || filterCollector || filterPicachu) && (
                    <Chip size="sm" className="ml-2">
                      {[filterProvider, filterBank, filterStatus, filterCollector, filterPicachu]
                        .filter(Boolean).length}
                    </Chip>
                  )}
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Filter options" className="w-80 p-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Поставщик</label>
                    <Select
                      value={filterProvider}
                      onChange={(e) => setFilterProvider(e.target.value)}
                    >
                      <SelectItem value="">Все</SelectItem>
                      {filterOptionsQuery.data?.providers.map(provider => (
                        <SelectItem key={provider} value={provider}>{provider}</SelectItem>
                      ))}
                    </Select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Банк</label>
                    <Select
                      value={filterBank}
                      onChange={(e) => setFilterBank(e.target.value)}
                    >
                      <SelectItem value="">Все</SelectItem>
                      {filterOptionsQuery.data?.banks.map(bank => (
                        <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                      ))}
                    </Select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Статус</label>
                    <Select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <SelectItem value="">Все</SelectItem>
                      <SelectItem value="ACTIVE">Активна</SelectItem>
                      <SelectItem value="WARNING">Внимание</SelectItem>
                      <SelectItem value="BLOCKED">Заблокирована</SelectItem>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Инкассатор</label>
                    <Select
                      value={filterCollector}
                      onChange={(e) => setFilterCollector(e.target.value)}
                    >
                      <SelectItem value="">Все</SelectItem>
                      {filterOptionsQuery.data?.collectorNames.map(name => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </Select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Пикачу</label>
                    <Select
                      value={filterPicachu}
                      onChange={(e) => setFilterPicachu(e.target.value)}
                    >
                      <SelectItem value="">Все</SelectItem>
                      {filterOptionsQuery.data?.picachus.map(picachu => (
                        <SelectItem key={picachu} value={picachu}>{picachu}</SelectItem>
                      ))}
                    </Select>
                  </div>
                  
                  <div className="flex justify-between mt-2">
                    <Button
                      variant="flat"
                      onClick={clearFilters}
                    >
                      Сбросить
                    </Button>
                    <Button
                      color="primary"
                      onClick={() => setIsFilterMenuOpen(false)}
                    >
                      Применить
                    </Button>
                  </div>
                </div>
              </DropdownMenu>
            </Dropdown>
            
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
                    ID {sortBy === "externalId" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableColumn>
                  <TableColumn className="cursor-pointer" onClick={() => handleSort("provider")}>
                    Поставщик {sortBy === "provider" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableColumn>
                  <TableColumn className="cursor-pointer" onClick={() => handleSort("bank")}>
                    Банк {sortBy === "bank" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableColumn>
                  <TableColumn className="cursor-pointer" onClick={() => handleSort("cardNumber")}>
                    Номер карты {sortBy === "cardNumber" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableColumn>
                  <TableColumn>Тел. номер</TableColumn>
                  <TableColumn>PIN приложения</TableColumn>
                  <TableColumn>PIN терминала</TableColumn>
                  <TableColumn>Начальная сумма</TableColumn>
                  <TableColumn>Сумма пролитого</TableColumn>
                  <TableColumn>Конечная сумма</TableColumn>
                  <TableColumn>Снятие</TableColumn>
                  <TableColumn>Инкассатор</TableColumn>
                  <TableColumn>Пикачу</TableColumn>
                  <TableColumn className="cursor-pointer" onClick={() => handleSort("status")}>
                    Статус {sortBy === "status" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableColumn>
                  <TableColumn>Действия</TableColumn>
                </TableHeader>
                <TableBody>
                  {cardsQuery.data?.cards.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={15} className="text-center py-6">
                        Нет данных для отображения
                      </TableCell>
                    </TableRow>
                  ) : (
                    cardsQuery.data?.cards.map((card) => {
                      const latestPouring = getLatestPouring(card);
                      const latestBalance = card.balances && card.balances.length > 0 
                        ? card.balances[0] 
                        : null;
                        
                      return (
                        <TableRow key={card.id}>
                          <TableCell>{card.externalId}</TableCell>
                          <TableCell>{card.provider}</TableCell>
                          <TableCell>{card.bank}</TableCell>
                          <TableCell>{card.cardNumber}</TableCell>
                          <TableCell>{card.phoneNumber}</TableCell>
                          <TableCell>{card.appPin}</TableCell>
                          <TableCell>{card.terminalPin}</TableCell>
                          <TableCell>
                            {latestPouring ? (
                              <Tooltip content={`Дата: ${formatDate(latestPouring.initialDate)}`}>
                                <span>{latestPouring.initialAmount.toFixed(2)} ₽</span>
                              </Tooltip>
                            ) : (
                              latestBalance ? latestBalance.startBalance.toFixed(2) + " ₽" : "—"
                            )}
                          </TableCell>
                          <TableCell>
                            {latestPouring ? latestPouring.pouringAmount.toFixed(2) + " ₽" : "—"}
                          </TableCell>
                          <TableCell>
                            {latestPouring && latestPouring.finalAmount ? (
                              <Tooltip content={`Дата: ${formatDate(latestPouring.finalDate)}`}>
                                <span>{latestPouring.finalAmount.toFixed(2)} ₽</span>
                              </Tooltip>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            {latestPouring && latestPouring.withdrawalAmount ? (
                              <Tooltip content={`Дата: ${formatDate(latestPouring.withdrawalDate)}`}>
                                <span>{latestPouring.withdrawalAmount.toFixed(2)} ₽</span>
                              </Tooltip>
                            ) : "—"}
                          </TableCell>
                          <TableCell>{latestPouring?.collectorName || "—"}</TableCell>
                          <TableCell>{card.picachu || "—"}</TableCell>
                          <TableCell>
                            <StatusBadge status={card.status} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Tooltip content="Редактировать карту">
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="light"
                                  onClick={() => handleEditCardClick(card)}
                                >
                                  <Edit size={16} />
                                </Button>
                              </Tooltip>
                              
                              <Tooltip content="Добавить пролив">
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="light"
                                  color="primary"
                                  onClick={() => handleAddPouringClick(card)}
                                >
                                  <DollarSign size={16} />
                                </Button>
                              </Tooltip>
                              
                              <Tooltip content="История проливов">
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="light"
                                  color="secondary"
                                  onClick={() => handleViewPouringsClick(card)}
                                >
                                  <Calendar size={16} />
                                </Button>
                              </Tooltip>
                              
                              <Tooltip content="Добавить баланс">
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="light"
                                  color="success"
                                  onClick={() => handleAddBalanceClick(card)}
                                >
                                  <DollarSign size={16} />
                                </Button>
                              </Tooltip>
                              
                              <Tooltip content="История балансов">
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="light"
                                  color="warning"
                                  onClick={() => handleViewBalancesClick(card)}
                                >
                                  <RefreshCw size={16} />
                                </Button>
                              </Tooltip>
                              
                              <Tooltip content="Удалить карту">
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="light"
                                  color="danger"
                                  onClick={() => handleDeleteCardClick(card.id)}
                                >
                                  <Trash size={16} />
                                </Button>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
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
      <Modal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)}
        size="2xl"
      >
        <ModalContent>
          <form onSubmit={handleCreateCardSubmit}>
            <ModalHeader>Добавить новую карту</ModalHeader>
            <ModalBody>
              <Tabs>
                <Tab key="card-info" title="Основная информация">
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Внешний ID</label>
                      <Input
                        name="externalId"
                        type="number"
                        value={cardFormData.externalId}
                        onChange={handleCardFormChange}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Поставщик</label>
                      <Input
                        name="provider"
                        value={cardFormData.provider}
                        onChange={handleCardFormChange}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Номер карты</label>
                      <Input
                        name="cardNumber"
                        value={cardFormData.cardNumber}
                        onChange={handleCardFormChange}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Банк</label>
                      <Input
                        name="bank"
                        value={cardFormData.bank}
                        onChange={handleCardFormChange}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Номер телефона</label>
                      <Input
                        name="phoneNumber"
                        value={cardFormData.phoneNumber}
                        onChange={handleCardFormChange}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">PIN приложения</label>
                      <Input
                        name="appPin"
                        type="number"
                        value={cardFormData.appPin}
                        onChange={handleCardFormChange}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">PIN терминала</label>
                      <Input
                        name="terminalPin"
                        value={cardFormData.terminalPin}
                        onChange={handleCardFormChange}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Статус</label>
                      <Select
                        name="status"
                        value={cardFormData.status}
                        onChange={handleCardFormChange}
                      >
                        <SelectItem key="ACTIVE" value="ACTIVE">Активна</SelectItem>
                        <SelectItem key="WARNING" value="WARNING">Внимание</SelectItem>
                        <SelectItem key="BLOCKED" value="BLOCKED">Заблокирована</SelectItem>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Пикачу</label>
                      <Input
                        name="picachu"
                        value={cardFormData.picachu}
                        onChange={handleCardFormChange}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Начальный баланс</label>
                      <Input
                        name="initialBalance"
                        type="number"
                        value={cardFormData.initialBalance}
                        onChange={handleCardFormChange}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1">Комментарий</label>
                      <Input
                        name="comment"
                        value={cardFormData.comment}
                        onChange={handleCardFormChange}
                      />
                    </div>
                  </div>
                </Tab>
                <Tab key="pouring-info" title="Начальный пролив">
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Сумма начального пролива</label>
                      <Input
                        name="pouringAmount"
                        type="number"
                        value={cardFormData.pouringAmount}
                        onChange={handleCardFormChange}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Начальная сумма</label>
                      <Input
                        name="initialAmount"
                        type="number"
                        value={cardFormData.initialAmount}
                        onChange={handleCardFormChange}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Дата начала</label>
                      <Input
                        name="initialDate"
                        type="date"
                        value={cardFormData.initialDate}
                        onChange={handleCardFormChange}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Инкассатор</label>
                      <Input
                        name="collectorName"
                        value={cardFormData.collectorName}
                        onChange={handleCardFormChange}
                      />
                    </div>
                  </div>
                </Tab>
              </Tabs>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onClick={() => setIsCreateModalOpen(false)}>
                Отмена
              </Button>
              <Button color="primary" type="submit" isLoading={createCardMutation.isLoading}>
                Создать
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* Edit Card Modal */}
      <Modal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)}
        size="2xl"
      >
        <ModalContent>
          <form onSubmit={handleEditCardSubmit}>
            <ModalHeader>Редактировать карту</ModalHeader>
            <ModalBody>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Внешний ID</label>
                  <Input
                    name="externalId"
                    type="number"
                    value={cardFormData.externalId}
                    onChange={handleCardFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Поставщик</label>
                  <Input
                    name="provider"
                    value={cardFormData.provider}
                    onChange={handleCardFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Номер карты</label>
                  <Input
                    name="cardNumber"
                    value={cardFormData.cardNumber}
                    onChange={handleCardFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Банк</label>
                  <Input
                    name="bank"
                    value={cardFormData.bank}
                    onChange={handleCardFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Номер телефона</label>
                  <Input
                    name="phoneNumber"
                    value={cardFormData.phoneNumber}
                    onChange={handleCardFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">PIN приложения</label>
                  <Input
                    name="appPin"
                    type="number"
                    value={cardFormData.appPin}
                    onChange={handleCardFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">PIN терминала</label>
                  <Input
                    name="terminalPin"
                    value={cardFormData.terminalPin}
                    onChange={handleCardFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Статус</label>
                  <Select
                    name="status"
                    value={cardFormData.status}
                    onChange={handleCardFormChange}
                    required
                  >
                    <SelectItem key="ACTIVE" value="ACTIVE">Активна</SelectItem>
                    <SelectItem key="WARNING" value="WARNING">Внимание</SelectItem>
                    <SelectItem key="BLOCKED" value="BLOCKED">Заблокирована</SelectItem>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Пикачу</label>
                  <Input
                    name="picachu"
                    value={cardFormData.picachu}
                    onChange={handleCardFormChange}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Комментарий</label>
                  <Input
                    name="comment"
                    value={cardFormData.comment}
                    onChange={handleCardFormChange}
                  />
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onClick={() => setIsEditModalOpen(false)}>
                Отмена
              </Button>
              <Button color="primary" type="submit" isLoading={updateCardMutation.isLoading}>
                Обновить
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* Create/Edit Pouring Modal */}
      <Modal 
        isOpen={isPouringModalOpen} 
        onClose={() => setIsPouringModalOpen(false)}
        size="2xl"
      >
        <ModalContent>
          <form onSubmit={selectedPouring ? handleUpdatePouringSubmit : handleCreatePouringSubmit}>
            <ModalHeader>
              {selectedPouring ? "Редактировать пролив" : "Добавить пролив"}
            </ModalHeader>
            <ModalBody>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Дата пролива</label>
                  <Input
                    name="pouringDate"
                    type="date"
                    value={pouringFormData.pouringDate}
                    onChange={handlePouringFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Сумма пролитого</label>
                  <Input
                    name="pouringAmount"
                    type="number"
                    value={pouringFormData.pouringAmount}
                    onChange={handlePouringFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Начальная сумма</label>
                  <Input
                    name="initialAmount"
                    type="number"
                    value={pouringFormData.initialAmount}
                    onChange={handlePouringFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Дата начальной суммы</label>
                  <Input
                    name="initialDate"
                    type="date"
                    value={pouringFormData.initialDate}
                    onChange={handlePouringFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Конечная сумма</label>
                  <Input
                    name="finalAmount"
                    type="number"
                    value={pouringFormData.finalAmount || ""}
                    onChange={handlePouringFormChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Дата конечной суммы</label>
                  <Input
                    name="finalDate"
                    type="date"
                    value={pouringFormData.finalDate || ""}
                    onChange={handlePouringFormChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Сумма снятого</label>
                  <Input
                    name="withdrawalAmount"
                    type="number"
                    value={pouringFormData.withdrawalAmount || ""}
                    onChange={handlePouringFormChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Дата снятия</label>
                  <Input
                    name="withdrawalDate"
                    type="date"
                    value={pouringFormData.withdrawalDate || ""}
                    onChange={handlePouringFormChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Инкассатор</label>
                  <Input
                    name="collectorName"
                    value={pouringFormData.collectorName || ""}
                    onChange={handlePouringFormChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Статус</label>
                  <Select
                    name="status"
                    value={pouringFormData.status}
                    onChange={handlePouringFormChange}
                    required
                  >
                    <SelectItem key="ACTIVE" value="ACTIVE">Активна</SelectItem>
                    <SelectItem key="WARNING" value="WARNING">Внимание</SelectItem>
                    <SelectItem key="BLOCKED" value="BLOCKED">Заблокирована</SelectItem>
                  </Select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Комментарий</label>
                  <Input
                    name="comment"
                    value={pouringFormData.comment || ""}
                    onChange={handlePouringFormChange}
                  />
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onClick={() => setIsPouringModalOpen(false)}>
                Отмена
              </Button>
              <Button 
                color="primary" 
                type="submit" 
                isLoading={selectedPouring ? updatePouringMutation.isLoading : createPouringMutation.isLoading}
              >
                {selectedPouring ? "Обновить" : "Создать"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* View Pourings Modal */}
      <Modal 
        isOpen={isViewPouringsModalOpen} 
        onClose={() => setIsViewPouringsModalOpen(false)}
        size="3xl"
      >
        <ModalContent>
          <ModalHeader>
            История проливов для карты {selectedCard?.cardNumber}
          </ModalHeader>
          <ModalBody>
            {cardDetailsQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner size="lg" />
              </div>
            ) : cardDetailsQuery.data?.pourings.length === 0 ? (
              <div className="text-center py-6">
                Нет проливов для отображения
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableColumn>Дата</TableColumn>
                  <TableColumn>Начальная сумма</TableColumn>
                  <TableColumn>Сумма пролитого</TableColumn>
                  <TableColumn>Конечная сумма</TableColumn>
                  <TableColumn>Снятие</TableColumn>
                  <TableColumn>Инкассатор</TableColumn>
                  <TableColumn>Статус</TableColumn>
                  <TableColumn>Действия</TableColumn>
                </TableHeader>
                <TableBody>
                  {cardDetailsQuery.data?.pourings.map((pouring) => (
                    <TableRow key={pouring.id}>
                      <TableCell>{formatDate(pouring.pouringDate)}</TableCell>
                      <TableCell>
                        <Tooltip content={`Дата: ${formatDate(pouring.initialDate)}`}>
                          <span>{pouring.initialAmount.toFixed(2)} ₽</span>
                        </Tooltip>
                      </TableCell>
                      <TableCell>{pouring.pouringAmount.toFixed(2)} ₽</TableCell>
                      <TableCell>
                        {pouring.finalAmount ? (
                          <Tooltip content={`Дата: ${formatDate(pouring.finalDate)}`}>
                            <span>{pouring.finalAmount.toFixed(2)} ₽</span>
                          </Tooltip>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        {pouring.withdrawalAmount ? (
                          <Tooltip content={`Дата: ${formatDate(pouring.withdrawalDate)}`}>
                            <span>{pouring.withdrawalAmount.toFixed(2)} ₽</span>
                          </Tooltip>
                        ) : "—"}
                      </TableCell>
                      <TableCell>{pouring.collectorName || "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={pouring.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            onClick={() => handleEditPouringClick(pouring)}
                          >
                            <Edit size={16} />
                          </Button>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            onClick={() => handleDeletePouringClick(pouring.id)}
                          >
                            <Trash size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="primary" onClick={() => setIsViewPouringsModalOpen(false)}>
              Закрыть
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Create/Edit Balance Modal */}
      <Modal 
        isOpen={isBalanceModalOpen} 
        onClose={() => setIsBalanceModalOpen(false)}
      >
        <ModalContent>
          <form onSubmit={selectedBalance ? handleUpdateBalanceSubmit : handleCreateBalanceSubmit}>
            <ModalHeader>
              {selectedBalance ? "Редактировать баланс" : "Добавить баланс"}
            </ModalHeader>
            <ModalBody>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Дата</label>
                  <Input
                    name="date"
                    type="date"
                    value={balanceFormData.date}
                    onChange={handleBalanceFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Начальный баланс</label>
                  <Input
                    name="startBalance"
                    type="number"
                    value={balanceFormData.startBalance}
                    onChange={handleBalanceFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Конечный баланс</label>
                  <Input
                    name="endBalance"
                    type="number"
                    value={balanceFormData.endBalance}
                    onChange={handleBalanceFormChange}
                    required
                  />
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onClick={() => setIsBalanceModalOpen(false)}>
                Отмена
              </Button>
              <Button 
                color="primary" 
                type="submit" 
                isLoading={selectedBalance ? updateBalanceMutation.isLoading : createBalanceMutation.isLoading}
              >
                {selectedBalance ? "Обновить" : "Создать"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* View Balances Modal */}
      <Modal 
        isOpen={isViewBalancesModalOpen} 
        onClose={() => setIsViewBalancesModalOpen(false)}
        size="2xl"
      >
        <ModalContent>
          <ModalHeader>
            История балансов для карты {selectedCard?.cardNumber}
          </ModalHeader>
          <ModalBody>
            {cardBalancesQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner size="lg" />
              </div>
            ) : cardBalancesQuery.data?.length === 0 ? (
              <div className="text-center py-6">
                Нет записей балансов для отображения
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableColumn>Дата</TableColumn>
                  <TableColumn>Начальный баланс</TableColumn>
                  <TableColumn>Конечный баланс</TableColumn>
                  <TableColumn>Разница</TableColumn>
                  <TableColumn>Действия</TableColumn>
                </TableHeader>
                <TableBody>
                  {cardBalancesQuery.data?.map((balance) => (
                    <TableRow key={balance.id}>
                      <TableCell>{formatDate(balance.date)}</TableCell>
                      <TableCell>{balance.startBalance.toFixed(2)} ₽</TableCell>
                      <TableCell>{balance.endBalance.toFixed(2)} ₽</TableCell>
                      <TableCell>{(balance.endBalance - balance.startBalance).toFixed(2)} ₽</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            onClick={() => handleEditBalanceClick(balance)}
                          >
                            <Edit size={16} />
                          </Button>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            onClick={() => handleDeleteBalanceClick(balance.id)}
                          >
                            <Trash size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="primary" onClick={() => setIsViewBalancesModalOpen(false)}>
              Закрыть
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}