"use client";

import { useState, useEffect } from "react";
import { api } from "@/trpc/react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Spinner } from "@heroui/spinner";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
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
  ArrowUpDown,
} from "lucide-react";

export default function Cards() {
  // Pagination and sorting state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDirection, setSortDirection] = useState("desc");

  // Detailed view toggle
  const [showDetailedView, setShowDetailedView] = useState(false);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProvider, setFilterProvider] = useState("");
  const [filterBank, setFilterBank] = useState("");
  const [filterInWork, setFilterInWork] = useState(""); // Новый фильтр "В работе"
  const [filterActor, setFilterActor] = useState(""); // Новый фильтр "Актер"
  const [filterPicachu, setFilterPicachu] = useState("");
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPouringModalOpen, setIsPouringModalOpen] = useState(false);
  const [isViewPouringsModalOpen, setIsViewPouringsModalOpen] = useState(false);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [isViewBalancesModalOpen, setIsViewBalancesModalOpen] = useState(false);

  // Selected data state
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedPouring, setSelectedPouring] = useState(null);
  const [selectedBalance, setSelectedBalance] = useState(null);

  // Form state
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
    cardPrice: 0,
    isPaid: false,
    inWork: false,
    actor: "",
    // Initial data
    initialBalance: 0,
    pouringAmount: 0,
    initialAmount: 0,
    initialDate: new Date().toISOString().split("T")[0],
    collectorName: "",
  });

  // Form state for pouring
  const [pouringFormData, setPouringFormData] = useState({
    cardId: 0,
    pouringDate: new Date().toISOString().split("T")[0],
    initialAmount: 0,
    initialDate: new Date().toISOString().split("T")[0],
    finalAmount: null,
    finalDate: null,
    pouringAmount: 0,
    withdrawalAmount: null,
    withdrawalDate: null,
    collectorName: "",
    status: "ACTIVE",
    comment: "",
  });

  // Form state for balance
  const [balanceFormData, setBalanceFormData] = useState({
    cardId: 0,
    date: new Date().toISOString().split("T")[0],
    startBalance: 0,
    endBalance: 0,
    comment: "",
  });

  // Конвертировать строку в boolean для фильтра inWork
  const convertInWorkFilter = (value) => {
    if (value === "yes") return true;
    if (value === "no") return false;
    return undefined;
  };

  // API Queries
  const filterOptionsQuery = api.cards.getFilterOptions.useQuery();
  const statsQuery = api.cards.getStats.useQuery();

  const cardsQuery = api.cards.getAll.useQuery({
    page,
    pageSize,
    searchQuery,
    sortBy,
    sortDirection,
    provider: filterProvider || undefined,
    bank: filterBank || undefined,
    inWork: convertInWorkFilter(filterInWork),
    actor: filterActor || undefined,
    picachu: filterPicachu || undefined,
  });

  // Card details query for viewing pourings/balances
  const cardDetailsQuery = api.cards.getById.useQuery(
    { id: selectedCard?.id || 0 },
    {
      enabled:
        !!selectedCard &&
        (isViewPouringsModalOpen ||
          isViewBalancesModalOpen ||
          isPouringModalOpen ||
          isBalanceModalOpen),
    },
  );

  // Get card balances
  const cardBalancesQuery = api.cards.getCardBalances.useQuery(
    { cardId: selectedCard?.id || 0 },
    { enabled: !!selectedCard && isViewBalancesModalOpen },
  );

  // Get card pourings
  const cardPouringsQuery = api.cards.getCardPourings.useQuery(
    { cardId: selectedCard?.id || 0 },
    { enabled: !!selectedCard && isViewPouringsModalOpen },
  );

  // Safe filter options with fallbacks
  const safeFilterOptions = {
    providers: filterOptionsQuery.data?.providers || [],
    banks: filterOptionsQuery.data?.banks || [],
    collectorNames: filterOptionsQuery.data?.collectorNames || [],
    picachus: filterOptionsQuery.data?.picachus || [],
    actors: filterOptionsQuery.data?.actors || [],
  };

  // Mutations
  const createCardMutation = api.cards.create.useMutation({
    onSuccess: () => {
      cardsQuery.refetch();
      statsQuery.refetch();
      setIsCreateModalOpen(false);
      resetCardForm();
    },
  });

  const updateCardMutation = api.cards.update.useMutation({
    onSuccess: () => {
      cardsQuery.refetch();
      statsQuery.refetch();
      setIsEditModalOpen(false);
    },
  });

  const deleteCardMutation = api.cards.delete.useMutation({
    onSuccess: () => {
      cardsQuery.refetch();
      statsQuery.refetch();
    },
  });

  // Pouring mutations
  const createPouringMutation = api.cards.createPouring.useMutation({
    onSuccess: () => {
      cardsQuery.refetch();
      cardPouringsQuery.refetch();
      statsQuery.refetch();
      setIsPouringModalOpen(false);
      resetPouringForm();
    },
  });

  const updatePouringMutation = api.cards.updatePouring.useMutation({
    onSuccess: () => {
      cardsQuery.refetch();
      cardPouringsQuery.refetch();
      statsQuery.refetch();
      setIsPouringModalOpen(false);
    },
  });

  const deletePouringMutation = api.cards.deletePouring.useMutation({
    onSuccess: () => {
      cardsQuery.refetch();
      if (isViewPouringsModalOpen) {
        cardPouringsQuery.refetch();
      }
      statsQuery.refetch();
    },
  });

  // Balance mutations
  const createBalanceMutation = api.cards.createBalance.useMutation({
    onSuccess: () => {
      cardsQuery.refetch();
      if (isViewBalancesModalOpen) {
        cardBalancesQuery.refetch();
      }
      statsQuery.refetch();
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
      statsQuery.refetch();
      setIsBalanceModalOpen(false);
    },
  });

  const deleteBalanceMutation = api.cards.deleteBalance.useMutation({
    onSuccess: () => {
      cardsQuery.refetch();
      if (isViewBalancesModalOpen) {
        cardBalancesQuery.refetch();
      }
      statsQuery.refetch();
    },
  });

  // Form handlers
  const handleCardFormChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Обработка чекбоксов
    if (type === "checkbox") {
      setCardFormData({
        ...cardFormData,
        [name]: checked,
      });
      return;
    }

    setCardFormData({
      ...cardFormData,
      [name]: type === "number" ? Number(value) : value,
    });
  };

  const handlePouringFormChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === "checkbox") {
      setPouringFormData({
        ...pouringFormData,
        [name]: checked,
      });
      return;
    }

    setPouringFormData({
      ...pouringFormData,
      [name]: type === "number" ? Number(value) : value,
    });
  };

  const handleBalanceFormChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === "checkbox") {
      setBalanceFormData({
        ...balanceFormData,
        [name]: checked,
      });
      return;
    }

    setBalanceFormData({
      ...balanceFormData,
      [name]: type === "number" ? Number(value) : value,
    });
  };

  const handleCreateCardSubmit = (e) => {
    e.preventDefault();
    createCardMutation.mutate(cardFormData);
  };

  const handleEditCardSubmit = (e) => {
    e.preventDefault();
    updateCardMutation.mutate({
      id: selectedCard.id,
      ...cardFormData,
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

  // Utility functions
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
      cardPrice: 0,
      isPaid: false,
      inWork: false,
      actor: "",
      initialBalance: 0,
      pouringAmount: 0,
      initialAmount: 0,
      initialDate: new Date().toISOString().split("T")[0],
      collectorName: "",
    });
  };

  const resetPouringForm = () => {
    setPouringFormData({
      cardId: selectedCard?.id || 0,
      pouringDate: new Date().toISOString().split("T")[0],
      initialAmount: 0,
      initialDate: new Date().toISOString().split("T")[0],
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
      date: new Date().toISOString().split("T")[0],
      startBalance: 0,
      endBalance: 0,
      comment: "",
    });
  };

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
    return new Date(dateString).toLocaleDateString("ru-RU");
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString("ru-RU");
  };

  const formatNumber = (number, decimals = 2) => {
    if (number === null || number === undefined) return "—";
    return (
      number.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽"
    );
  };

  const clearFilters = () => {
    setFilterProvider("");
    setFilterBank("");
    setFilterInWork(""); // Очистка нового фильтра
    setFilterActor(""); // Очистка нового фильтра
    setFilterPicachu("");
    setSearchQuery("");
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
      cardPrice: card.cardPrice || 0,
      isPaid: card.isPaid || false,
      inWork: card.inWork || false,
      actor: card.actor || "",
    });
    setIsEditModalOpen(true);
  };

  const handleDeleteCardClick = (id) => {
    if (
      confirm(
        "Вы уверены, что хотите удалить эту карту? Это действие нельзя отменить.",
      )
    ) {
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
      pouringDate: new Date(pouring.pouringDate).toISOString().split("T")[0],
      initialAmount: pouring.initialAmount,
      initialDate: new Date(pouring.initialDate).toISOString().split("T")[0],
      finalAmount: pouring.finalAmount || null,
      finalDate: pouring.finalDate
        ? new Date(pouring.finalDate).toISOString().split("T")[0]
        : null,
      pouringAmount: pouring.pouringAmount,
      withdrawalAmount: pouring.withdrawalAmount || null,
      withdrawalDate: pouring.withdrawalDate
        ? new Date(pouring.withdrawalDate).toISOString().split("T")[0]
        : null,
      collectorName: pouring.collectorName || "",
      status: pouring.status,
      comment: pouring.comment || "",
    });
    setIsPouringModalOpen(true);
  };

  const handleDeletePouringClick = (id) => {
    if (
      confirm(
        "Вы уверены, что хотите удалить этот пролив? Это действие нельзя отменить.",
      )
    ) {
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
      date: new Date(balance.date).toISOString().split("T")[0],
      startBalance: balance.startBalance,
      endBalance: balance.endBalance,
      comment: balance.comment || "",
    });
    setIsBalanceModalOpen(true);
  };

  const handleDeleteBalanceClick = (id) => {
    if (
      confirm(
        "Вы уверены, что хотите удалить эту запись баланса? Это действие нельзя отменить.",
      )
    ) {
      deleteBalanceMutation.mutate({ id });
    }
  };

  // Render payment method (C2C/СБП)
  const renderPaymentMethod = (card) => {
    const hasCardNumber = card.cardNumber && card.cardNumber.trim() !== "";
    const hasPhoneNumber = card.phoneNumber && card.phoneNumber.trim() !== "";

    if (hasCardNumber && hasPhoneNumber) {
      return (
        <div className="flex flex-col space-y-1">
          <div className="text-green-600">C2C: {card.cardNumber}</div>
          <div className="text-red-600">СБП: {card.phoneNumber}</div>
        </div>
      );
    } else if (hasCardNumber) {
      return <div className="text-green-600">C2C: {card.cardNumber}</div>;
    } else if (hasPhoneNumber) {
      return <div className="text-red-600">СБП: {card.phoneNumber}</div>;
    } else {
      return "—";
    }
  };

  // Get the latest pouring for a card
  const getLatestPouring = (card) => {
    return card.pourings && card.pourings.length > 0 ? card.pourings[0] : null;
  };

  // Get the latest balance for a card
  const getLatestBalance = (card) => {
    return card.balances && card.balances.length > 0 ? card.balances[0] : null;
  };

  return (
    <div className="mx-auto w-full px-4 py-8">
      <Card className="w-full">
        <CardHeader className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <CreditCard className="h-6 w-6" />
            Карты
          </h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400"
                size={18}
              />
              <Input
                className="w-64 pl-10"
                placeholder="Поиск карт..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={showDetailedView}
                onChange={(e) => setShowDetailedView(e.target.checked)}
              />
              <span className="text-sm">Детализированный просмотр</span>
            </div>

            <Button
              variant="flat"
              startContent={<Filter size={18} />}
              onPress={() => setIsFilterMenuOpen(true)}
            >
              Фильтры
              {(filterProvider ||
                filterBank ||
                filterInWork ||
                filterActor ||
                filterPicachu) && (
                <Chip size="sm" className="ml-2">
                  {
                    [
                      filterProvider,
                      filterBank,
                      filterInWork,
                      filterActor,
                      filterPicachu,
                    ].filter(Boolean).length
                  }
                </Chip>
              )}
            </Button>

            <Button
              color="primary"
              startContent={<PlusIcon size={18} />}
              onPress={() => setIsCreateModalOpen(true)}
            >
              Добавить карту
            </Button>

            <Button
              isIconOnly
              variant="light"
              onPress={() => {
                cardsQuery.refetch();
                statsQuery.refetch();
              }}
            >
              <RefreshCw size={18} />
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {/* Statistics cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <Card className="bg-blue-50 shadow-sm dark:bg-blue-900/20">
              <CardBody className="p-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Общая стоимость карт
                  </span>
                  <DollarSign className="h-4 w-4 text-blue-500" />
                </div>
                <div className="flex items-center">
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {formatNumber(statsQuery.data?.totalCardPrice || 0, 0)}
                  </span>
                </div>
              </CardBody>
            </Card>

            <Card className="bg-green-50 shadow-sm dark:bg-green-900/20">
              <CardBody className="p-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Общая сумма балансов
                  </span>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex items-center">
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatNumber(statsQuery.data?.totalInitialBalance || 0, 0)}
                  </span>
                </div>
              </CardBody>
            </Card>

            <Card className="bg-amber-50 shadow-sm dark:bg-amber-900/20">
              <CardBody className="p-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Общая сумма пролитого
                  </span>
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                </div>
                <div className="flex items-center">
                  <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {formatNumber(statsQuery.data?.totalPouredAmount || 0, 0)}
                  </span>
                </div>
              </CardBody>
            </Card>

            <Card className="bg-purple-50 shadow-sm dark:bg-purple-900/20">
              <CardBody className="p-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Сумма всех выплат
                  </span>
                  <DollarSign className="h-4 w-4 text-purple-500" />
                </div>
                <div className="flex items-center">
                  <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {formatNumber(
                      statsQuery.data?.totalWithdrawalAmount || 0,
                      0,
                    )}
                  </span>
                </div>
              </CardBody>
            </Card>
          </div>

          {cardsQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="lg" />
            </div>
          ) : (
            <div>
              {/* Используем простую HTML таблицу вместо компонента Table из HeroUI */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                        onClick={() => handleSort("id")}
                      >
                        <div className="flex items-center">
                          ID
                          <ArrowUpDown size={14} className="ml-1" />
                          {sortBy === "id" && (
                            <span className="ml-1">
                              {sortDirection === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                        onClick={() => handleSort("bank")}
                      >
                        <div className="flex items-center">
                          Банк
                          <ArrowUpDown size={14} className="ml-1" />
                          {sortBy === "bank" && (
                            <span className="ml-1">
                              {sortDirection === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                      >
                        C2C / СБП
                      </th>
                      {showDetailedView && (
                        <th
                          scope="col"
                          className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                          onClick={() => handleSort("provider")}
                        >
                          <div className="flex items-center">
                            Поставщик
                            <ArrowUpDown size={14} className="ml-1" />
                            {sortBy === "provider" && (
                              <span className="ml-1">
                                {sortDirection === "asc" ? "↑" : "↓"}
                              </span>
                            )}
                          </div>
                        </th>
                      )}
                      <th
                        scope="col"
                        className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                        onClick={() => handleSort("cardPrice")}
                      >
                        <div className="flex items-center">
                          Стоимость
                          <ArrowUpDown size={14} className="ml-1" />
                          {sortBy === "cardPrice" && (
                            <span className="ml-1">
                              {sortDirection === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                        onClick={() => handleSort("isPaid")}
                      >
                        <div className="flex items-center">
                          Оплата
                          <ArrowUpDown size={14} className="ml-1" />
                          {sortBy === "isPaid" && (
                            <span className="ml-1">
                              {sortDirection === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                        onClick={() => handleSort("inWork")}
                      >
                        <div className="flex items-center">
                          В работе
                          <ArrowUpDown size={14} className="ml-1" />
                          {sortBy === "inWork" && (
                            <span className="ml-1">
                              {sortDirection === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                      >
                        <div className="flex items-center justify-end">
                          Баланс на начало
                          <Tooltip content="Баланс на начало пролива">
                            <Info size={14} className="ml-1" />
                          </Tooltip>
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                      >
                        <div className="flex items-center justify-end">
                          Баланс на конец
                          <Tooltip content="Баланс на конец пролива">
                            <Info size={14} className="ml-1" />
                          </Tooltip>
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                      >
                        <div className="flex items-center justify-end">
                          Пролито
                          <Tooltip content="Разница балансов">
                            <Info size={14} className="ml-1" />
                          </Tooltip>
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                      >
                        <div className="flex items-center justify-end">
                          Сумма выплат
                          <Tooltip content="Общая сумма выплат">
                            <Info size={14} className="ml-1" />
                          </Tooltip>
                        </div>
                      </th>
                      {showDetailedView && (
                        <th
                          scope="col"
                          className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                          onClick={() => handleSort("actor")}
                        >
                          <div className="flex items-center">
                            Актер
                            <ArrowUpDown size={14} className="ml-1" />
                            {sortBy === "actor" && (
                              <span className="ml-1">
                                {sortDirection === "asc" ? "↑" : "↓"}
                              </span>
                            )}
                          </div>
                        </th>
                      )}
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                      >
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {!cardsQuery.data?.cards ||
                    cardsQuery.data.cards.length === 0 ? (
                      <tr>
                        <td
                          colSpan={showDetailedView ? 13 : 11}
                          className="whitespace-nowrap px-6 py-4 text-center text-sm text-gray-500"
                        >
                          Нет данных для отображения
                        </td>
                      </tr>
                    ) : (
                      cardsQuery.data.cards.map((card) => {
                        const latestPouring = getLatestPouring(card);
                        const latestBalance = getLatestBalance(card);

                        return (
                          <tr key={card.id}>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                              {card.externalId}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                              {card.bank}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm">
                              {renderPaymentMethod(card)}
                            </td>

                            {showDetailedView && (
                              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                                {card.provider}
                              </td>
                            )}

                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                              {card.cardPrice
                                ? formatNumber(card.cardPrice, 0)
                                : "—"}
                            </td>

                            <td className="whitespace-nowrap px-6 py-4 text-sm">
                              <Badge
                                color={card.isPaid ? "success" : "warning"}
                              >
                                {card.isPaid ? "Оплачено" : "Не оплачено"}
                              </Badge>
                            </td>

                            <td className="whitespace-nowrap px-6 py-4 text-sm">
                              <Badge
                                color={card.inWork ? "primary" : "default"}
                              >
                                {card.inWork ? "Да" : "Нет"}
                              </Badge>
                            </td>

                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                              {latestPouring
                                ? formatNumber(latestPouring.initialAmount)
                                : "—"}
                            </td>

                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                              {latestPouring && latestPouring.finalAmount
                                ? formatNumber(latestPouring.finalAmount)
                                : "—"}
                            </td>

                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                              {latestPouring
                                ? formatNumber(latestPouring.pouringAmount)
                                : "—"}
                            </td>

                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                              {latestPouring && latestPouring.withdrawalAmount
                                ? formatNumber(latestPouring.withdrawalAmount)
                                : "—"}
                            </td>

                            {showDetailedView && (
                              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                                {card.actor || "—"}
                              </td>
                            )}

                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="light"
                                  onPress={() => handleEditCardClick(card)}
                                  title="Редактировать карту"
                                >
                                  <Edit size={16} />
                                </Button>

                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="light"
                                  color="primary"
                                  onPress={() => handleAddPouringClick(card)}
                                  title="Добавить пролив"
                                >
                                  <DollarSign size={16} />
                                </Button>

                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="light"
                                  color="secondary"
                                  onPress={() => handleViewPouringsClick(card)}
                                  title="История проливов"
                                >
                                  <Eye size={16} />
                                </Button>

                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="light"
                                  color="success"
                                  onPress={() => handleAddBalanceClick(card)}
                                  title="Добавить баланс"
                                >
                                  <DollarSign size={16} />
                                </Button>

                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="light"
                                  color="warning"
                                  onPress={() => handleViewBalancesClick(card)}
                                  title="История балансов"
                                >
                                  <Calendar size={16} />
                                </Button>

                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="light"
                                  color="danger"
                                  onPress={() => handleDeleteCardClick(card.id)}
                                  title="Удалить карту"
                                >
                                  <Trash size={16} />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Всего: {cardsQuery.data?.totalCount || 0} карт
                </div>
                <Pagination
                  total={cardsQuery.data?.totalPages || 1}
                  initialPage={page}
                  onChange={setPage}
                />
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Filter Modal */}
      <Modal
        isOpen={isFilterMenuOpen}
        onClose={() => setIsFilterMenuOpen(false)}
        size="sm"
      >
        <ModalContent>
          <ModalHeader>Фильтры</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Банк</label>
                <Select
                  value={filterBank}
                  onChange={(e) => setFilterBank(e.target.value)}
                  className="w-full"
                >
                  <SelectItem value="">Все</SelectItem>
                  {(Array.isArray(safeFilterOptions.banks)
                    ? safeFilterOptions.banks
                    : []
                  ).map((bank) => (
                    <SelectItem key={bank} value={bank}>
                      {bank}
                    </SelectItem>
                  ))}
                </Select>
              </div>

              {showDetailedView && (
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Поставщик
                  </label>
                  <Select
                    value={filterProvider}
                    onChange={(e) => setFilterProvider(e.target.value)}
                    className="w-full"
                  >
                    <SelectItem value="">Все</SelectItem>
                    {(Array.isArray(safeFilterOptions.providers)
                      ? safeFilterOptions.providers
                      : []
                    ).map((provider) => (
                      <SelectItem key={provider} value={provider}>
                        {provider}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium">
                  В работе
                </label>
                <Select
                  value={filterInWork}
                  onChange={(e) => setFilterInWork(e.target.value)}
                  className="w-full"
                >
                  <SelectItem value="">Все</SelectItem>
                  <SelectItem value="yes">Да</SelectItem>
                  <SelectItem value="no">Нет</SelectItem>
                </Select>
              </div>

              {showDetailedView && (
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Актер
                  </label>
                  <Select
                    value={filterActor}
                    onChange={(e) => setFilterActor(e.target.value)}
                    className="w-full"
                  >
                    <SelectItem value="">Все</SelectItem>
                    {(Array.isArray(safeFilterOptions.actors)
                      ? safeFilterOptions.actors
                      : []
                    ).map((actor) => (
                      <SelectItem key={actor} value={actor}>
                        {actor}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium">Пикачу</label>
                <Select
                  value={filterPicachu}
                  onChange={(e) => setFilterPicachu(e.target.value)}
                  className="w-full"
                >
                  <SelectItem value="">Все</SelectItem>
                  {(Array.isArray(safeFilterOptions.picachus)
                    ? safeFilterOptions.picachus
                    : []
                  ).map((picachu) => (
                    <SelectItem key={picachu} value={picachu}>
                      {picachu}
                    </SelectItem>
                  ))}
                </Select>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={clearFilters}>
              Сбросить
            </Button>
            <Button color="primary" onPress={() => setIsFilterMenuOpen(false)}>
              Применить
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

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
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Внешний ID
                      </label>
                      <Input
                        name="externalId"
                        type="number"
                        value={cardFormData.externalId}
                        onChange={handleCardFormChange}
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Поставщик
                      </label>
                      <Input
                        name="provider"
                        value={cardFormData.provider}
                        onChange={handleCardFormChange}
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Номер карты (C2C)
                      </label>
                      <Input
                        name="cardNumber"
                        value={cardFormData.cardNumber}
                        onChange={handleCardFormChange}
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Банк
                      </label>
                      <Input
                        name="bank"
                        value={cardFormData.bank}
                        onChange={handleCardFormChange}
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Номер телефона (СБП)
                      </label>
                      <Input
                        name="phoneNumber"
                        value={cardFormData.phoneNumber}
                        onChange={handleCardFormChange}
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        PIN приложения
                      </label>
                      <Input
                        name="appPin"
                        type="number"
                        value={cardFormData.appPin}
                        onChange={handleCardFormChange}
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        PIN терминала
                      </label>
                      <Input
                        name="terminalPin"
                        value={cardFormData.terminalPin}
                        onChange={handleCardFormChange}
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Статус
                      </label>
                      <Select
                        name="status"
                        value={cardFormData.status}
                        onChange={handleCardFormChange}
                      >
                        <SelectItem key="ACTIVE" value="ACTIVE">
                          Активна
                        </SelectItem>
                        <SelectItem key="WARNING" value="WARNING">
                          Внимание
                        </SelectItem>
                        <SelectItem key="BLOCKED" value="BLOCKED">
                          Заблокирована
                        </SelectItem>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Пикачу
                      </label>
                      <Input
                        name="picachu"
                        value={cardFormData.picachu}
                        onChange={handleCardFormChange}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Актер
                      </label>
                      <Input
                        name="actor"
                        value={cardFormData.actor}
                        onChange={handleCardFormChange}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Стоимость карты
                      </label>
                      <Input
                        name="cardPrice"
                        type="number"
                        value={cardFormData.cardPrice}
                        onChange={handleCardFormChange}
                      />
                    </div>
                    <div className="flex items-start pt-6">
                      <div className="flex h-5 items-center">
                        <input
                          id="isPaid"
                          name="isPaid"
                          type="checkbox"
                          checked={cardFormData.isPaid}
                          onChange={handleCardFormChange}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label
                          htmlFor="isPaid"
                          className="font-medium text-gray-700"
                        >
                          Карта оплачена
                        </label>
                      </div>
                    </div>
                    <div className="flex items-start pt-6">
                      <div className="flex h-5 items-center">
                        <input
                          id="inWork"
                          name="inWork"
                          type="checkbox"
                          checked={cardFormData.inWork}
                          onChange={handleCardFormChange}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label
                          htmlFor="inWork"
                          className="font-medium text-gray-700"
                        >
                          В работе
                        </label>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="mb-1 block text-sm font-medium">
                        Комментарий
                      </label>
                      <Input
                        name="comment"
                        value={cardFormData.comment}
                        onChange={handleCardFormChange}
                      />
                    </div>
                  </div>
                </Tab>
                <Tab key="pouring-info" title="Начальный пролив">
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Сумма начального пролива
                      </label>
                      <Input
                        name="pouringAmount"
                        type="number"
                        value={cardFormData.pouringAmount}
                        onChange={handleCardFormChange}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Начальная сумма
                      </label>
                      <Input
                        name="initialAmount"
                        type="number"
                        value={cardFormData.initialAmount}
                        onChange={handleCardFormChange}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Дата начала
                      </label>
                      <Input
                        name="initialDate"
                        type="date"
                        value={cardFormData.initialDate}
                        onChange={handleCardFormChange}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Инкассатор
                      </label>
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
              <Button
                variant="flat"
                onPress={() => setIsCreateModalOpen(false)}
              >
                Отмена
              </Button>
              <Button
                color="primary"
                type="submit"
                isLoading={createCardMutation.isLoading}
              >
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
                  <label className="mb-1 block text-sm font-medium">
                    Внешний ID
                  </label>
                  <Input
                    name="externalId"
                    type="number"
                    value={cardFormData.externalId}
                    onChange={handleCardFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Поставщик
                  </label>
                  <Input
                    name="provider"
                    value={cardFormData.provider}
                    onChange={handleCardFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Номер карты (C2C)
                  </label>
                  <Input
                    name="cardNumber"
                    value={cardFormData.cardNumber}
                    onChange={handleCardFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Банк</label>
                  <Input
                    name="bank"
                    value={cardFormData.bank}
                    onChange={handleCardFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Номер телефона (СБП)
                  </label>
                  <Input
                    name="phoneNumber"
                    value={cardFormData.phoneNumber}
                    onChange={handleCardFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    PIN приложения
                  </label>
                  <Input
                    name="appPin"
                    type="number"
                    value={cardFormData.appPin}
                    onChange={handleCardFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    PIN терминала
                  </label>
                  <Input
                    name="terminalPin"
                    value={cardFormData.terminalPin}
                    onChange={handleCardFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Статус
                  </label>
                  <Select
                    name="status"
                    value={cardFormData.status}
                    onChange={handleCardFormChange}
                    required
                  >
                    <SelectItem key="ACTIVE" value="ACTIVE">
                      Активна
                    </SelectItem>
                    <SelectItem key="WARNING" value="WARNING">
                      Внимание
                    </SelectItem>
                    <SelectItem key="BLOCKED" value="BLOCKED">
                      Заблокирована
                    </SelectItem>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Пикачу
                  </label>
                  <Input
                    name="picachu"
                    value={cardFormData.picachu}
                    onChange={handleCardFormChange}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Актер
                  </label>
                  <Input
                    name="actor"
                    value={cardFormData.actor}
                    onChange={handleCardFormChange}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Цена карты
                  </label>
                  <Input
                    name="cardPrice"
                    type="number"
                    value={cardFormData.cardPrice || ""}
                    onChange={handleCardFormChange}
                  />
                </div>
                <div className="flex items-start pt-6">
                  <div className="flex h-5 items-center">
                    <input
                      id="isPaid"
                      name="isPaid"
                      type="checkbox"
                      checked={cardFormData.isPaid}
                      onChange={handleCardFormChange}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label
                      htmlFor="isPaid"
                      className="font-medium text-gray-700"
                    >
                      Карта оплачена
                    </label>
                  </div>
                </div>
                <div className="flex items-start pt-6">
                  <div className="flex h-5 items-center">
                    <input
                      id="inWork"
                      name="inWork"
                      type="checkbox"
                      checked={cardFormData.inWork}
                      onChange={handleCardFormChange}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label
                      htmlFor="inWork"
                      className="font-medium text-gray-700"
                    >
                      В работе
                    </label>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium">
                    Комментарий
                  </label>
                  <Input
                    name="comment"
                    value={cardFormData.comment}
                    onChange={handleCardFormChange}
                  />
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={() => setIsEditModalOpen(false)}>
                Отмена
              </Button>
              <Button
                color="primary"
                type="submit"
                isLoading={updateCardMutation.isLoading}
              >
                Обновить
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* View Pourings Modal */}
      <Modal
        isOpen={isViewPouringsModalOpen}
        onClose={() => setIsViewPouringsModalOpen(false)}
        size="4xl"
      >
        <ModalContent>
          <ModalHeader>
            История проливов для карты #{selectedCard?.id} ({selectedCard?.bank}
            )
          </ModalHeader>
          <ModalBody>
            {cardPouringsQuery.isLoading ? (
              <div className="my-6 flex justify-center">
                <Spinner size="lg" />
              </div>
            ) : !cardPouringsQuery.data ||
              cardPouringsQuery.data.length === 0 ? (
              <div className="py-6 text-center text-gray-500">
                Нет данных о проливах для этой карты
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                      >
                        Дата пролива
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                      >
                        Начальная сумма
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                      >
                        Дата начальной суммы
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                      >
                        Конечная сумма
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                      >
                        Дата конечной суммы
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                      >
                        Пролито
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                      >
                        Выплата
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                      >
                        Дата выплаты
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                      >
                        Инкассатор
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                      >
                        Статус
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                      >
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {cardPouringsQuery.data.map((pouring) => (
                      <tr key={pouring.id}>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {formatDate(pouring.pouringDate)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">
                          {formatNumber(pouring.initialAmount)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {formatDate(pouring.initialDate)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">
                          {pouring.finalAmount
                            ? formatNumber(pouring.finalAmount)
                            : "—"}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {pouring.finalDate
                            ? formatDate(pouring.finalDate)
                            : "—"}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">
                          {formatNumber(pouring.pouringAmount)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">
                          {pouring.withdrawalAmount
                            ? formatNumber(pouring.withdrawalAmount)
                            : "—"}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {pouring.withdrawalDate
                            ? formatDate(pouring.withdrawalDate)
                            : "—"}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {pouring.collectorName || "—"}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm">
                          <Badge
                            color={
                              pouring.status === "ACTIVE"
                                ? "success"
                                : pouring.status === "WARNING"
                                  ? "warning"
                                  : "danger"
                            }
                          >
                            {pouring.status === "ACTIVE"
                              ? "Активно"
                              : pouring.status === "WARNING"
                                ? "Внимание"
                                : "Заблокировано"}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              onPress={() => handleEditPouringClick(pouring)}
                              title="Редактировать пролив"
                            >
                              <Edit size={16} />
                            </Button>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              color="danger"
                              onPress={() =>
                                handleDeletePouringClick(pouring.id)
                              }
                              title="Удалить пролив"
                            >
                              <Trash size={16} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              color="primary"
              onPress={() => {
                handleAddPouringClick(selectedCard);
                setIsViewPouringsModalOpen(false);
              }}
            >
              Добавить пролив
            </Button>
            <Button
              variant="flat"
              onPress={() => setIsViewPouringsModalOpen(false)}
            >
              Закрыть
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Add/Edit Pouring Modal */}
      <Modal
        isOpen={isPouringModalOpen}
        onClose={() => setIsPouringModalOpen(false)}
        size="2xl"
      >
        <ModalContent>
          <form
            onSubmit={
              selectedPouring
                ? handleUpdatePouringSubmit
                : handleCreatePouringSubmit
            }
          >
            <ModalHeader>
              {selectedPouring ? "Редактировать пролив" : "Добавить пролив"}
            </ModalHeader>
            <ModalBody>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Дата пролива
                  </label>
                  <Input
                    name="pouringDate"
                    type="date"
                    value={pouringFormData.pouringDate}
                    onChange={handlePouringFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Сумма пролитого
                  </label>
                  <Input
                    name="pouringAmount"
                    type="number"
                    value={pouringFormData.pouringAmount}
                    onChange={handlePouringFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Начальная сумма
                  </label>
                  <Input
                    name="initialAmount"
                    type="number"
                    value={pouringFormData.initialAmount}
                    onChange={handlePouringFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Дата начальной суммы
                  </label>
                  <Input
                    name="initialDate"
                    type="date"
                    value={pouringFormData.initialDate}
                    onChange={handlePouringFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Конечная сумма
                  </label>
                  <Input
                    name="finalAmount"
                    type="number"
                    value={pouringFormData.finalAmount || ""}
                    onChange={handlePouringFormChange}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Дата конечной суммы
                  </label>
                  <Input
                    name="finalDate"
                    type="date"
                    value={pouringFormData.finalDate || ""}
                    onChange={handlePouringFormChange}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Сумма снятого
                  </label>
                  <Input
                    name="withdrawalAmount"
                    type="number"
                    value={pouringFormData.withdrawalAmount || ""}
                    onChange={handlePouringFormChange}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Дата снятия
                  </label>
                  <Input
                    name="withdrawalDate"
                    type="date"
                    value={pouringFormData.withdrawalDate || ""}
                    onChange={handlePouringFormChange}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Инкассатор
                  </label>
                  <Input
                    name="collectorName"
                    value={pouringFormData.collectorName || ""}
                    onChange={handlePouringFormChange}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Статус
                  </label>
                  <Select
                    name="status"
                    value={pouringFormData.status}
                    onChange={handlePouringFormChange}
                    required
                  >
                    <SelectItem key="ACTIVE" value="ACTIVE">
                      Активна
                    </SelectItem>
                    <SelectItem key="WARNING" value="WARNING">
                      Внимание
                    </SelectItem>
                    <SelectItem key="BLOCKED" value="BLOCKED">
                      Заблокирована
                    </SelectItem>
                  </Select>
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium">
                    Комментарий
                  </label>
                  <Input
                    name="comment"
                    value={pouringFormData.comment || ""}
                    onChange={handlePouringFormChange}
                  />
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="flat"
                onPress={() => setIsPouringModalOpen(false)}
              >
                Отмена
              </Button>
              <Button
                color="primary"
                type="submit"
                isLoading={
                  selectedPouring
                    ? updatePouringMutation.isLoading
                    : createPouringMutation.isLoading
                }
              >
                {selectedPouring ? "Обновить" : "Создать"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* View Balances Modal */}
      <Modal
        isOpen={isViewBalancesModalOpen}
        onClose={() => setIsViewBalancesModalOpen(false)}
        size="3xl"
      >
        <ModalContent>
          <ModalHeader>
            История балансов для карты #{selectedCard?.id} ({selectedCard?.bank}
            )
          </ModalHeader>
          <ModalBody>
            {cardBalancesQuery.isLoading ? (
              <div className="my-6 flex justify-center">
                <Spinner size="lg" />
              </div>
            ) : !cardBalancesQuery.data ||
              cardBalancesQuery.data.length === 0 ? (
              <div className="py-6 text-center text-gray-500">
                Нет данных о балансах для этой карты
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                      >
                        Дата
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                      >
                        Начальный баланс
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                      >
                        Конечный баланс
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                      >
                        Разница
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                      >
                        Комментарий
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                      >
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {cardBalancesQuery.data.map((balance) => (
                      <tr key={balance.id}>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {formatDate(balance.date)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">
                          {formatNumber(balance.startBalance)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">
                          {formatNumber(balance.endBalance)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">
                          {formatNumber(
                            balance.endBalance - balance.startBalance,
                          )}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {balance.comment || "—"}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              onPress={() => handleEditBalanceClick(balance)}
                              title="Редактировать баланс"
                            >
                              <Edit size={16} />
                            </Button>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              color="danger"
                              onPress={() =>
                                handleDeleteBalanceClick(balance.id)
                              }
                              title="Удалить баланс"
                            >
                              <Trash size={16} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              color="primary"
              onPress={() => {
                handleAddBalanceClick(selectedCard);
                setIsViewBalancesModalOpen(false);
              }}
            >
              Добавить баланс
            </Button>
            <Button
              variant="flat"
              onPress={() => setIsViewBalancesModalOpen(false)}
            >
              Закрыть
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Add/Edit Balance Modal */}
      <Modal
        isOpen={isBalanceModalOpen}
        onClose={() => setIsBalanceModalOpen(false)}
        size="xl"
      >
        <ModalContent>
          <form
            onSubmit={
              selectedBalance
                ? handleUpdateBalanceSubmit
                : handleCreateBalanceSubmit
            }
          >
            <ModalHeader>
              {selectedBalance ? "Редактировать баланс" : "Добавить баланс"}
            </ModalHeader>
            <ModalBody>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Дата</label>
                  <Input
                    name="date"
                    type="date"
                    value={balanceFormData.date}
                    onChange={handleBalanceFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Начальный баланс
                  </label>
                  <Input
                    name="startBalance"
                    type="number"
                    value={balanceFormData.startBalance}
                    onChange={handleBalanceFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Конечный баланс
                  </label>
                  <Input
                    name="endBalance"
                    type="number"
                    value={balanceFormData.endBalance}
                    onChange={handleBalanceFormChange}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium">
                    Комментарий
                  </label>
                  <Input
                    name="comment"
                    value={balanceFormData.comment}
                    onChange={handleBalanceFormChange}
                  />
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="flat"
                onPress={() => setIsBalanceModalOpen(false)}
              >
                Отмена
              </Button>
              <Button
                color="primary"
                type="submit"
                isLoading={
                  selectedBalance
                    ? updateBalanceMutation.isLoading
                    : createBalanceMutation.isLoading
                }
              >
                {selectedBalance ? "Обновить" : "Создать"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  );
}
