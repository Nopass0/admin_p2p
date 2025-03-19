"use client";

import React from "react";
import { Card, CardBody } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Tooltip } from "@heroui/tooltip";
import { InfoIcon, TrendingUp, TrendingDown, ChevronsUp, DollarSign, CircleDollarSign, ArrowUpDown } from "lucide-react";

interface TransactionStats {
  grossExpense: number;
  grossIncome: number;
  grossProfit: number;
  profitPercentage: number;
  matchedCount: number;
  profitPerOrder?: number;
  expensePerOrder?: number;
  totalTransactions?: number;
}

interface TransactionStatsCardProps {
  stats: TransactionStats;
}

export const TransactionStatsCard: React.FC<TransactionStatsCardProps> = ({ stats }) => {
  return (
    <Card className="mb-6">
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Gross Income */}
          <div className="flex flex-col bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Валовый доход</span>
              <Tooltip content="Общая сумма поступлений">
                <InfoIcon className="w-4 h-4 text-gray-400" />
              </Tooltip>
            </div>
            <div className="flex items-center mt-1">
              <DollarSign className="w-5 h-5 text-green-500 mr-1" />
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.grossIncome.toFixed(2)}
              </span>
              <span className="text-sm ml-1 text-gray-500">USDT</span>
            </div>
            <div className="mt-2 flex items-center">
              <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-sm text-green-500">
                {stats.matchedCount} транзакций
              </span>
            </div>
          </div>

          {/* Gross Expense */}
          <div className="flex flex-col bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Валовые расходы</span>
              <Tooltip content="Общая сумма расходов">
                <InfoIcon className="w-4 h-4 text-gray-400" />
              </Tooltip>
            </div>
            <div className="flex items-center mt-1">
              <DollarSign className="w-5 h-5 text-red-500 mr-1" />
              <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                {stats.grossExpense.toFixed(2)}
              </span>
              <span className="text-sm ml-1 text-gray-500">USDT</span>
            </div>
            <div className="mt-2 flex items-center">
              <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
              <span className="text-sm text-red-500">
                {stats.expensePerOrder ? `~ ${stats.expensePerOrder.toFixed(2)} на заказ` : ""}
              </span>
            </div>
          </div>

          {/* Profit */}
          <div className="flex flex-col bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Прибыль</span>
              <Tooltip content="Чистая прибыль (доход минус расходы)">
                <InfoIcon className="w-4 h-4 text-gray-400" />
              </Tooltip>
            </div>
            <div className="flex items-center mt-1">
              <CircleDollarSign className="w-5 h-5 text-blue-500 mr-1" />
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.grossProfit.toFixed(2)}
              </span>
              <span className="text-sm ml-1 text-gray-500">USDT</span>
            </div>
            <div className="mt-2 flex items-center">
              <ArrowUpDown className="w-4 h-4 text-blue-500 mr-1" />
              <span className="text-sm text-blue-500">
                {stats.profitPerOrder ? `~ ${stats.profitPerOrder.toFixed(2)} на заказ` : ""}
              </span>
            </div>
          </div>

          {/* Profit Percentage */}
          <div className="flex flex-col bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Рентабельность</span>
              <Tooltip content="Процент прибыли от расходов">
                <InfoIcon className="w-4 h-4 text-gray-400" />
              </Tooltip>
            </div>
            <div className="flex items-center mt-1">
              <ChevronsUp className="w-5 h-5 text-purple-500 mr-1" />
              <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {stats.profitPercentage.toFixed(2)}%
              </span>
            </div>
            <div className="mt-2 flex items-center">
              <TrendingUp className="w-4 h-4 text-purple-500 mr-1" />
              <span className="text-sm text-purple-500">
                {stats.totalTransactions ? `${stats.totalTransactions} всего транзакций` : `${stats.matchedCount} сопоставлено`}
              </span>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
