"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { Card, CardBody } from "@heroui/card";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { RefreshCw, Calendar, ArrowUp, ArrowDown, BarChart3, CircleDollarSign } from "lucide-react";

interface UserStatsTabProps {
  userId: number;
}

export function UserStatsTab({ userId }: UserStatsTabProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Получение статистики пользователя
  const {
    data,
    isLoading,
    refetch,
    isRefetching
  } = api.transactions.getUserTransactionStats.useQuery({
    userId,
    startDate: startDate || undefined,
    endDate: endDate || undefined
  }, {
    refetchOnWindowFocus: false
  });
  
  return (
    <div>
      {/* Фильтры по датам */}
      <div className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
        <h3 className="text-md font-medium mb-3">Фильтр по периоду</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Начальная дата</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              startContent={<Calendar className="w-4 h-4 text-zinc-400" />}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Конечная дата</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              startContent={<Calendar className="w-4 h-4 text-zinc-400" />}
            />
          </div>
        </div>
        
        <div className="flex justify-end mt-3">
          <Button
            color="primary"
            onClick={() => void refetch()}
            isLoading={isRefetching}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Применить
          </Button>
        </div>
      </div>
      
      {/* Основная статистика */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner size="lg" color="primary" />
        </div>
      ) : data?.success && data.stats ? (
        <div className="space-y-6">
          {/* Карточки с общей статистикой */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardBody className="p-4">
                <div className="flex items-center mb-2">
                  <BarChart3 className="w-5 h-5 text-blue-500 mr-2" />
                  <h4 className="text-sm font-medium text-gray-500">Всего транзакций</h4>
                </div>
                <p className="text-2xl font-bold">{data.stats.totalTransactions}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Матчи: {data.stats.totalMatchedTransactions} ({data.stats.totalTransactions > 0 
                    ? Math.round((data.stats.totalMatchedTransactions / data.stats.totalTransactions) * 100) 
                    : 0}%)
                </p>
              </CardBody>
            </Card>
            
            <Card>
              <CardBody className="p-4">
                <div className="flex items-center mb-2">
                  <CircleDollarSign className="w-5 h-5 text-green-500 mr-2" />
                  <h4 className="text-sm font-medium text-gray-500">Общая сумма</h4>
                </div>
                <p className="text-2xl font-bold">{data.stats.totalAmount.toFixed(2)} ₽</p>
                <p className="text-sm text-gray-500 mt-1">
                  Прибыль: {data.stats.totalProfit.toFixed(2)} ₽ ({data.stats.profitPercentage.toFixed(2)}%)
                </p>
              </CardBody>
            </Card>
            
            <Card>
              <CardBody className="p-4">
                <div className="flex items-center mb-2">
                  <ArrowDown className="w-5 h-5 text-red-500 mr-2" />
                  <h4 className="text-sm font-medium text-gray-500">Покупки</h4>
                </div>
                <p className="text-2xl font-bold">{data.stats.typeStats.buy.count}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Объем: {data.stats.typeStats.buy.totalAmount.toFixed(2)} ₽
                </p>
              </CardBody>
            </Card>
            
            <Card>
              <CardBody className="p-4">
                <div className="flex items-center mb-2">
                  <ArrowUp className="w-5 h-5 text-green-500 mr-2" />
                  <h4 className="text-sm font-medium text-gray-500">Продажи</h4>
                </div>
                <p className="text-2xl font-bold">{data.stats.typeStats.sell.count}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Объем: {data.stats.typeStats.sell.totalAmount.toFixed(2)} ₽
                </p>
              </CardBody>
            </Card>
          </div>
          
          {/* Статистика по активам */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Статистика по активам</h3>
            <div className="overflow-x-auto rounded-md">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
                <thead className="bg-zinc-50 dark:bg-zinc-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-300 uppercase tracking-wider">
                      Актив
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-300 uppercase tracking-wider">
                      Количество
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-300 uppercase tracking-wider">
                      Объем (₽)
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-300 uppercase tracking-wider">
                      Матчи
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-300 uppercase tracking-wider">
                      Прибыль (₽)
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-700">
                  {Object.entries(data.stats.assetStats).map(([asset, stats]) => (
                    <tr key={asset}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium">{asset}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {stats.count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {stats.totalAmount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {stats.matchedCount} ({stats.count > 0 ? Math.round((stats.matchedCount / stats.count) * 100) : 0}%)
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={stats.profit >= 0 ? "text-green-500" : "text-red-500"}>
                          {stats.profit.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Статистика по статусам */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Статистика по статусам</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(data.stats.statusStats).map(([status, count]) => {
                let colorClass = "bg-blue-100 text-blue-800";
                
                switch (status.toLowerCase()) {
                  case "completed":
                    colorClass = "bg-green-100 text-green-800";
                    break;
                  case "pending":
                    colorClass = "bg-yellow-100 text-yellow-800";
                    break;
                  case "failed":
                    colorClass = "bg-red-100 text-red-800";
                    break;
                }
                
                return (
                  <div key={status} className="p-4 rounded-lg bg-gray-50 dark:bg-zinc-800">
                    <div className="flex justify-between items-center mb-1">
                      <span className={`px-2 py-1 rounded text-xs ${colorClass}`}>
                        {status}
                      </span>
                      <span className="text-lg font-bold">{count}</span>
                    </div>
                    <div className="w-full bg-zinc-200 dark:bg-zinc-600 rounded-full h-2.5">
                      <div 
                        className={status.toLowerCase() === "completed" 
                          ? "bg-green-500 h-2.5 rounded-full" 
                          : status.toLowerCase() === "pending" 
                            ? "bg-yellow-500 h-2.5 rounded-full" 
                            : "bg-red-500 h-2.5 rounded-full"
                        }
                        style={{ width: `${(count / data.stats.totalTransactions) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-300 mt-1">
                      {Math.round((count / data.stats.totalTransactions) * 100)}% от общего
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-10 text-zinc-500">
          {data?.message || "Нет данных статистики для отображения"}
        </div>
      )}
    </div>
  );
}
