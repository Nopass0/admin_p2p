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
             deleteReportMutation.mutate({ id: reportId, userId: currentUserId });
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
                                <p>Отчеты еще не созданы.</p>
                            ) : (
                                 <Table aria-label="Список отчетов сопоставления Bybit">
                                    <TableHeader>
                                        <TableColumn>ID</TableColumn>
                                        <TableColumn>Название</TableColumn>
                                        <TableColumn>Период</TableColumn>
                                        <TableColumn>ID Пользователя</TableColumn>
                                        {/* <TableColumn>Кабинеты IDEX</TableColumn> */}
                                        <TableColumn>Дата создания</TableColumn>
                                        <TableColumn>Действия</TableColumn>
                                    </TableHeader>
                                     <TableBody items={data.reports}>
                                        {(item: any) => (
                                            <TableRow key={item.id}>
                                                <TableCell>{item.id}</TableCell>
                                                <TableCell>{item.name}</TableCell>
                                                <TableCell>
                                                    {dayjs(item.startDate).format("YYYY-MM-DD")} - {dayjs(item.endDate).format("YYYY-MM-DD")}
                                                </TableCell>
                                                <TableCell>{item.userId}</TableCell>
                                                 {/* <TableCell>{item.cabinetConfigs ? 'Конфиги' : 'Нет'} </TableCell> */}
                                                 <TableCell>{dayjs(item.createdAt).format("YYYY-MM-DD HH:mm")}</TableCell>
                                                <TableCell className="flex gap-1">
                                                    <Tooltip content="Открыть отчет">
                                                        <Button 
                                                            isIconOnly 
                                                            variant="light" 
                                                            size="sm" 
                                                            onPress={() => router.push(`/bb/report/${item.id}`)}
                                                        >
                                                            <Eye size={16} />
                                                        </Button>
                                                    </Tooltip>
                                                     <Tooltip content="Редактировать (параметры)">
                                                         <Button 
                                                            isIconOnly 
                                                            variant="light" 
                                                            size="sm" 
                                                            // TODO: Implement edit functionality for report parameters if needed
                                                            // onPress={() => handleEditReport(item.id)} 
                                                            isDisabled // Disable for now if only viewing/matching is on the report page
                                                         >
                                                             <Edit size={16} />
                                                         </Button>
                                                     </Tooltip>
                                                     <Tooltip content="Удалить отчет">
                                                         <Button 
                                                            isIconOnly 
                                                            color="danger" 
                                                            variant="light" 
                                                            size="sm" 
                                                            onPress={() => handleDeleteReport(item.id)}
                                                            isLoading={deleteReportMutation.isLoading && deleteReportMutation.variables?.id === item.id}
                                                        >
                                                             <Trash size={16} />
                                                         </Button>
                                                     </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                         </>
                    )}
                </CardBody>
                 {data && data.totalPages > 1 && (
                    <CardFooter className="flex justify-center">
                        <Pagination
                            total={data.totalPages}
                            page={page}
                            onChange={handlePageChange}
                            color="primary"
                        />
                    </CardFooter>
                 )}
            </Card>
            
             {/* Bybit Cabinet Management Modal */}
            <BybitCabinetModal isOpen={isCabinetModalOpen} onClose={onCabinetModalClose} />
        </div>
    );
}