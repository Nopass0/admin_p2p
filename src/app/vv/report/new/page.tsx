"use client";

import React from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader, CardFooter } from "@heroui/card";
import { Input } from "@heroui/input";
import { Spinner } from "@heroui/spinner";
import { ArrowLeft, Plus, Trash, Calendar } from 'lucide-react';
import { toast } from 'react-hot-toast';
import dayjs from 'dayjs';

// Тип для конфигурации кабинета
type CabinetConfig = {
  cabinetId: number;
  startDate: string;
  endDate: string;
  cabinetType: 'vires' | 'bybit'; // Тип кабинета
};

export default function NewViresReportPage() {
    const router = useRouter();
    const utils = api.useUtils();

    // Состояние формы: основные поля
    const [reportName, setReportName] = useState('');
    const [timeRangeStart, setTimeRangeStart] = useState(''); // Период поиска сопоставлений: начало
    const [timeRangeEnd, setTimeRangeEnd] = useState('');     // Период поиска сопоставлений: конец
    const [reportDate, setReportDate] = useState(dayjs().format('YYYY-MM-DDTHH:mm')); // Дата формирования отчета
    const [notes, setNotes] = useState(''); // Примечания к отчету
    const [selectedUserId, setSelectedUserId] = useState<number>(1); // Выбранный пользователь по умолчанию
    
    // Состояние формы: конфигурации кабинетов
    const [activeTab, setActiveTab] = useState('vires'); // Выбранная вкладка типа кабинетов (vires или bybit)
    const [cabinetConfigs, setCabinetConfigs] = useState<CabinetConfig[]>([]); // Конфигурации с периодами для каждого кабинета

    // Получение списка пользователей для выбора
    const { data: users, isLoading: isLoadingUsers } = api.users.getUsers.useQuery();
    
    // Получение списка Vires кабинетов
    const { data: viresCabinets, isLoading: isLoadingViresCabinets } = api.vires.getAll.useQuery(
        undefined, 
        { enabled: true }
    );
    
    // Получение списка Bybit кабинетов
    const { data: bybitCabinets, isLoading: isLoadingBybitCabinets } = api.bb.getBybitCabinets.useQuery(
        undefined,
        { enabled: true }
    );
    
    // Обработка добавления кабинета в конфигурацию
    const handleAddCabinet = (cabinetId: number, cabinetType: 'vires' | 'bybit') => {
        // Проверка, что кабинет еще не добавлен
        const alreadyAdded = cabinetConfigs.some(config => 
            config.cabinetId === cabinetId && config.cabinetType === cabinetType
        );
        
        if (alreadyAdded) {
            toast.error(`Этот ${cabinetType === 'vires' ? 'Vires' : 'Bybit'} кабинет уже добавлен`);
            return;
        }
        
        // Добавляем новую конфигурацию с общими датами отчета по умолчанию
        setCabinetConfigs([...cabinetConfigs, {
            cabinetId,
            cabinetType,
            startDate: timeRangeStart || dayjs().format('YYYY-MM-DDTHH:mm'),
            endDate: timeRangeEnd || dayjs().add(1, 'day').format('YYYY-MM-DDTHH:mm')
        }]);
    };
    
    // Удаление кабинета из конфигурации
    const handleRemoveCabinet = (cabinetId: number, cabinetType: 'vires' | 'bybit') => {
        setCabinetConfigs(cabinetConfigs.filter(config => 
            !(config.cabinetId === cabinetId && config.cabinetType === cabinetType)
        ));
    };
    
    // Обновление периода для конкретного кабинета
    const handleCabinetDateChange = (cabinetId: number, cabinetType: 'vires' | 'bybit', field: 'startDate' | 'endDate', value: string) => {
        setCabinetConfigs(cabinetConfigs.map(config => {
            if (config.cabinetId === cabinetId && config.cabinetType === cabinetType) {
                return { ...config, [field]: value };
            }
            return config;
        }));
    };
    
    // Мутация для автоматического сопоставления
    const autoMatchMutation = api.vv.matchTransactionsAutomatically.useMutation({
        onSuccess: (result) => {
            if (result.success) {
                toast.success(`Автоматическое сопоставление выполнено: найдено ${result.stats?.newMatches || 0} совпадений`);
                router.push('/vv');
            } else {
                toast.error(result.message || "Ошибка автоматического сопоставления");
                router.push('/vv');
            }
        },
        onError: (error) => {
            toast.error(`Ошибка при автоматическом сопоставлении: ${error.message}`);
            router.push('/vv');
        }
    });

    // Мутация для создания отчета
    const createReportMutation = api.vv.createMatchViresReport.useMutation({
        onSuccess: (data) => {
            toast.success('Отчет успешно сохранен.');
            
            // Запускаем автоматическое сопоставление для созданного отчета
            autoMatchMutation.mutate({ 
                reportId: data.id,
                userId: selectedUserId
            });
        },
        onError: (error) => {
            toast.error(`Ошибка при создании отчета: ${error.message}`);
        }
    });
    
    // Обработка отправки формы
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        // Валидация: проверка заполнения обязательных полей
        if (!reportName) {
            toast.error('Пожалуйста, введите название отчета');
            return;
        }
        
        if (!timeRangeStart) {
            toast.error('Пожалуйста, укажите начальную дату периода поиска');
            return;
        }
        
        if (!timeRangeEnd) {
            toast.error('Пожалуйста, укажите конечную дату периода поиска');
            return;
        }
        
        if (!reportDate) {
            toast.error('Пожалуйста, укажите дату формирования отчета');
            return;
        }
        
        if (!selectedUserId) {
            toast.error('Пожалуйста, выберите пользователя');
            return;
        }
        
        // Валидация: проверка, что выбран хотя бы один кабинет
        if (cabinetConfigs.length === 0) {
            toast.error('Пожалуйста, добавьте хотя бы один кабинет для сопоставления');
            return;
        }
        
        // Обработка дат для передачи в API
        const processedConfigs = cabinetConfigs.map(config => ({
            cabinetId: config.cabinetId,
            startDate: config.startDate,
            endDate: config.endDate,
            cabinetType: config.cabinetType
        }));
        
        // Получаем информацию о выбранном пользователе
        const selectedUser = users?.find(user => user.id === selectedUserId);
        const userInfo = selectedUser ? 
            `${selectedUser.name || (selectedUser.passCode && `Паскод: ${selectedUser.passCode}`) || `ID: ${selectedUser.id}`}` : 
            `Пользователь ID: ${selectedUserId}`;
            
        // Записываем информацию о пользователе в поле notes
        const notesWithUser = notes ? 
            `${notes} | Пользователь: ${userInfo}` : 
            `Отчет: ${reportName} | Пользователь: ${userInfo}`;
        
        // Отправка данных на сервер
        createReportMutation.mutate({
            name: reportName,
            timeRangeStart: timeRangeStart,
            timeRangeEnd: timeRangeEnd,
            reportDate: reportDate,
            notes: notesWithUser,
            cabinetConfigs: processedConfigs,
            userId: selectedUserId
        });
    };
    
    return (
        <div className="container mx-auto p-4">
            <Button 
                type="button"
                variant="light" 
                onClick={() => router.push('/vv')} 
                startContent={<ArrowLeft size={18} />} 
                className="mb-4 dark:text-zinc-300"
            >
                Назад к списку отчетов
            </Button>
            
            <h1 className="text-2xl font-bold mb-6 dark:text-zinc-100">Создание отчета сопоставления Vires-Bybit</h1>
            
            <Card className="max-w-4xl mx-auto dark:bg-zinc-800 dark:border-zinc-700">
                <CardBody>
                    <div className="p-3 mb-4 bg-blue-50 dark:bg-zinc-700 dark:text-zinc-200 text-sm border rounded-md border-blue-100 dark:border-zinc-600">
                        <p>При сохранении отчета будет автоматически выполнен мэтчинг Vires и Bybit транзакций за указанный период.</p>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="p-4 border rounded-lg shadow-sm mb-6 bg-white dark:bg-zinc-800 dark:border-zinc-700">
                            <h2 className="text-xl font-semibold mb-4 dark:text-zinc-200">Общие параметры отчета</h2>
                            
                            <div className="mb-4">
                                <Input
                                    label="Название отчета"
                                    type="text" 
                                    value={reportName}
                                    onChange={(e) => setReportName(e.target.value)}
                                    placeholder="Введите название отчета"
                                    className="dark:bg-zinc-900 dark:border-zinc-700"
                                />
                            </div>
                            
                            <div className="mb-4">
                                <label htmlFor="user-select" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                                    Пользователь
                                </label>
                                <select 
                                    id="user-select"
                                    value={selectedUserId.toString()}
                                    onChange={(e) => setSelectedUserId(Number(e.target.value))}
                                    className="block w-full rounded-md border-gray-300 dark:border-zinc-700 dark:bg-zinc-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                >
                                    {users?.map((user) => (
                                        <option key={user.id} value={user.id.toString()}>
                                            {user.name || (user.passCode && `Паскод: ${user.passCode}`) || `Пользователь ID: ${user.id}`}{user.isActive === false ? ' (Неактивен)' : ''}
                                        </option>
                                    ))}
                                    {!users?.length && (
                                        <option value="1">Пользователь ID: 1</option>
                                    )}
                                </select>
                                {/* Отображение текущего выбранного пользователя */}
                                {selectedUserId && users && (
                                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm">
                                        <span className="font-medium">Выбранный пользователь: </span>
                                        {(() => {
                                            const user = users.find(u => u.id === selectedUserId);
                                            return user 
                                                ? (user.name || (user.passCode && `Паскод: ${user.passCode}`) || `ID: ${user.id}`)
                                                : `ID: ${selectedUserId}`;
                                        })()}
                                    </div>
                                )}
                            </div>
                            
                            <div className="mb-4">
                                <Input
                                    label="Примечания к отчету"
                                    type="text" 
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Дополнительная информация об отчете (необязательно)"
                                    className="dark:bg-zinc-900 dark:border-zinc-700"
                                />
                            </div>
                            
                            <div className="grid grid-cols-1 gap-6 mb-6 md:grid-cols-3 dark:text-zinc-300">
                                <div>
                                    <label htmlFor="timeRangeStart">Начало периода поиска</label>
                                    <Input 
                                        type="datetime-local"
                                        id="timeRangeStart"
                                        value={timeRangeStart}
                                        onChange={(e) => setTimeRangeStart(e.target.value)}
                                        className="dark:bg-zinc-900 dark:border-zinc-700"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="timeRangeEnd">Конец периода поиска</label>
                                    <Input 
                                        type="datetime-local"
                                        id="timeRangeEnd"
                                        value={timeRangeEnd}
                                        onChange={(e) => setTimeRangeEnd(e.target.value)}
                                        className="dark:bg-zinc-900 dark:border-zinc-700"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="reportDate">Дата формирования отчета</label>
                                    <Input 
                                        type="datetime-local"
                                        id="reportDate"
                                        value={reportDate}
                                        onChange={(e) => setReportDate(e.target.value)}
                                        className="dark:bg-zinc-900 dark:border-zinc-700"
                                    />
                                </div>
                            </div>
                        </div>
                        
                        <div className="p-4 border rounded-lg shadow-sm mb-6 bg-white dark:bg-zinc-800 dark:border-zinc-700">
                            <h3 className="text-lg font-semibold mb-2 dark:text-zinc-200">Кабинеты для сопоставления</h3>

                            {/* Селектор для выбора типа кабинета */}
                            <div className="border-b mb-4 dark:border-zinc-700">
                                <button 
                                    type="button"
                                    className={`px-4 py-2 ${activeTab === 'vires' ? 'border-b-2 border-orange-500 text-orange-600 dark:text-orange-400 dark:border-orange-400' : 'text-gray-600 dark:text-zinc-400'}`}
                                    onClick={() => setActiveTab('vires')}
                                >
                                    Vires
                                </button>
                                <button 
                                    type="button"
                                    className={`px-4 py-2 ${activeTab === 'bybit' ? 'border-b-2 border-yellow-500 text-yellow-600 dark:text-yellow-400 dark:border-yellow-400' : 'text-gray-600 dark:text-zinc-400'}`}
                                    onClick={() => setActiveTab('bybit')}
                                >
                                    Bybit
                                </button>
                            </div>
                                
                            {activeTab === 'vires' && (
                                <div className="mt-4">
                                    {!isLoadingViresCabinets && viresCabinets && (
                                        viresCabinets.length > 0 ? (
                                            <div className="p-2 border rounded-md dark:border-zinc-700">
                                                <div className="grid grid-cols-1 gap-6 mb-6 md:grid-cols-2 dark:text-zinc-300">
                                                    {viresCabinets.map((cabinet) => (
                                                        <div key={cabinet.id} className="flex items-center justify-between p-2 border rounded hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-700">
                                                            <div>
                                                                <div className="font-medium dark:text-zinc-300">
                                                                    {cabinet.name ? `${cabinet.name}` : 'Без имени'} 
                                                                    <span className="text-orange-600 dark:text-orange-400 ml-1 font-bold">[Login: {cabinet.login}]</span>
                                                                </div>
                                                                <span className="text-sm text-gray-500 dark:text-zinc-400">ID: {cabinet.id}</span>
                                                            </div>
                                                            <Button 
                                                                type="button"
                                                                size="sm"
                                                                color="primary"
                                                                variant="light"
                                                                onClick={() => handleAddCabinet(cabinet.id, 'vires')}
                                                                startContent={<Plus size={16} />}
                                                            >
                                                                Добавить
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-500 p-4 border rounded-md text-center dark:text-zinc-400 dark:border-zinc-700">
                                                Нет доступных Vires кабинетов. Пожалуйста, добавьте их сначала через{" "}
                                                <Button variant="light" size="sm" onClick={() => router.push('/vires-cabinets')} className="p-0 h-auto inline">
                                                    управление кабинетами
                                                </Button>
                                            </p>
                                        )
                                    )}
                                    {isLoadingViresCabinets && <div className="text-center p-4"><Spinner /></div>}
                                </div>
                            )}
                                
                            {activeTab === 'bybit' && (
                                <div className="mt-4">
                                    {!isLoadingBybitCabinets && bybitCabinets && (
                                        bybitCabinets.length > 0 ? (
                                            <div className="p-2 border rounded-md dark:border-zinc-700">
                                                <div className="grid grid-cols-1 gap-6 mb-6 md:grid-cols-2 dark:text-zinc-300">
                                                    {bybitCabinets.map((cabinet) => (
                                                        <div key={cabinet.id} className="flex items-center justify-between p-2 border rounded hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-700">
                                                            <div>
                                                                <div className="font-medium dark:text-zinc-300">{cabinet.bybitEmail}</div>
                                                                <span className="text-sm text-gray-500 dark:text-zinc-400">ID: {cabinet.id}</span>
                                                            </div>
                                                            <Button 
                                                                type="button"
                                                                size="sm"
                                                                color="primary"
                                                                variant="light"
                                                                onClick={() => handleAddCabinet(cabinet.id, 'bybit')}
                                                                startContent={<Plus size={16} />}
                                                            >
                                                                Добавить
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-500 p-4 border rounded-md text-center dark:text-zinc-400 dark:border-zinc-700">
                                                Нет доступных Bybit кабинетов. Пожалуйста, добавьте их сначала.
                                            </p>
                                        )
                                    )}
                                    {isLoadingBybitCabinets && <div className="text-center p-4"><Spinner /></div>}
                                </div>
                            )}
                            
                            {/* Список выбранных кабинетов с индивидуальными настройками */}
                            <div className="mb-6 dark:text-zinc-300">
                                <h4 className="text-md font-medium mb-2">Выбранные кабинеты ({cabinetConfigs.length})</h4>
                                {cabinetConfigs.length === 0 ? (
                                    <p className="text-sm text-gray-500 p-4 border rounded-md text-center dark:text-zinc-400 dark:border-zinc-700">
                                        Не выбрано ни одного кабинета
                                    </p>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        {/* Колонка Vires кабинетов */}
                                        <div>
                                            <h5 className="text-sm font-medium mb-2 dark:text-zinc-300">Vires кабинеты</h5>
                                            <div className="border dark:border-zinc-700 rounded-md p-2 h-80 overflow-y-auto dark:bg-zinc-900">
                                                {cabinetConfigs.filter(c => c.cabinetType === 'vires').length === 0 ? (
                                                    <p className="text-sm text-gray-500 p-2 text-center dark:text-zinc-400">
                                                        Не выбрано ни одного Vires кабинета
                                                    </p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {cabinetConfigs.filter(c => c.cabinetType === 'vires').map((config, index) => {
                                                            // Находим информацию о кабинете для отображения
                                                            const cabinetInfo = viresCabinets?.find(c => c.id === config.cabinetId);
                                                            const cabinetName = cabinetInfo?.name || cabinetInfo?.login || `Vires ID: ${config.cabinetId}`;
                                                            
                                                            return (
                                                                <div 
                                                                    key={`vires-${config.cabinetId}-${index}`} 
                                                                    className="border rounded-md p-3 dark:border-zinc-700 dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700"
                                                                >
                                                                    <div className="flex justify-between items-center">
                                                                        <div>
                                                                            <span className="font-medium text-sm">
                                                                                {cabinetName}
                                                                            </span>
                                                                            <span className="ml-2 px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                                                                                Vires
                                                                            </span>
                                                                        </div>
                                                                        <Button
                                                                            type="button"
                                                                            color="danger"
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onClick={() => handleRemoveCabinet(config.cabinetId, config.cabinetType)}
                                                                        >
                                                                            <Trash size={16} />
                                                                        </Button>
                                                                    </div>
                                                                    <div className="grid grid-cols-1 gap-2 mt-2">
                                                                        <Input
                                                                            type="datetime-local" 
                                                                            label="Начало периода"
                                                                            value={config.startDate}
                                                                            onChange={(e) => handleCabinetDateChange(config.cabinetId, config.cabinetType, 'startDate', e.target.value)}
                                                                            size="sm"
                                                                            className="text-sm dark:bg-zinc-900 dark:border-zinc-700"
                                                                        />
                                                                        <Input
                                                                            type="datetime-local"
                                                                            label="Конец периода"
                                                                            value={config.endDate}
                                                                            onChange={(e) => handleCabinetDateChange(config.cabinetId, config.cabinetType, 'endDate', e.target.value)}
                                                                            size="sm"
                                                                            className="text-sm dark:bg-zinc-900 dark:border-zinc-700"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* Колонка Bybit кабинетов */}
                                        <div>
                                            <h5 className="text-sm font-medium mb-2 dark:text-zinc-300">Bybit кабинеты</h5>
                                            <div className="border dark:border-zinc-700 rounded-md p-2 h-80 overflow-y-auto dark:bg-zinc-900">
                                                {cabinetConfigs.filter(c => c.cabinetType === 'bybit').length === 0 ? (
                                                    <p className="text-sm text-gray-500 p-2 text-center dark:text-zinc-400">
                                                        Не выбрано ни одного Bybit кабинета
                                                    </p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {cabinetConfigs.filter(c => c.cabinetType === 'bybit').map((config, index) => {
                                                            // Находим информацию о кабинете для отображения
                                                            const cabinetInfo = bybitCabinets?.find(c => c.id === config.cabinetId);
                                                            const cabinetName = cabinetInfo?.bybitEmail || `Bybit ID: ${config.cabinetId}`;
                                                            
                                                            return (
                                                                <div 
                                                                    key={`bybit-${config.cabinetId}-${index}`} 
                                                                    className="border rounded-md p-3 dark:border-zinc-700 dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700"
                                                                >
                                                                    <div className="flex justify-between items-center">
                                                                        <div>
                                                                            <span className="font-medium text-sm">
                                                                                {cabinetName}
                                                                            </span>
                                                                            <span className="ml-2 px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                                                                Bybit
                                                                            </span>
                                                                        </div>
                                                                        <Button
                                                                            type="button"
                                                                            color="danger"
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onClick={() => handleRemoveCabinet(config.cabinetId, config.cabinetType)}
                                                                        >
                                                                            <Trash size={16} />
                                                                        </Button>
                                                                    </div>
                                                                    <div className="grid grid-cols-1 gap-2 mt-2">
                                                                        <Input
                                                                            type="datetime-local" 
                                                                            label="Начало периода"
                                                                            value={config.startDate}
                                                                            onChange={(e) => handleCabinetDateChange(config.cabinetId, config.cabinetType, 'startDate', e.target.value)}
                                                                            size="sm"
                                                                            className="text-sm dark:bg-zinc-900 dark:border-zinc-700"
                                                                        />
                                                                        <Input
                                                                            type="datetime-local"
                                                                            label="Конец периода"
                                                                            value={config.endDate}
                                                                            onChange={(e) => handleCabinetDateChange(config.cabinetId, config.cabinetType, 'endDate', e.target.value)}
                                                                            size="sm"
                                                                            className="text-sm dark:bg-zinc-900 dark:border-zinc-700"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button
                                type="submit" 
                                color="primary" 
                                isLoading={createReportMutation.isPending}
                                title="При сохранении отчета будет выполнен автоматический мэтчинг транзакций"
                                className="dark:bg-blue-700 dark:hover:bg-blue-800"
                            >
                                Сохранить и выполнить автомэтчинг
                            </Button>
                        </div>
                    </form>
                </CardBody>
            </Card>
        </div>
    );
}
