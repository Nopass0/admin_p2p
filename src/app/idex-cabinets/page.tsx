"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Spinner } from "@heroui/spinner";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { Input } from "@heroui/input";
import { PlusIcon, RefreshCw, Globe, CheckCircle, AlertCircle, Clock, History } from "lucide-react";
import { IdexCabinetsTable } from "@/components/idex/IdexCabinetsTable";
import { IdexSyncOrdersModal } from "@/components/idex/IdexSyncOrdersModal";
import { Alert } from "@heroui/alert";
import { useForm } from "react-hook-form";

interface CabinetForm {
  idexId: number;
  login: string;
  password: string;
}

interface AlertState {
  isVisible: boolean;
  title: string;
  description: string;
  color: "success" | "danger" | "primary" | "warning" | "default" | "secondary";
}

export default function IdexCabinetsPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSyncOrdersModalOpen, setIsSyncOrdersModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedCabinetId, setSelectedCabinetId] = useState<number | null>(null);
  const [pagesToFetch, setPagesFetch] = useState(10);
  const [alert, setAlert] = useState<AlertState>({
    isVisible: false,
    title: "",
    description: "",
    color: "default"
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CabinetForm>();
  
  const showAlert = (title: string, description: string, color: AlertState['color']) => {
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
  
  // Получение списка кабинетов
  const {
    data: cabinetsData,
    isLoading: isLoadingCabinets,
    refetch: refetchCabinets,
  } = api.idex.getAllCabinets.useQuery({
    page,
    perPage: pageSize,
    startDate,
    endDate
  }, {
    refetchOnWindowFocus: false
  });
  
  // Мутации для работы с кабинетами
  const addCabinetMutation = api.idex.createCabinet.useMutation({
    onSuccess: () => {
      showAlert("Успешно", "Кабинет успешно добавлен", "success");
      void refetchCabinets();
      handleCloseAddModal();
    },
    onError: (error) => {
      showAlert("Ошибка", `Не удалось добавить кабинет: ${error.message}`, "danger");
    }
  });
  
  const syncCabinetsMutation = api.idex.syncAllCabinets.useMutation({
    onSuccess: (data) => {
      showAlert("Успешно", data.message, "success");
      setIsSyncing(false);
      setIsSyncModalOpen(false);
      setIsSyncOrdersModalOpen(true); // Открываем модальное окно с запросами
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка создания запроса на синхронизацию: ${error.message}`, "danger");
      setIsSyncing(false);
    }
  });
  
  const syncCabinetMutation = api.idex.syncCabinetById.useMutation({
    onSuccess: (data) => {
      showAlert("Успешно", data.message, "success");
      setIsSyncing(false);
      setIsSyncModalOpen(false);
      setIsSyncOrdersModalOpen(true); // Открываем модальное окно с запросами
    },
    onError: (error) => {
      showAlert("Ошибка", `Ошибка создания запроса на синхронизацию: ${error.message}`, "danger");
      setIsSyncing(false);
    }
  });
  
  const deleteCabinetMutation = api.idex.deleteCabinet.useMutation({
    onSuccess: () => {
      showAlert("Успешно", "Кабинет успешно удален", "success");
      void refetchCabinets();
    },
    onError: (error) => {
      showAlert("Ошибка", `Не удалось удалить кабинет: ${error.message}`, "danger");
    }
  });
  
  const onAddCabinet = (data: CabinetForm) => {
    addCabinetMutation.mutate({
      idexId: data.idexId,
      login: data.login,
      password: data.password
    });
  };
  
  const onSyncCabinets = () => {
    setIsSyncing(true);
    if (selectedCabinetId) {
      syncCabinetMutation.mutate({
        cabinetId: selectedCabinetId,
        pages: pagesToFetch
      });
    } else {
      syncCabinetsMutation.mutate({
        pages: pagesToFetch
      });
    }
  };
  
  const handleDeleteCabinet = (id: number) => {
    if (confirm("Вы уверены, что хотите удалить этот кабинет?")) {
      deleteCabinetMutation.mutate({ id });
    }
  };
  
  const handleViewTransactions = (id: number) => {
    window.location.href = `/idex-cabinets/${id}/transactions`;
  };
  
  const handleSyncCabinet = (id: number) => {
    setSelectedCabinetId(id);
    setIsSyncModalOpen(true);
  };
  
  const handleSyncAll = () => {
    setSelectedCabinetId(null);
    setIsSyncModalOpen(true);
  };
  
  const handleOpenAddModal = () => {
    reset();
    setIsAddModalOpen(true);
  };
  
  const handleCloseAddModal = () => {
    reset();
    setIsAddModalOpen(false);
  };
  
  const handleSyncHistory = () => {
    setIsSyncOrdersModalOpen(true);
  };
  
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
        <h1 className="text-2xl font-bold">IDEX Кабинеты</h1>
        <div className="flex gap-2">
          <Input
            type="datetime-local"
            placeholder="Начальная дата"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            type="datetime-local"
            placeholder="Конечная дата"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            color="secondary"
            variant="bordered"
            startIcon={<History className="w-4 h-4" />}
            onClick={handleSyncHistory}
          >
            История синхронизаций
          </Button>
          <Button
            color="primary"
            variant="bordered"
            startIcon={<RefreshCw className="w-4 h-4" />}
            onClick={handleSyncAll}
          >
            Синхронизировать все
          </Button>
          <Button
            color="primary"
            startIcon={<PlusIcon className="w-4 h-4" />}
            onClick={handleOpenAddModal}
          >
            Добавить кабинет
          </Button>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-gray-500" />
            <h3 className="text-lg font-medium">Список кабинетов</h3>
          </div>
        </CardHeader>
        <CardBody>
          {isLoadingCabinets ? (
            <div className="flex justify-center py-10">
              <Spinner size="lg" color="primary" />
            </div>
          ) : cabinetsData?.cabinets && cabinetsData.cabinets.length > 0 ? (
            <IdexCabinetsTable
              cabinets={cabinetsData.cabinets}
              pagination={{
                totalCount: cabinetsData.totalCount,
                totalPages: cabinetsData.totalPages,
                currentPage: cabinetsData.currentPage
              }}
              onPageChange={setPage}
              onDelete={handleDeleteCabinet}
              onViewTransactions={handleViewTransactions}
              onSync={handleSyncCabinet}
            />
          ) : (
            <div className="text-center py-10 text-gray-500">
              <Globe className="w-16 h-16 mx-auto text-gray-400 mb-2" />
              <p>Нет доступных IDEX кабинетов</p>
              <Button
                variant="flat"
                color="primary"
                size="sm"
                className="mt-2"
                onClick={handleOpenAddModal}
              >
                Добавить кабинет
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
      
      {/* Модальное окно добавления кабинета */}
      <Modal isOpen={isAddModalOpen} onClose={handleCloseAddModal}>
        <ModalContent>
          <form onSubmit={handleSubmit(onAddCabinet)}>
            <ModalHeader>Добавление IDEX кабинета</ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">ID кабинета в IDEX</label>
                  <Input
                    type="number"
                    {...register("idexId", { 
                      required: "Это поле обязательно", 
                      min: { value: 1, message: "ID должен быть положительным числом" } 
                    })}
                    isInvalid={!!errors.idexId}
                    errorMessage={errors.idexId?.message}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Логин</label>
                  <Input
                    type="text"
                    {...register("login", { required: "Это поле обязательно" })}
                    isInvalid={!!errors.login}
                    errorMessage={errors.login?.message}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Пароль</label>
                  <Input
                    type="password"
                    {...register("password", { required: "Это поле обязательно" })}
                    isInvalid={!!errors.password}
                    errorMessage={errors.password?.message}
                  />
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="flat"
                onClick={handleCloseAddModal}
              >
                Отмена
              </Button>
              <Button
                color="primary"
                type="submit"
                isLoading={addCabinetMutation.status === "pending"}
              >
                Добавить
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
      
      {/* Модальное окно синхронизации */}
      <Modal isOpen={isSyncModalOpen} onClose={() => !isSyncing && setIsSyncModalOpen(false)}>
        <ModalContent>
          <ModalHeader>
            {selectedCabinetId ? "Синхронизация кабинета" : "Синхронизация всех кабинетов"}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <p>
                {selectedCabinetId
                  ? "Будет выполнена синхронизация выбранного кабинета с сервером IDEX."
                  : "Будет выполнена синхронизация всех кабинетов с сервером IDEX."
                }
              </p>
              <div>
                <label className="block text-sm font-medium mb-1">Количество страниц для получения</label>
                <Input
                  type="number"
                  value={pagesToFetch}
                  onChange={(e) => setPagesFetch(parseInt(e.target.value) || 10)}
                  min={1}
                  max={100}
                  disabled={isSyncing}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Рекомендуется значение 10-25 страниц. Большее количество страниц может увеличить время синхронизации.
                </p>
              </div>
              
              {isSyncing && (
                <div className="flex items-center justify-center py-4">
                  <Spinner size="md" color="primary" className="mr-2" />
                  <span>Выполняется синхронизация...</span>
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onClick={() => setIsSyncModalOpen(false)}
              disabled={isSyncing}
            >
              Отмена
            </Button>
            <Button
              color="primary"
              onClick={onSyncCabinets}
              isLoading={isSyncing}
              disabled={isSyncing}
            >
              Начать синхронизацию
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Модальное окно для истории синхронизаций */}
      <IdexSyncOrdersModal 
        isOpen={isSyncOrdersModalOpen} 
        onClose={() => setIsSyncOrdersModalOpen(false)} 
      />
    </div>
  );
}