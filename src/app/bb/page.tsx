"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";

import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader, CardFooter } from "@heroui/card";
import { Spinner } from "@heroui/spinner";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, useDisclosure } from "@heroui/modal";
import { Input } from "@heroui/input";
import { Tooltip } from "@heroui/tooltip";
import { Pagination } from "@heroui/pagination";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/table";
import { PlusIcon, RefreshCw, Edit, Trash, Settings, Eye } from "lucide-react";
import { toast } from 'react-hot-toast'; // Assuming react-hot-toast is used for notifications
import dayjs from "dayjs"; // For date formatting

// --- Bybit Cabinet Modal Component ---
const BybitCabinetModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const utils = api.useUtils();
    const userId = undefined; // Placeholder - NEEDS TO BE REPLACED

    const { data: cabinets, isLoading: isLoadingCabinets, refetch } = api.bb.getBybitCabinets.useQuery(
        { userId: 0 }, 
        {
            enabled: isOpen, 
        }
    );
    const createMutation = api.bb.createBybitCabinet.useMutation({
        onSuccess: () => {
            toast.success("Кабинет Bybit добавлен!");
            utils.bb.getBybitCabinets.invalidate(); // Refresh list
            setIsAdding(false); // Close form after successful add
            setNewCabinetData({ bybitEmail: '', apiKey: '', apiSecret: '' }); // Clear form
        },
        onError: (error) => toast.error(`Ошибка: ${error.message}`),
    });
     const updateMutation = api.bb.updateBybitCabinet.useMutation({
        onSuccess: () => {
            toast.success("Кабинет Bybit обновлен!");
            utils.bb.getBybitCabinets.invalidate();
            setEditingCabinet(null); // Close edit form
        },
        onError: (error) => toast.error(`Ошибка: ${error.message}`),
    });
    const deleteMutation = api.bb.deleteBybitCabinet.useMutation({
        onSuccess: () => {
            toast.success("Кабинет Bybit удален!");
            utils.bb.getBybitCabinets.invalidate();
        },
        onError: (error) => toast.error(`Ошибка: ${error.message}`),
    });

    const [isAdding, setIsAdding] = useState(false);
    const [editingCabinet, setEditingCabinet] = useState<any>(null); // Store cabinet being edited
    const [newCabinetData, setNewCabinetData] = useState({ bybitEmail: '', apiKey: '', apiSecret: '' });

    useEffect(() => {
        if (!isOpen) {
            setIsAdding(false);
            setEditingCabinet(null);
            setNewCabinetData({ bybitEmail: '', apiKey: '', apiSecret: '' });
        }
    }, [isOpen]);

    useEffect(() => {
        if (editingCabinet) {
            // Map the database field names to the form field names
            setNewCabinetData({
                bybitEmail: editingCabinet.bybitEmail ?? '',
                apiKey: editingCabinet.bybitApiToken ?? '',    // Map bybitApiToken to apiKey for the form
                apiSecret: editingCabinet.bybitApiSecret ?? ''  // Map bybitApiSecret to apiSecret for the form
            });
        } else {
             setNewCabinetData({ bybitEmail: '', apiKey: '', apiSecret: '' });
        }
    }, [editingCabinet]);


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setNewCabinetData(prev => ({ ...prev, [name]: value }));
    };

     const handleSave = () => {
         const currentUserId = 0; // Placeholder - WILL FAIL

         const dataToSave = {
            ...newCabinetData, 
         };

         if (editingCabinet) { 
             if (!dataToSave.bybitEmail || !dataToSave.apiKey || !dataToSave.apiSecret) {
                  toast.error("Пожалуйста, заполните Email, API Key и API Secret.");
                  return;
             }
             updateMutation.mutate({
                 id: editingCabinet.id, 
                 ...dataToSave, 
                 userId: currentUserId, 
             });
         } else { 
              if (!dataToSave.bybitEmail || !dataToSave.apiKey || !dataToSave.apiSecret) {
                  toast.error("Пожалуйста, заполните Email, API Key и API Secret.");
                  return;
             }
             createMutation.mutate({
                ...dataToSave,
                userId: currentUserId, 
             });
         }
     };
     
     const handleDelete = (id: number) => {
         const currentUserId = 0; // Placeholder - WILL FAIL
         if (window.confirm("Вы уверены, что хотите удалить этот кабинет?")) {
              deleteMutation.mutate({ id, userId: currentUserId }); 
         }
     };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="2xl">
            <ModalContent>
                <ModalHeader>{editingCabinet ? "Редактировать кабинет" : (isAdding ? "Добавить новый кабинет Bybit" : "Управление кабинетами Bybit")}</ModalHeader>
                <ModalBody>
                    {isLoadingCabinets && <Spinner label="Загрузка кабинетов..." />}
                    {!isLoadingCabinets && !isAdding && !editingCabinet && (
                        <>
                            <Button color="primary" startContent={<PlusIcon size={18} />} onPress={() => setIsAdding(true)} className="mb-4">
                                Добавить кабинет
                            </Button>
                            {cabinets && cabinets.length > 0 ? (
                                <Table aria-label="Список кабинетов Bybit">
                                    <TableHeader>
                                        <TableColumn>Bybit Email</TableColumn>
                                        <TableColumn>API Key (часть)</TableColumn>
                                        <TableColumn>Добавлен</TableColumn>
                                        <TableColumn>Действия</TableColumn>
                                    </TableHeader>
                                    <TableBody items={cabinets ?? []}>
                                        {(item: any) => (
                                            <TableRow key={item.id}>
                                                <TableCell>{item.bybitEmail}</TableCell>
                                                <TableCell>{item.bybitApiToken?.substring(0, 5)}...</TableCell>
                                                <TableCell>{dayjs(item.createdAt).format("YYYY-MM-DD HH:mm")}</TableCell>
                                                <TableCell className="flex gap-2">
                                                    <Tooltip content="Редактировать">
                                                         <Button isIconOnly variant="light" size="sm" onPress={() => setEditingCabinet(item)}>
                                                             <Edit size={16} />
                                                         </Button>
                                                     </Tooltip>
                                                     <Tooltip content="Удалить">
                                                         <Button isIconOnly color="danger" variant="light" size="sm" onPress={() => handleDelete(item.id)}>
                                                             <Trash size={16} />
                                                         </Button>
                                                     </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            ) : (
                                <p>Кабинеты Bybit еще не добавлены.</p>
                            )}
                        </>
                    )}
                    {(isAdding || editingCabinet) && (
                         <div className="flex flex-col gap-4">
                             <Input
                                 label="Bybit Email"
                                 name="bybitEmail"
                                 value={newCabinetData.bybitEmail}
                                 onChange={handleInputChange}
                                 isRequired
                                 placeholder="user@example.com"
                             />
                              <Input
                                 label="API Key"
                                 name="apiKey"
                                 value={newCabinetData.apiKey}
                                 onChange={handleInputChange}
                                  type="password" // Mask API key
                                 isRequired
                                 placeholder="Ваш Bybit API ключ"
                             />
                              <Input
                                 label="API Secret"
                                 name="apiSecret"
                                 value={newCabinetData.apiSecret}
                                 onChange={handleInputChange}
                                  type="password" // Mask secret
                                 isRequired
                                 placeholder="Ваш Bybit API секрет"
                             />
                         </div>
                    )}

                </ModalBody>
                <ModalFooter>
                     { (isAdding || editingCabinet) && (
                         <>
                              <Button variant="light" onPress={() => { setIsAdding(false); setEditingCabinet(null); }}>
                                Отмена
                            </Button>
                            <Button color="primary" onPress={handleSave} isLoading={createMutation.isLoading || updateMutation.isLoading}>
                                {editingCabinet ? "Сохранить изменения" : "Добавить кабинет"}
                            </Button>
                         </>
                     )}
                     { !(isAdding || editingCabinet) && (
                         <Button variant="light" onPress={onClose}>
                             Закрыть
                         </Button>
                      )}
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};


// --- Main Page Component ---
export default function BybitReportsPage() {
    const router = useRouter();
    const [page, setPage] = useState(1);
    const itemsPerPage = 10; // Or make this configurable

    const userId = undefined; // Placeholder - NEEDS TO BE REPLACED

    const { data, isLoading, error, refetch } = api.bb.getMatchBybitReports.useQuery(
      {
        page,
        limit: itemsPerPage,
        userId: 0,
      },
      {
        enabled: true, 
      }
    );
    
    const deleteReportMutation = api.bb.deleteMatchBybitReport.useMutation({
        onSuccess: () => {
            toast.success("Отчет успешно удален.");
            refetch(); // Refresh the list
        },
        onError: (error) => {
            toast.error(`Ошибка удаления отчета: ${error.message}`);
        },
    });

    const { isOpen: isCabinetModalOpen, onOpen: onCabinetModalOpen, onClose: onCabinetModalClose } = useDisclosure();

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
    };
    
     const handleDeleteReport = (reportId: number) => {
         const currentUserId = 0; // Placeholder - WILL FAIL
         if (window.confirm("Вы уверены, что хотите удалить этот отчет и все связанные с ним сопоставления?")) {
             deleteReportMutation.mutate({ id: reportId });
         }
     };

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Отчеты сопоставления Bybit</h1>

            <div className="flex justify-between items-center mb-4">
                <div>{/* Placeholder for filters */}</div>
                <div className="flex gap-2">
                    <Button
                        color="secondary"
                        variant="bordered"
                        startContent={<Settings size={18} />}
                        onPress={onCabinetModalOpen}
                    >
                        Кабинеты Bybit
                    </Button>
                    <Button
                        color="primary"
                        startContent={<PlusIcon size={18} />}
                        onPress={() => router.push('/bb/report/new')} // Navigate to create page
                    >
                        Создать отчет
                    </Button>
                    <Button isIconOnly variant="light" onPress={() => refetch()}>
                        <RefreshCw size={18} />
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <h2 className="text-xl font-semibold">Список отчетов</h2>
                </CardHeader>
                <CardBody>
                    {isLoading && <Spinner label="Загрузка отчетов..." />}
                    {error && <p className="text-danger">Ошибка загрузки: {error.message}</p>}
                    {!isLoading && !error && data?.reports && (
                        <>
                            {data.reports.length === 0 ? (
                                <div className="p-6 text-center bg-gray-50 dark:bg-zinc-800 rounded-lg">
                                    <p className="text-lg">Отчеты еще не созданы.</p>
                                    <Button 
                                        color="primary" 
                                        className="mt-4" 
                                        startContent={<PlusIcon size={18} />}
                                        onPress={() => router.push('/bb/report/new')}
                                    >
                                        Создать первый отчет
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {data.reports.map((report: any) => {
                                        // Парсим конфигурацию кабинетов
                                        let idexCabinets: any[] = [];
                                        let bybitCabinets: any[] = [];
                                        
                                        if (report.idexCabinets && typeof report.idexCabinets === 'string') {
                                            try {
                                                const configs = JSON.parse(report.idexCabinets);
                                                // Разделяем на IDEX и Bybit кабинеты
                                                idexCabinets = configs.filter((c: any) => c.cabinetType === 'idex');
                                                bybitCabinets = configs.filter((c: any) => c.cabinetType === 'bybit' || !c.cabinetType);
                                            } catch (e) {
                                                console.error("Failed to parse cabinets config", e);
                                            }
                                        }
                                        
                                        return (
                                            <Card key={report.id} className="hover:shadow-md transition-shadow duration-300 dark:bg-zinc-800 dark:border-zinc-700">
                                                <CardBody className="p-0">
                                                    {/* Заголовок карточки */}
                                                    <div className="p-4 border-b dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 flex items-center justify-between">
                                                        <div className="flex items-center space-x-2">
                                                            <span className="bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300 px-2 py-1 rounded text-xs font-mono">ID: {report.id}</span>
                                                            <h3 className="text-xl font-semibold">{report.name}</h3>
                                                        </div>
                                                        <span className="text-gray-500 dark:text-zinc-400 text-sm">
                                                            Создан: {dayjs(report.createdAt).format("DD.MM.YYYY HH:mm")}
                                                        </span>
                                                    </div>
                                                    
                                                    {/* Основная информация */}
                                                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        {/* Колонка 1: Информация о пользователе и периоде */}
                                                        <div className="space-y-4">
                                                            <div>
                                                                <span className="text-sm font-medium text-gray-500 dark:text-zinc-400">Пользователь:</span>
                                                                <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-md flex items-center">
                                                                    <div className="h-6 w-6 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center mr-2">
                                                                        <span className="text-xs font-bold">{report.user?.name?.charAt(0) || 'U'}</span>
                                                                    </div>
                                                                    <span className="font-medium">
                                                                        {report.user?.name || `ID: ${report.userId}`}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            
                                                            <div>
                                                                <span className="text-sm font-medium text-gray-500 dark:text-zinc-400">Период отчета:</span>
                                                                <div className="bg-gray-50 dark:bg-zinc-800 p-2 rounded-md border dark:border-zinc-700 mt-1">
                                                                    <div className="flex items-center text-sm">
                                                                        <span className="mr-1">От:</span>
                                                                        <span className="font-semibold">{dayjs(report.startDate).format("DD.MM.YYYY HH:mm")}</span>
                                                                    </div>
                                                                    <div className="flex items-center text-sm mt-1">
                                                                        <span className="mr-1">До:</span>
                                                                        <span className="font-semibold">{dayjs(report.endDate).format("DD.MM.YYYY HH:mm")}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            
                                                            {report.notes && (
                                                                <div>
                                                                    <span className="text-sm font-medium text-gray-500 dark:text-zinc-400">Комментарий:</span>
                                                                    <p className="mt-1 text-sm bg-gray-50 dark:bg-zinc-800 p-2 rounded-md border dark:border-zinc-700">
                                                                        {report.notes}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                        
                                                        {/* Колонка 2: Статистика и метрики */}
                                                        <div className="space-y-4">
                                                            <span className="text-sm font-medium text-gray-500 dark:text-zinc-400">Статистика:</span>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-md border border-green-100 dark:border-green-800/50">
                                                                    <span className="text-xs text-gray-500 dark:text-zinc-400 block">Сопоставлений</span>
                                                                    <span className="text-lg font-bold text-green-600 dark:text-green-400">{report.totalMatches || 0}</span>
                                                                </div>
                                                                <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-md border border-blue-100 dark:border-blue-800/50">
                                                                    <span className="text-xs text-gray-500 dark:text-zinc-400 block">Прибыль</span>
                                                                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{report.totalProfit?.toFixed(2) || 0} USDT</span>
                                                                </div>
                                                                <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded-md border border-purple-100 dark:border-purple-800/50">
                                                                    <span className="text-xs text-gray-500 dark:text-zinc-400 block">Успешных</span>
                                                                    <span className="text-lg font-bold text-purple-600 dark:text-purple-400">{report.successRate?.toFixed(1) || 0}%</span>
                                                                </div>
                                                                <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded-md border border-amber-100 dark:border-amber-800/50">
                                                                    <span className="text-xs text-gray-500 dark:text-zinc-400 block">Ср. прибыль</span>
                                                                    <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{report.averageProfit?.toFixed(2) || 0} USDT</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Колонка 3: Кабинеты */}
                                                        <div className="space-y-4">
                                                            {/* IDEX кабинеты */}
                                                            <div>
                                                                <span className="text-sm font-medium text-gray-500 dark:text-zinc-400">IDEX кабинеты:</span>
                                                                <div className="mt-1 flex flex-wrap gap-1">
                                                                    {report.idexCabinets.length > 0 ? report.idexCabinets.map((cabinet: any, index: number) => (
                                                                        <Tooltip key={index} content={`Период: ${dayjs(cabinet.startDate).format("DD.MM.YYYY")} - ${dayjs(cabinet.endDate).format("DD.MM.YYYY")}`}>
                                                                <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs px-2 py-1 rounded-full">
                                                                    ID: {cabinet.idexId}
                                                                </span>
                                                                        </Tooltip>
                                                                    )) : <span className="text-sm text-gray-500 dark:text-zinc-400">Нет кабинетов</span>}
                                                                </div>
                                                            </div>
                                                            
                                                            {/* Bybit кабинеты */}
                                                            <div>
                                                                <span className="text-sm font-medium text-gray-500 dark:text-zinc-400">Bybit кабинеты:</span>
                                                                <div className="mt-1 flex flex-wrap gap-1">
                                                                    {report.bybitCabinetEmails.length > 0 ? report.bybitCabinetEmails.map((cabinet: any, index: number) => (
                                                                        <Tooltip key={index} content={`Период: ${dayjs(cabinet.startDate).format("DD.MM.YYYY")} - ${dayjs(cabinet.endDate).format("DD.MM.YYYY")}`}>
                                                                <span className="bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 text-xs px-2 py-1 rounded-full">
                                                                    {cabinet.email}
                                                                </span>
                                                                        </Tooltip>
                                                                    )) : <span className="text-sm text-gray-500 dark:text-zinc-400">Нет кабинетов</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Нижняя панель с кнопками */}
                                                    <div className="p-3 border-t dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 flex justify-end">
                                                        <div className="flex gap-2">
                                                            <Button 
                                                                size="sm" 
                                                                variant="bordered" 
                                                                color="primary" 
                                                                startContent={<Eye size={16} />}
                                                                onPress={() => router.push(`/bb/report/${report.id}`)}
                                                            >
                                                                Открыть
                                                            </Button>
                                                            <Button 
                                                                size="sm" 
                                                                variant="flat" 
                                                                color="danger" 
                                                                startContent={<Trash size={16} />}
                                                                onPress={() => handleDeleteReport(report.id)}
                                                            >
                                                                Удалить
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </CardBody>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                            {data.totalPages > 1 && (
                                <div className="flex justify-center mt-8">
                                    <Pagination
                                        total={data.totalPages}
                                        initialPage={page}
                                        onChange={handlePageChange}
                                        size="lg"
                                        className="mx-auto"
                                    />
                                </div>
                            )}
                        </>
                    )}
                </CardBody>
                 {/* Убираем дубликат пагинации в нижнем колонтитуле, т.к. она уже есть внутри */}
            </Card>
            
             {/* Bybit Cabinet Management Modal */}
            <BybitCabinetModal isOpen={isCabinetModalOpen} onClose={onCabinetModalClose} />
        </div>
    );
}
