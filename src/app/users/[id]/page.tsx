"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Tabs, Tab } from "@heroui/tabs";
import { Badge } from "@heroui/badge";
import { Switch } from "@heroui/switch";
import { Spinner } from "@heroui/spinner";
import { ArrowLeft, Save, Trash, RefreshCw, Plus } from "lucide-react";
import Link from "next/link";

// Импортируем компоненты для вкладок пользователя
import { UserTransactionsTab } from "@/components/users/UserTransactionsTab";
import { UserTelegramAccountsTab } from "@/components/users/UserTelegramAccountsTab";
import { UserStatsTab } from "@/components/users/UserStatsTab";

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = Number(params.id);
  
  // Стейт для редактирования пользователя
  const [userName, setUserName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [selectedTab, setSelectedTab] = useState("info");
  
  // Получаем данные пользователя
  const { 
    data, 
    isLoading, 
    isError,
    refetch
  } = api.users.getUserById.useQuery({ userId }, {
    enabled: !!userId && !isNaN(userId),
    refetchOnWindowFocus: false
  });
  
  // Мутация для обновления пользователя
  const updateUser = api.users.updateUser.useMutation({
    onSuccess: () => {
      void refetch();
    }
  });
  
  // Загружаем данные пользователя в форму при их получении
  useEffect(() => {
    if (data?.user) {
      setUserName(data.user.name);
      setIsActive(data.user.isActive);
    }
  }, [data]);
  
  // Обработчик сохранения изменений
  const handleSaveChanges = () => {
    if (userId) {
      updateUser.mutate({
        userId,
        name: userName,
        isActive
      });
    }
  };
  
  // Обработчик генерации нового кода доступа
  const regeneratePassCode = api.users.regeneratePassCode.useMutation({
    onSuccess: () => {
      void refetch();
    }
  });
  
  const handleRegeneratePassCode = () => {
    if (userId) {
      regeneratePassCode.mutate({ userId });
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }
  
  if (isError || !data || !data.user) {
    return (
      <div className="p-6">
        <div className="flex items-center mb-6">
          <Link href="/users">
            <Button variant="bordered">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад к списку
            </Button>
          </Link>
        </div>
        <div className="text-center py-10 text-red-500">
          Ошибка при загрузке данных пользователя или пользователь не найден
        </div>
      </div>
    );
  }
  
  const user = data.user;
  
  return (
    <div className="p-6">
      <div className="flex items-center mb-6">
        <Link href="/users">
          <Button variant="bordered">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад к списку
          </Button>
        </Link>
        <h1 className="text-2xl font-bold ml-4">
          Пользователь #{user.id}
        </h1>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Информация о пользователе */}
        <Card className="lg:col-span-1">
          <CardBody>
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">Основная информация</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">ID пользователя</label>
                    <Input
                      value={user.id.toString()}
                      disabled
                      className="bg-gray-50 dark:bg-gray-700"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Имя пользователя</label>
                    <Input
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="Введите имя пользователя"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Код доступа</label>
                    <div className="flex gap-2">
                      <Input
                        value={user.passCode}
                        disabled
                        className="bg-gray-50 dark:bg-gray-700"
                      />
                      <Button
                        variant="flat"
                        color="primary"
                        onClick={handleRegeneratePassCode}
                        isLoading={regeneratePassCode.isPending}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Статус аккаунта</label>
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={isActive}
                        onChange={setIsActive}
                      />
                      <span>{isActive ? "Активен" : "Неактивен"}</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Дата регистрации</label>
                    <Input
                      value={new Date(user.createdAt).toLocaleString()}
                      disabled
                      className="bg-gray-50 dark:bg-gray-700"
                    />
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <Button
                  color="primary"
                  className="w-full"
                  onClick={handleSaveChanges}
                  isLoading={updateUser.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Сохранить изменения
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
        
        {/* Вкладки с дополнительной информацией */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <Tabs
                selectedKey={selectedTab}
                onSelectionChange={(key) => setSelectedTab(key as string)}
              >
                <Tab key="info" title="Обзор" />
                <Tab key="telegram" title="Телеграм аккаунты" />
                <Tab key="transactions" title="Транзакции" />
                <Tab key="stats" title="Статистика" />
              </Tabs>
            </CardHeader>
            <CardBody>
              {selectedTab === "info" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Телеграм аккаунты</p>
                      <p className="text-2xl font-semibold">{user.telegramAccounts.length}</p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Последнее обновление</p>
                      <p className="text-2xl font-semibold">{new Date(user.updatedAt).toLocaleDateString()}</p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Статус</p>
                      <Badge 
                        color={user.isActive ? "success" : "danger"} 
                        variant={user.isActive ? "solid" : "flat"}
                      >
                        {user.isActive ? "Активен" : "Неактивен"}
                      </Badge>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Последнее уведомление</p>
                      <p className="text-lg">
                        {user.lastNotification 
                          ? new Date(user.lastNotification).toLocaleString() 
                          : "Нет данных"}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-2">Последние транзакции</h3>
                    {user.transactions && user.transactions.length > 0 ? (
                      <div className="space-y-2">
                        {user.transactions.map((transaction) => (
                          <div key={transaction.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="flex justify-between">
                              <span>{transaction.type} {transaction.asset}</span>
                              <span className={transaction.type.toLowerCase() === "buy" ? "text-red-500" : "text-green-500"}>
                                {transaction.type.toLowerCase() === "buy" ? "-" : "+"}{transaction.amount} {transaction.asset}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-500">
                              <span>{new Date(transaction.dateTime).toLocaleString()}</span>
                              <Badge color={transaction.status === "completed" ? "success" : "warning"}>
                                {transaction.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        Нет транзакций для отображения
                      </div>
                    )}
                    <div className="mt-2 text-right">
                      <Link href={`/transactions?userId=${user.id}`}>
                        <Button variant="flat" color="primary" size="sm">
                          Все транзакции
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              )}
              
              {selectedTab === "telegram" && (
                <UserTelegramAccountsTab userId={userId} accounts={user.telegramAccounts} onUpdate={() => refetch()} />
              )}
              
              {selectedTab === "transactions" && (
                <UserTransactionsTab userId={userId} />
              )}
              
              {selectedTab === "stats" && (
                <UserStatsTab userId={userId} />
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
