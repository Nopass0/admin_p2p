"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { Card, CardBody } from "@heroui/card";
import { Badge } from "@heroui/badge";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/table";
import { Pagination } from "@heroui/pagination";
import { Clock, Calendar, User, Server, RefreshCw } from "lucide-react";
import { Input } from "@heroui/input";
import { Switch } from "@heroui/switch";

interface UserWorkSessionsTabProps {
  userId: number;
}

export function UserWorkSessionsTab({ userId }: UserWorkSessionsTabProps) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [includeActive, setIncludeActive] = useState(true);

  // Fetch work sessions data
  const { data, isLoading, isError, refetch } = api.workSessions.getUserWorkSessions.useQuery(
    { 
      userId, 
      page, 
      pageSize,
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      endDate: endDate ? new Date(endDate).toISOString() : undefined,
      includeActive
    },
    {
      enabled: !!userId && !isNaN(userId),
      refetchOnWindowFocus: false,
    }
  );

  // Helper function for formatting dates
  const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return "—";
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

  // Helper function for formatting duration
  const formatDuration = (durationInMinutes: number | null | undefined) => {
    if (!durationInMinutes) return "—";
    
    const hours = Math.floor(durationInMinutes / 60);
    const minutes = durationInMinutes % 60;
    
    return `${hours > 0 ? `${hours} ч ` : ''}${minutes} мин`;
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  // Handle filter reset
  const resetFilters = () => {
    setStartDate("");
    setEndDate("");
    setIncludeActive(true);
    setPage(1);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Spinner size="md" color="primary" label="Загрузка рабочих сессий..." />
      </div>
    );
  }

  if (isError || !data || !data.workSessions) {
    return (
      <div className="text-center py-8 text-red-500">
        <p>Ошибка при загрузке рабочих сессий.</p>
        <Button 
          color="primary" 
          variant="flat" 
          size="sm" 
          className="mt-2" 
          onClick={() => refetch()}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Попробовать снова
        </Button>
      </div>
    );
  }

  const { workSessions, pagination } = data;

  return (
    <div className="space-y-4">
      {/* Header and Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
          Рабочие сессии пользователя
        </h3>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex gap-2">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4 text-zinc-500" />
              <Input 
                type="date" 
                placeholder="С" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
                size="sm"
                className="w-auto min-w-[140px]"
              />
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4 text-zinc-500" />
              <Input 
                type="date" 
                placeholder="По" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
                size="sm"
                className="w-auto min-w-[140px]"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Switch 
              id="includeActive" 
              isSelected={includeActive}
              onValueChange={setIncludeActive}
              size="sm"
            />
            <label htmlFor="includeActive" className="text-sm text-zinc-600 dark:text-zinc-400">
              Активные сессии
            </label>
          </div>
          
          <Button 
            variant="light" 
            size="sm" 
            onClick={resetFilters}
          >
            Сбросить
          </Button>
        </div>
      </div>

      {workSessions.length > 0 ? (
        <>
          <Table 
            aria-label="Таблица рабочих сессий"
            bottomContent={
              pagination.totalPages > 1 ? (
                <div className="flex justify-center pt-2">
                  <Pagination
                    total={pagination.totalPages}
                    initialPage={page}
                    page={page}
                    onChange={handlePageChange}
                  />
                </div>
              ) : null
            }
            classNames={{
              table: "min-w-full",
            }}
          >
            <TableHeader>
              <TableColumn>Начало</TableColumn>
              <TableColumn>Окончание</TableColumn>
              <TableColumn>Длительность</TableColumn>
              <TableColumn>Кабинеты IDEX</TableColumn>
              <TableColumn>Статус</TableColumn>
            </TableHeader>
            <TableBody>
              {workSessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell>{formatDate(session.startTime)}</TableCell>
                  <TableCell>{formatDate(session.endTime)}</TableCell>
                  <TableCell>{formatDuration(session.duration)}</TableCell>
                  <TableCell>
                    {session.idexCabinets && session.idexCabinets.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {session.idexCabinets.map((cabinet) => (
                          <Badge key={cabinet.id} color="secondary" variant="flat" size="sm" className="mr-1">
                            IDEX #{cabinet.idexId}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-zinc-500 dark:text-zinc-400 text-sm">Нет кабинетов</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      color={session.endTime ? "success" : "warning"} 
                      variant="flat"
                    >
                      {session.endTime ? "Завершена" : "Активна"}
                    </Badge>
                    {session.autoCompleted && (
                      <Badge 
                        color="danger" 
                        variant="flat"
                        size="sm"
                        className="ml-1"
                      >
                        Авто
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      ) : (
        <div className="text-center py-10 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
          <Server className="w-10 h-10 mx-auto text-zinc-400 mb-2" />
          <p className="text-zinc-500 dark:text-zinc-400">
            У пользователя пока нет рабочих сессий{startDate || endDate ? ' за выбранный период' : ''}.
          </p>
        </div>
      )}
    </div>
  );
}