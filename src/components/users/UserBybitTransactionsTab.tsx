import { useState } from "react";
import { api } from "@/trpc/react";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/table";
import { Pagination } from "@heroui/pagination";
import { Badge } from "@heroui/badge";
import { Search, Calendar, RefreshCw, CalendarIcon } from "lucide-react";
import { Card, CardBody } from "@heroui/card";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/popover";
import { Calendar as CalendarComponent } from "@heroui/calendar";

export function UserBybitTransactionsTab({ userId }) {
  // State for pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // State for filters
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  
  // Fetch transactions
  const { data, isLoading, isError, refetch } = api.bybitTransactions.getUserBybitTransactions.useQuery({
    userId,
    page,
    pageSize,
    searchQuery,
    startDate,
    endDate
  }, {
    enabled: !!userId,
    refetchOnWindowFocus: false,
  });
  
  // Function to handle search
  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1); // Reset page when searching
  };
  
  // Function to clear filters
  const handleClearFilters = () => {
    setSearchQuery("");
    setStartDate(null);
    setEndDate(null);
    setPage(1);
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleString('ru-RU', {
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit'
      });
    } catch (e) {
      return "Invalid Date";
    }
  };
  
  // Format number with fixed decimal points
  const formatNumber = (num, decimals = 2) => {
    if (num === null || num === undefined) return "N/A";
    return Number(num).toFixed(decimals);
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Spinner size="lg" color="primary" label="Загрузка транзакций..." />
      </div>
    );
  }
  
  if (isError || !data) {
    return (
      <div className="text-center py-8 text-red-500">
        <Card>
          <CardBody className="text-center py-6">
            Ошибка при загрузке транзакций. Пожалуйста, попробуйте еще раз.
            <Button color="primary" variant="flat" size="sm" className="mt-4 mx-auto" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Попробовать снова
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }
  
  const { transactions, pagination } = data;
  
  return (
    <div className="space-y-4">
      {/* Filter Section */}
      <Card className="shadow-sm border border-zinc-200 dark:border-zinc-800">
        <CardBody className="p-4">
          <form onSubmit={handleSearch} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Search Input */}
            <div className="relative">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по всем полям..."
                className="pl-10" // Space for the icon
                aria-label="Поиск транзакций"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
            </div>
            
            {/* Date Range Pickers */}
            <div className="grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger>
                  <Button variant="bordered" className="w-full justify-start">
                    <CalendarIcon className="w-4 h-4 mr-2 text-zinc-400" />
                    {startDate ? formatDate(startDate) : "Дата с"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent>
                  <CalendarComponent
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              <Popover>
                <PopoverTrigger>
                  <Button variant="bordered" className="w-full justify-start">
                    <CalendarIcon className="w-4 h-4 mr-2 text-zinc-400" />
                    {endDate ? formatDate(endDate) : "Дата по"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent>
                  <CalendarComponent
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2 justify-end">
              <Button 
                type="button" 
                variant="bordered" 
                onClick={handleClearFilters}
                isDisabled={!searchQuery && !startDate && !endDate}
              >
                Сбросить
              </Button>
              <Button 
                type="submit" 
                color="primary"
              >
                Найти
              </Button>
              <Button
                type="button"
                variant="light"
                onClick={() => refetch()}
                isIconOnly
                aria-label="Обновить данные"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
      
      {/* Transactions Table */}
      <Card className="shadow-sm border border-zinc-200 dark:border-zinc-800">
        <Table aria-label="Транзакции с Bybit">
          <TableHeader>
            <TableColumn>Дата</TableColumn>
            <TableColumn>№ заказа</TableColumn>
            <TableColumn>Тип</TableColumn>
            <TableColumn>Актив</TableColumn>
            <TableColumn>Количество</TableColumn>
            <TableColumn>Сумма</TableColumn>
            <TableColumn>Цена за ед.</TableColumn>
            <TableColumn>Контрагент</TableColumn>
            <TableColumn>Статус</TableColumn>
          </TableHeader>
          <TableBody emptyContent="Транзакции не найдены">
            {transactions.length > 0 && transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>{formatDate(tx.dateTime)}</TableCell>
                <TableCell className="font-mono text-xs">{tx.orderNo}</TableCell>
                <TableCell>
                  <Badge 
                    color={tx.type.toLowerCase() === "buy" ? "danger" : "success"} 
                    variant="flat"
                    className="capitalize"
                  >
                    {tx.type}
                  </Badge>
                </TableCell>
                <TableCell>{tx.asset}</TableCell>
                <TableCell>{formatNumber(tx.amount, 8)}</TableCell>
                <TableCell>{formatNumber(tx.totalPrice, 2)}</TableCell>
                <TableCell>{formatNumber(tx.unitPrice, 2)}</TableCell>
                <TableCell>{tx.counterparty || "N/A"}</TableCell>
                <TableCell>
                  <Badge 
                    color={tx.status === "completed" ? "success" : 
                          tx.status === "pending" ? "warning" : "default"} 
                    variant="flat"
                    className="capitalize"
                  >
                    {tx.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      
      {/* Pagination */}
      {pagination && pagination.totalPages > 0 && (
        <div className="flex justify-center mt-4">
          <Pagination
            page={page}
            total={pagination.totalPages}
            onChange={setPage}
            showControls
            showShadow
            color="primary"
            className="justify-center"
          />
        </div>
      )}
      
      {/* Stats Summary */}
      {transactions.length > 0 && (
        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700/50 mt-4 text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Всего: {pagination.totalTransactions} транзакций | 
            Страница {page} из {pagination.totalPages} | 
            Показано: {Math.min(pageSize, transactions.length)} из {pagination.totalTransactions}
          </p>
        </div>
      )}
    </div>
  );
}