"use client";

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader, CardFooter } from "@heroui/card";
import { Spinner } from "@heroui/spinner";
import { Input } from "@heroui/input";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/table";
import { Pagination } from "@heroui/pagination";
import { Tooltip } from "@heroui/tooltip";
import { ArrowLeft, RefreshCw, Search, Wand2, LinkIcon, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import dayjs from 'dayjs';
import { Badge } from "@heroui/badge";

// Simplified type placeholders
type ViresTransaction = any; 
type BybitTransaction = any;
type ViresClipMatch = any;

export default function ReportDetailPage() {
    const router = useRouter();
    const params = useParams();
    const reportId = parseInt(params.id as string, 10);

    // Report Data
    const { data: reportData, isLoading: isLoadingReport, error: errorReport, refetch: refetchReport } = api.vv.getMatchViresReportById.useQuery(
        { id: reportId }, { enabled: !isNaN(reportId) }
    );

    // Transaction State & Fetching
    const [viresPage, setViresPage] = useState(1);
    const [bybitPage, setBybitPage] = useState(1);
    const [viresSearch, setViresSearch] = useState('');
    const [bybitSearch, setBybitSearch] = useState('');
    const itemsPerPage = 10;
    
    // Sorting state
    const [viresSort, setViresSort] = useState<{column: string, direction: 'asc' | 'desc'} | null>(null);
    const [bybitSort, setBybitSort] = useState<{column: string, direction: 'asc' | 'desc'} | null>(null);
    const [matchesSort, setMatchesSort] = useState<{column: string, direction: 'asc' | 'desc'} | null>(null);

    const { data: viresData, isLoading: isLoadingVires, refetch: refetchVires } = api.vv.getViresTransactionsForReport.useQuery(
        { 
            reportId, 
            page: viresPage, 
            limit: itemsPerPage, 
            search: viresSearch,
            sortColumn: viresSort?.column,
            sortDirection: viresSort?.direction
        }, 
        { enabled: !isNaN(reportId) }
    );
    
    const { data: bybitData, isLoading: isLoadingBybit, refetch: refetchBybit } = api.vv.getBybitTransactionsForReport.useQuery(
        { 
            reportId, 
            page: bybitPage, 
            limit: itemsPerPage, 
            search: bybitSearch,
            sortColumn: bybitSort?.column,
            sortDirection: bybitSort?.direction
        }, 
        { enabled: !isNaN(reportId) }
    );
    
    // Запрос для получения данных о сопоставленных транзакциях
    const [matchesPage, setMatchesPage] = useState(1);
    const { data: matchesData, isLoading: isLoadingMatches, refetch: refetchMatches } = api.vv.getMatchedTransactionsForReport.useQuery(
        { 
            reportId, 
            page: matchesPage, 
            limit: itemsPerPage,
            sortColumn: matchesSort?.column,
            sortDirection: matchesSort?.direction
        }, 
        { enabled: !isNaN(reportId) }
    );

    // Selection State
    const [selectedViresUuid, setSelectedViresUuid] = useState<string | null>(null);
    const [selectedViresObj, setSelectedViresObj] = useState<any | null>(null);
    const [selectedBybitId, setSelectedBybitId] = useState<number | null>(null);

    // Для обхода TypeScript ошибок, мы временно типизируем результаты мутаций как any
    const autoMatchMutation = api.vv.matchTransactionsAutomatically.useMutation({
        onSuccess: (result: any) => { 
            if (result.success) {
                toast.success(`Авто-сопоставлено: ${result.stats?.newMatches || 0}`); 
            } else {
                toast.error(result.message || "Ошибка автоматического сопоставления");
            }
            refetchVires(); 
            refetchBybit(); 
            refetchMatches();
            refetchReport();
        },
        onError: (error: any) => toast.error(`Ошибка авто-сопоставления: ${error.message}`),
    });
    
    const manualMatchMutation = api.vv.matchTransactionManually.useMutation({
        onSuccess: () => { 
            toast.success("Успешно сопоставлено вручную."); 
            setSelectedViresUuid(null); 
            setSelectedViresObj(null);
            setSelectedBybitId(null); 
            refetchVires(); 
            refetchBybit(); 
            refetchMatches(); 
            refetchReport();
        },
        onError: (error: any) => toast.error(`Ошибка ручного сопоставления: ${error.message}`),
    });
    
    // Мутация для удаления сопоставления
    const unmatchMutation = api.vv.unmatchTransaction.useMutation({
        onSuccess: () => { 
            toast.success("Сопоставление успешно удалено"); 
            refetchVires(); 
            refetchBybit(); 
            refetchMatches(); 
            refetchReport();
        },
        onError: (error: any) => toast.error(`Ошибка при удалении сопоставления: ${error.message}`),
    });

    // Handlers
    const handleAutoMatch = () => { 
        if (!isNaN(reportId) && window.confirm("Запустить авто-сопоставление?")) {
            autoMatchMutation.mutate({ reportId }); 
        }
    };
    
    const handleManualMatch = () => {
        if (selectedViresUuid && selectedBybitId && window.confirm("Сопоставить выбранные транзакции?")) {
            manualMatchMutation.mutate({ 
                reportId, 
                viresTransactionId: selectedViresUuid, 
                bybitTransactionId: selectedBybitId 
            });
        } else if (!selectedViresUuid || !selectedBybitId) {
             toast.error("Выберите по одной транзакции Vires и Bybit.");
        }
    };
    
    // Обработчик для удаления сопоставления
    const handleUnmatch = (matchId: number) => {
        if (window.confirm("Вы уверены, что хотите удалить это сопоставление?")) {
            unmatchMutation.mutate({ matchId, reportId });
        }
    };
    
    const handleSearchSubmit = (type: 'vires' | 'bybit') => {
        if (type === 'vires') { setViresPage(1); refetchVires(); } 
        else { setBybitPage(1); refetchBybit(); }
    };
    
    // Sorting handlers
    const handleSort = (table: 'vires' | 'bybit' | 'matches', column: string) => {
        if (table === 'vires') {
            setViresSort(prev => {
                // If clicking the same column, toggle direction or set to asc if null
                if (prev?.column === column) {
                    return prev.direction === 'asc' 
                        ? { column, direction: 'desc' } 
                        : { column, direction: 'asc' };
                }
                // New column, default to asc
                return { column, direction: 'asc' };
            });
            setViresPage(1);
            refetchVires();
        } else if (table === 'bybit') {
            setBybitSort(prev => {
                if (prev?.column === column) {
                    return prev.direction === 'asc' 
                        ? { column, direction: 'desc' } 
                        : { column, direction: 'asc' };
                }
                return { column, direction: 'asc' };
            });
            setBybitPage(1);
            refetchBybit();
        } else if (table === 'matches') {
            setMatchesSort(prev => {
                if (prev?.column === column) {
                    return prev.direction === 'asc' 
                        ? { column, direction: 'desc' } 
                        : { column, direction: 'asc' };
                }
                return { column, direction: 'asc' };
            });
            setMatchesPage(1);
            refetchMatches();
        }
    };
    
    // Helper to render sort indicator
    const renderSortIndicator = (table: 'vires' | 'bybit' | 'matches', column: string) => {
        const sortState = table === 'vires' ? viresSort : table === 'bybit' ? bybitSort : matchesSort;
        
        if (sortState?.column !== column) return null;
        
        return sortState.direction === 'asc' ? ' ↑' : ' ↓';
    };
    
    const formatAmount = (amount: any): string => {
        const num = typeof amount === 'object' && amount !== null && 'toNumber' in amount ? amount.toNumber() : Number(amount);
        return isNaN(num) ? 'N/A' : num.toFixed(2);
    };

    // Render Logic
    if (isNaN(reportId)) return <div className="p-4 text-danger">Неверный ID отчета.</div>;
    if (isLoadingReport) return <div className="p-4"><Spinner label="Загрузка отчета..." /></div>;
    if (errorReport) return <div className="p-4 text-danger">Ошибка: {errorReport.message}</div>;
    if (!reportData) return <div className="p-4 text-warning">Отчет {reportId} не найден.</div>;

    return (
        <div className="container mx-auto p-4 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                 <Button variant="light" onPress={() => router.push('/vv')} startContent={<ArrowLeft size={18} />}>Назад</Button>
                 <h1 className="text-2xl font-bold">Отчет: {reportData.id}</h1>
                 <div className="flex items-center gap-2">
                     <span className="text-sm text-zinc-500">
                         {dayjs(reportData.timeRangeStart).format("DD.MM.YY HH:mm")} - {dayjs(reportData.timeRangeEnd).format("DD.MM.YY HH:mm")}
                     </span>
                     <Tooltip content="Обновить"><Button isIconOnly variant="light" onPress={() => { refetchReport(); refetchVires(); refetchBybit(); }}><RefreshCw size={18} /></Button></Tooltip>
                 </div>
            </div>

            {/* Actions */}
             <div className="flex justify-end gap-3">
                 <Button color="primary" variant="ghost" startContent={<Wand2 size={18}/>} onPress={handleAutoMatch} isLoading={autoMatchMutation.isPending}>Авто</Button>
                 <Button color="success" startContent={<LinkIcon size={18}/>} onPress={handleManualMatch} isLoading={manualMatchMutation.isPending} isDisabled={!selectedViresUuid || !selectedBybitId}>Вручную</Button>
             </div>

            {/* Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Vires Table */}
                <Card>
                    <CardHeader className="flex justify-between items-center">
                         <h2 className="text-xl font-semibold">Vires</h2>
                         <div className="flex gap-1 w-1/2">
                              <Input placeholder="Поиск..." size="sm" value={viresSearch} onChange={(e)=>setViresSearch(e.target.value)} onKeyDown={(e)=> e.key === 'Enter' && handleSearchSubmit('vires')} isClearable onClear={() => setViresSearch('')}/>
                              <Button isIconOnly size="sm" variant="light" onPress={()=>handleSearchSubmit('vires')}><Search size={16}/></Button>
                         </div>
                    </CardHeader>
                    <CardBody>
                         {isLoadingVires ? <Spinner size="sm"/> : !viresData || viresData.transactions.length === 0 ? <p>Нет данных.</p> : (
                             <Table aria-label="Vires" selectionMode="single" selectedKeys={selectedViresUuid ? new Set([selectedViresUuid]) : new Set()} onSelectionChange={(keys) => {
                                const uuid = keys === 'all' ? null : Array.from(keys)[0] as string;
                                setSelectedViresUuid(uuid);
                                if (uuid && viresData?.transactions) {
                                  // Найти весь объект транзакции по uuid
                                  const selectedTx = viresData.transactions.find((tx: any) => tx.uuid === uuid);
                                  setSelectedViresObj(selectedTx || null);
                                } else {
                                  setSelectedViresObj(null);
                                }
                             }}>
                                <TableHeader>
                                    <TableColumn>ID</TableColumn>
                                    <TableColumn onClick={() => handleSort('vires', 'createdAt')} style={{cursor: 'pointer'}}>
                                        Время {renderSortIndicator('vires', 'createdAt')}
                                    </TableColumn>
                                    <TableColumn onClick={() => handleSort('vires', 'sum_rub')} style={{cursor: 'pointer'}}>
                                        Сумма (RUB) {renderSortIndicator('vires', 'sum_rub')}
                                    </TableColumn>
                                    <TableColumn onClick={() => handleSort('vires', 'sum_usdt')} style={{cursor: 'pointer'}}>
                                        Сумма (USDT) {renderSortIndicator('vires', 'sum_usdt')}
                                    </TableColumn>
                                    <TableColumn>Карта/Телефон</TableColumn>
                                    <TableColumn>Email</TableColumn>
                                </TableHeader>
                                <TableBody items={viresData.transactions as ViresTransaction[]}>
                                    {(item) => (
                                      <TableRow key={item.uuid}>
                                        <TableCell>{item.id}</TableCell>
                                        <TableCell>{dayjs(item.createdAt).format('DD.MM.YYYY HH:mm')}</TableCell>
                                        <TableCell>{formatAmount(Math.abs(item.sum_rub))}</TableCell>
                                        <TableCell>{formatAmount(Math.abs(item.sum_usdt))}</TableCell>
                                        <TableCell className="max-w-[150px] truncate">{item.card}</TableCell>
                                        <TableCell>{item.cabinet.login}</TableCell>
                                      </TableRow>
                                    )}
                                </TableBody>
                             </Table>
                         )}
                    </CardBody>
                     {viresData && viresData.totalPages > 1 && <CardFooter className="justify-center"><Pagination total={viresData.totalPages} page={viresPage} onChange={setViresPage} size="sm"/></CardFooter>}
                </Card>

                 {/* Bybit Table */}
                 <Card>
                     <CardHeader className="flex justify-between items-center">
                         <h2 className="text-xl font-semibold">Bybit</h2>
                         <div className="flex gap-1 w-1/2">
                             <Input placeholder="Поиск..." size="sm" value={bybitSearch} onChange={(e)=>setBybitSearch(e.target.value)} onKeyDown={(e)=> e.key === 'Enter' && handleSearchSubmit('bybit')} isClearable onClear={() => setBybitSearch('')}/>
                             <Button isIconOnly size="sm" variant="light" onPress={()=>handleSearchSubmit('bybit')}><Search size={16}/></Button>
                         </div>
                     </CardHeader>
                     <CardBody>
                          {isLoadingBybit ? <Spinner size="sm"/> : !bybitData || bybitData.transactions.length === 0 ? <p>Нет данных.</p> : (
                             <Table aria-label="Bybit" selectionMode="single" selectedKeys={selectedBybitId ? new Set([selectedBybitId.toString()]) : new Set()} onSelectionChange={(keys) => setSelectedBybitId(keys === 'all' ? null : parseInt(Array.from(keys)[0] as string, 10))}>
                                <TableHeader>
                                    <TableColumn onClick={() => handleSort('bybit', 'id')} style={{cursor: 'pointer'}}>
                                        ID {renderSortIndicator('bybit', 'id')}
                                    </TableColumn>
                                    <TableColumn onClick={() => handleSort('bybit', 'email')} style={{cursor: 'pointer'}}>
                                        Email {renderSortIndicator('bybit', 'email')}
                                    </TableColumn>
                                    <TableColumn onClick={() => handleSort('bybit', 'dateTime')} style={{cursor: 'pointer'}}>
                                        Время {renderSortIndicator('bybit', 'dateTime')}
                                    </TableColumn>
                                    <TableColumn onClick={() => handleSort('bybit', 'totalPrice')} style={{cursor: 'pointer'}}>
                                        Сумма {renderSortIndicator('bybit', 'totalPrice')}
                                    </TableColumn>
                                    <TableColumn>
                                        Номера Телефонов
                                    </TableColumn>
                                </TableHeader>
                                <TableBody items={bybitData.transactions as BybitTransaction[]}>
                                     {(item) => (
                                       <TableRow key={item.id}>
                                          <TableCell>{item.id}</TableCell>
                                          <TableCell>{item.email}</TableCell>

                                          <TableCell>{dayjs(item.dateTime).format('DD.MM.YY HH:mm:ss')}</TableCell>
                                          <TableCell>{formatAmount(item.totalPrice)}</TableCell>
                                          <TableCell>{String(item.phoneNumbers)}</TableCell>
                                       </TableRow>
                                     )}
                                 </TableBody>
                             </Table>
                         )}
                     </CardBody>
                     {bybitData && bybitData.totalPages > 1 && <CardFooter className="justify-center"><Pagination total={bybitData.totalPages} page={bybitPage} onChange={setBybitPage} size="sm"/></CardFooter>}
                 </Card>
            </div>
            
            {/* Статистические блоки */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                {/* Блок статистики Vires */}
                <Card className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 dark:border-orange-800">
                    <CardBody>
                        <h3 className="text-xl font-semibold mb-4 text-orange-800 dark:text-orange-300">Vires Транзакции</h3>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">Всего</p>
                                <p className="text-3xl font-bold text-orange-700 dark:text-orange-300">
                                    {reportData?.totalViresTransactions || 0}
                                </p>
                            </div>
                            <div>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">Сопоставлено</p>
                                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                                    {reportData?.matchedViresCount || 0}
                                </p>
                            </div>
                            <div>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">Не сопоставлено</p>
                                <p className="text-3xl font-bold text-orange-500 dark:text-orange-400">
                                    {reportData?.unmatchedViresTransactions || 0}
                                </p>
                            </div>
                        </div>
                    </CardBody>
                </Card>
                
                {/* Блок статистики Bybit */}
                <Card className="bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-800/30 dark:border-yellow-800">
                    <CardBody>
                        <h3 className="text-xl font-semibold mb-4 text-yellow-800 dark:text-yellow-300">Bybit Транзакции</h3>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">Всего</p>
                                <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-300">
                                    {reportData?.totalBybitTransactions || 0}
                                </p>
                            </div>
                            <div>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">Сопоставлено</p>
                                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                                    {reportData?.matchedBybitCount || 0}
                                </p>
                            </div>
                            <div>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">Не сопоставлено</p>
                                <p className="text-3xl font-bold text-orange-500 dark:text-orange-400">
                                    {reportData?.unmatchedBybitTransactions || 0}
                                </p>
                            </div>
                        </div>
                    </CardBody>
                </Card>
            </div>
            
            {/* Общая статистика */}
            <Card className="mt-6 bg-gradient-to-r from-green-50 to-emerald-100 dark:from-green-900/30 dark:to-emerald-800/30 dark:border-emerald-800">
                <CardBody>
                    <h3 className="text-xl font-semibold mb-4 text-emerald-800 dark:text-emerald-300">Статистика сопоставления</h3>
                    {/* Основная статистика */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                        {/* Валовый расход */}
                        <div className="flex flex-col">
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Валовый расход</p>
                            <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                                {reportData?.totalExpense?.toFixed(2) || '0.00'}
                            </p>
                            <p className="text-xs text-gray-500">USDT</p>
                        </div>
                        
                        {/* Валовый доход */}
                        <div className="flex flex-col">
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Валовый доход</p>
                            <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                                {reportData?.totalIncome?.toFixed(2) || '0.00'}
                            </p>
                            <p className="text-xs text-gray-500">USDT</p>
                        </div>
                        
                        {/* Валовая прибыль с процентом */}
                        <div className="flex flex-col">
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Валовая прибыль</p>
                            <div className="flex items-baseline gap-2">
                                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                                    {reportData?.totalProfit?.toFixed(2) || '0.00'}
                                </p>
                                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                                    ({reportData?.totalProfitPercentage?.toFixed(2) || '0.00'}%)
                                </p>
                            </div>
                            <p className="text-xs text-gray-500">USDT</p>
                        </div>
                    </div>
                    
                    {/* Дополнительная статистика */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {/* Всего сопоставлений */}
                        <div>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Кол-во ордеров</p>
                            <div className="flex items-baseline gap-1">
                                <p className="text-xl font-bold text-gray-800 dark:text-gray-200">
                                    {reportData?.totalMatches || 0}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">ордеров</p>
                            </div>
                        </div>
                        
                        {/* Средний спред */}
                        <div>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Ср. спред</p>
                            <p className="text-xl font-bold text-gray-800 dark:text-gray-200">
                                {reportData?.averageProfit?.toFixed(2) || '0.00'} USDT
                            </p>
                        </div>
                        
                        {/* Средний расход */}
                        <div>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Ср. расход</p>
                            <p className="text-xl font-bold text-gray-800 dark:text-gray-200">
                                {reportData?.averageExpense?.toFixed(2) || '0.00'} USDT
                            </p>
                        </div>
                    </div>
                </CardBody>
            </Card>
            
            {/* Таблица сопоставленных транзакций */}
            <Card className="mt-6">
                <CardHeader className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold">Сопоставленные транзакции</h2>
                    <Badge color="primary" variant="flat">{reportData?.totalMatches || 0}</Badge>
                </CardHeader>
                <CardBody>
                    {isLoadingMatches ? <Spinner size="sm"/> : !matchesData || !matchesData.matches || matchesData.matches.length === 0 ? <p>Нет сопоставленных транзакций.</p> : (
                        <Table aria-label="Сопоставленные транзакции" className="min-w-full">
                            <TableHeader>
                                <TableColumn>ID</TableColumn>
                                <TableColumn>Дата Bybit</TableColumn>
                                <TableColumn>Дата Vires</TableColumn>
                                <TableColumn>Сумма Bybit</TableColumn>
                                <TableColumn>Сумма Vires (RUB)</TableColumn>
                                <TableColumn>Расход</TableColumn>
                                <TableColumn>Доход</TableColumn>
                                <TableColumn>Спред</TableColumn>
                                <TableColumn>Спред (%)</TableColumn>
                                <TableColumn>Действие</TableColumn>
                            </TableHeader>
                            <TableBody items={matchesData.matches as ViresClipMatch[]}>
                                {(match) => (
                                    <TableRow key={match.id}>
                                        <TableCell>{match.id}</TableCell>
                                        <TableCell>{dayjs(match.bybitTransaction?.dateTime).subtract(3, 'hour').format('DD.MM.YY HH:mm')}</TableCell>
                                        <TableCell>{dayjs(match.viresTransaction?.createdAt).format('DD.MM.YY HH:mm')}</TableCell>
                                        <TableCell>{formatAmount(Math.abs(match.bybitTransaction?.totalPrice))}</TableCell>
                                        <TableCell>{formatAmount(Math.abs(match.viresTransaction?.sum_rub))}</TableCell>
                                        <TableCell>{formatAmount(match.grossExpense)} USDT</TableCell>
                                        <TableCell>{formatAmount(match.grossIncome)} USDT</TableCell>
                                        <TableCell className={match.grossProfit > 0 ? "text-success" : "text-danger"}>
                                            {formatAmount(match.grossProfit)} USDT
                                        </TableCell>
                                        <TableCell className={match.profitPercentage > 0 ? "text-success" : "text-danger"}>
                                            {match.profitPercentage?.toFixed(2) || '0.00'}%
                                        </TableCell>
                                        <TableCell>
                                            <Button isIconOnly size="sm" color="danger" variant="flat" onPress={() => handleUnmatch(match.id)}>
                                                <Trash2 size={16} />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardBody>
                {matchesData && matchesData.totalPages && matchesData.totalPages > 1 && (
                    <CardFooter className="justify-center">
                        <Pagination total={matchesData.totalPages} page={matchesPage} onChange={setMatchesPage} size="sm"/>
                    </CardFooter>
                )}
            </Card>
        </div>
    );
}
