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
import { ArrowLeft, Save, Trash, RefreshCw, Plus, Info } from "lucide-react"; // Added Info icon
import Link from "next/link";

// Импортируем компоненты для вкладок пользователя
import { UserTransactionsTab } from "@/components/users/UserTransactionsTab";
import { UserTelegramAccountsTab } from "@/components/users/UserTelegramAccountsTab";
import { UserStatsTab } from "@/components/users/UserStatsTab";
import { UserWorkSessionsTab } from "@/components/users/UserWorkSessionsTab";
import { UserBybitTransactionsTab } from "@/components/users/UserBybitTransactionsTab";

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = Number(params.id);

  // Стейт для редактирования пользователя
  const [userName, setUserName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [selectedTab, setSelectedTab] = useState("info"); // Default to 'info'

  // Получаем данные пользователя
  const { 
    data, 
    isLoading, 
    isError,
    refetch 
  } = api.users.getUserById.useQuery({ userId }, {
    enabled: !!userId && !isNaN(userId),
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Мутация для обновления пользователя
  const updateUser = api.users.updateUser.useMutation({
    onSuccess: () => {
      void refetch();
      // Consider adding a success toast notification here
    },
    onError: (error) => {
      // Consider adding an error toast notification here
      console.error("Failed to update user:", error);
    }
  });

  // Мутация для генерации нового кода доступа
  const regeneratePassCode = api.users.regeneratePassCode.useMutation({
    onSuccess: () => {
      void refetch();
      // Consider adding a success toast notification here
    },
     onError: (error) => {
      // Consider adding an error toast notification here
      console.error("Failed to regenerate passcode:", error);
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
    if (userId && userName.trim()) { // Add basic validation
      updateUser.mutate({
        userId,
        name: userName.trim(),
        isActive
      });
    } else {
      // Handle validation error (e.g., show toast)
      console.warn("User name cannot be empty.");
    }
  };

  const handleRegeneratePassCode = () => {
    if (userId) {
      // Optional: Add a confirmation dialog before regenerating
      regeneratePassCode.mutate({ userId });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]"> {/* Adjusted height */}
        <Spinner size="lg" color="primary" label="Загрузка данных пользователя..." />
      </div>
    );
  }

  if (isError || !data || !data.user) {
    return (
      <div className="p-6 md:p-8"> {/* Increased padding */}
        <div className="flex items-center mb-6">
          <Button asChild variant="light" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
            <Link href="/users">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад к списку
            </Link>
          </Button>
        </div>
        <Card className="mt-6 border border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/10">
           <CardBody className="text-center py-10 text-red-600 dark:text-red-400">
             <Info className="w-10 h-10 mx-auto mb-4 text-red-500" />
             <p className="font-medium">Ошибка при загрузке данных</p>
             <p className="text-sm text-red-500 dark:text-red-400/80 mt-1">
                Не удалось загрузить информацию о пользователе или пользователь не найден.
             </p>
             <Button color="danger" variant="flat" size="sm" className="mt-4" onClick={() => router.push('/users')}>
                Вернуться к списку
             </Button>
           </CardBody>
        </Card>
      </div>
    );
  }

  const user = data.user;

  // Helper function for formatting dates (optional but recommended)
  const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleString('ru-RU', { // Use locale
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

  return (
    <div className="p-6 md:p-8 space-y-6"> {/* Increased padding & added spacing */}
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-3">
           <Button asChild variant="light" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white -ml-2">
            <Link href="/users">
              <ArrowLeft className="w-5 h-5" />
              {/* Назад к списку */}
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
             {user.name || `Пользователь #${user.id}`} {/* Show name if available */}
          </h1>
          <Badge 
            color={user.isActive ? "success" : "danger"} 
            variant="flat" // Use flat for less visual noise here
            size="sm"
          >
            {user.isActive ? "Активен" : "Неактивен"}
          </Badge>
        </div>
         {/* Maybe add action buttons here later if needed */}
      </div>
      
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* User Info Card (Left Column) */}
        <Card className="lg:col-span-1 shadow-sm border border-zinc-200 dark:border-zinc-800">
           <CardHeader>
              <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">Основная информация</h2>
           </CardHeader>
          <CardBody className="pt-0"> {/* Remove CardBody top padding if CardHeader is used */}
            <div className="space-y-5"> {/* Slightly increased spacing */}
                
                {/* Form Fields */}
                <div>
                  <label htmlFor="userId" className="block text-sm font-medium mb-1 text-zinc-600 dark:text-zinc-400">ID пользователя</label>
                  <Input
                    id="userId"
                    value={user.id.toString()}
                    disabled
                    className="bg-zinc-100 dark:bg-zinc-800/50 border-zinc-300 dark:border-zinc-700"
                  />
                </div>
                  
                <div>
                  <label htmlFor="userName" className="block text-sm font-medium mb-1 text-zinc-600 dark:text-zinc-400">Имя пользователя</label>
                  <Input
                    id="userName"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Введите имя"
                    aria-label="Имя пользователя"
                    // Add subtle border on focus etc. (HeroUI might do this)
                  />
                </div>
                  
                <div>
                  <label htmlFor="passCode" className="block text-sm font-medium mb-1 text-zinc-600 dark:text-zinc-400">Код доступа</label>
                  <div className="flex gap-2">
                    <Input
                      id="passCode"
                      value={user.passCode || '••••••••'} // Mask or show placeholder
                      disabled
                      className="bg-zinc-100 dark:bg-zinc-800/50 border-zinc-300 dark:border-zinc-700 font-mono text-sm" // Monospace for codes
                      aria-label="Код доступа (не редактируется)"
                    />
                    <Button
                      variant="bordered" // Use bordered for secondary action
                      color="default"   // Use default color
                      onClick={handleRegeneratePassCode}
                      isLoading={regeneratePassCode.isPending}
                      title="Сгенерировать новый код доступа"
                      aria-label="Сгенерировать новый код доступа"
                      isIconOnly // Make it icon only if space is tight or desired
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                   <p className="text-xs text-zinc-500 mt-1">Этот код используется для доступа через Telegram бота.</p>
                </div>
                  
                <div className="flex items-center justify-between pt-2">
                  <label htmlFor="isActiveStatus" className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Статус аккаунта</label>
                  <div className="flex items-center gap-2">
                     <span className={`text-sm ${isActive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                       {isActive ? "Активен" : "Неактивен"}
                     </span>
                     <Switch 
                        id="isActiveStatus"
                        isSelected={isActive} // Use isSelected for HeroUI Switch
                        onValueChange={setIsActive} // Use onValueChange
                        size="sm"
                        aria-label={`Статус аккаунта: ${isActive ? "Активен" : "Неактивен"}`}
                     />
                  </div>
                </div>
                  
                <div>
                  <label className="block text-sm font-medium mb-1 text-zinc-600 dark:text-zinc-400">Дата регистрации</label>
                  <Input
                    value={formatDate(user.createdAt)}
                    disabled
                    className="bg-zinc-100 dark:bg-zinc-800/50 border-zinc-300 dark:border-zinc-700"
                    aria-label="Дата регистрации (не редактируется)"
                  />
                </div>
             
              {/* Save Button */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
                <Button
                  color="primary"
                  className="w-full"
                  onClick={handleSaveChanges}
                  isLoading={updateUser.isPending}
                  isDisabled={updateUser.isPending || regeneratePassCode.isPending || !userName.trim()} // Disable if saving or name empty
                >
                  <Save className="w-4 h-4 mr-2" />
                  Сохранить изменения
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
        
        {/* Tabs Section (Right Columns) */}
        <div className="lg:col-span-2">
          <Card className="shadow-sm border border-zinc-200 dark:border-zinc-800">
            {/* Use CardHeader for Tabs for better structure */}
            <CardHeader className="border-b border-zinc-200 dark:border-zinc-700">
              <Tabs
                aria-label="Информация о пользователе"
                selectedKey={selectedTab}
                onSelectionChange={(key) => setSelectedTab(key as string)}
                color="primary" // Match primary color
                variant="underlined" // Cleaner look
              >
                <Tab key="info" title="Обзор" />
                <Tab 
                  key="telegram" 
                  title={
                    <div className="flex items-center gap-2">
                      Телеграм
                      <Badge color="primary" variant="flat" size="sm">
                         {user.telegramAccounts?.length ?? 0}
                      </Badge>
                    </div>
                  } 
                />
                <Tab 
                   key="transactions" 
                   title="Транзакции" 
                   // Potentially add count here too if readily available
                />
                  <Tab 
    key="bybit-transactions" 
    title={
      <div className="flex items-center gap-2">
        Bybit транзакции
        {user.bybitTransactions && (
          <Badge color="primary" variant="flat" size="sm">
            {user.bybitTransactions.length}
          </Badge>
        )}
      </div>
    } 
  />
                 <Tab 
                  key="work-sessions" 
                  title={
                    <div className="flex items-center gap-2">
                      Рабочие сессии
                      {user.workSessions && (
                        <Badge color="primary" variant="flat" size="sm">
                          {user.workSessions.length}
                        </Badge>
                      )}
                    </div>
                  }
                />
                <Tab key="stats" title="Статистика" />
              </Tabs>
            </CardHeader>
            <CardBody className="p-4 md:p-6"> {/* Consistent padding */}
            {selectedTab === "work-sessions" && (
  <UserWorkSessionsTab userId={userId} />
)}
              {/* Overview Tab */}
              {selectedTab === "info" && (
                <div className="space-y-6"> {/* Add spacing between sections */}
                  {/* Quick Stats Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoBox label="Телеграм аккаунты" value={user.telegramAccounts?.length ?? 0} />
                    <InfoBox label="Последнее обновление" value={formatDate(user.updatedAt)} />
                    {/* Status is already in the header, maybe remove or show something else */}
                    {/* <InfoBox label="Статус" valueComponent={
                        <Badge color={user.isActive ? "success" : "danger"} variant="flat">
                          {user.isActive ? "Активен" : "Неактивен"}
                        </Badge>
                    }/> */}
                     <InfoBox label="Последнее уведомление" value={formatDate(user.lastNotification)} />
                      <InfoBox label="Всего транзакций" value={user.transactions?.length ?? 0} /> 
                  </div>
                  
                  {/* Recent Transactions List */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                       <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
                         Недавние транзакции
                       </h3>
                        {user.transactions && user.transactions.length > 0 && (
                           <Button asChild variant="light" color="primary" size="sm">
                             <Link href={`/transactions?userId=${user.id}`}>
                               Все транзакции
                             </Link>
                           </Button>
                        )}
                    </div>
                    
                    {user.transactions && user.transactions.length > 0 ? (
                      <div className="space-y-3">
                        {/* Slice to show only a few recent ones */}
                        {user.transactions.slice(0, 5).map((tx) => (
                          <div key={tx.id} className="p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-lg">
                            <div className="flex items-center justify-between gap-4 mb-1">
                              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 capitalize">
                                {tx.type} {tx.asset}
                              </span>
                              <span className={`text-sm font-semibold ${tx.type.toLowerCase() === "buy" ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                                {tx.type.toLowerCase() === "buy" ? "-" : "+"}{tx.amount} {tx.asset}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                              <span>{formatDate(tx.dateTime)}</span>
                               <Badge 
                                 color={tx.status === "completed" ? "success" : tx.status === "pending" ? "warning" : "default"} 
                                 variant="flat" 
                                 size="sm"
                                 className="capitalize"
                               >
                                {tx.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-zinc-500 dark:text-zinc-400 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
                        Нет недавних транзакций.
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Telegram Accounts Tab */}
              {selectedTab === "telegram" && (
                <UserTelegramAccountsTab 
                  userId={userId} 
                  accounts={user.telegramAccounts ?? []} // Ensure accounts is always an array
                  onUpdate={refetch} // Pass refetch directly
                 />
              )}
              {/* Bybit Transactions Tab */}
{selectedTab === "bybit-transactions" && (
  <UserBybitTransactionsTab userId={userId} />
)}
              
              {/* Transactions Tab */}
              {selectedTab === "transactions" && (
                <UserTransactionsTab userId={userId} />
              )}
              
              {/* Stats Tab */}
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


// Helper Component for Overview Info Boxes
interface InfoBoxProps {
  label: string;
  value?: string | number;
  valueComponent?: React.ReactNode; // Allow passing a component (like a Badge)
}

function InfoBox({ label, value, valueComponent }: InfoBoxProps) {
  return (
     <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700/50">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">{label}</p>
      {valueComponent ? (
         <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{valueComponent}</div>
      ) : (
        <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate">
          {value ?? <span className="text-zinc-400 dark:text-zinc-500">N/A</span>}
         </p>
      )}
    </div>
  );
}