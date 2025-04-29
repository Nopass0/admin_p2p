"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Save, RefreshCw, Plus, Loader2,
} from "lucide-react";

/* ── trpc ─────────────────────────────────────── */
import { api } from "@/trpc/react";

/* ── HeroUI ───────────────────────────────────── */
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Tabs, Tab } from "@heroui/tabs";
import { Badge } from "@heroui/badge";
import { Switch } from "@heroui/switch";
import { Spinner } from "@heroui/spinner";
import { Select, SelectItem } from "@heroui/select";

/* ── вкладки ───────────────────────────────────── */
import { UserTransactionsTab }     from "@/components/users/UserTransactionsTab";
import { UserTelegramAccountsTab } from "@/components/users/UserTelegramAccountsTab";
import { UserStatsTab }            from "@/components/users/UserStatsTab";
import { UserWorkSessionsTab }     from "@/components/users/UserWorkSessionsTab";
import { UserBybitTransactionsTab }from "@/components/users/UserBybitTransactionsTab";

/* ═════════════════════════════════════════════════════════════════════ */

export default function UserDetailPage() {
  const params  = useParams();
  const router  = useRouter();
  const userId  = Number(params.id);

  /* ── local state ─────────────────────────────── */
  const [userName, setUserName]         = useState("");
  const [isActive, setIsActive]         = useState(true);
  const [selectedTab, setSelectedTab]   = useState("info");

  /* селект Bybit-кабинета */
  const [cabinetId, setCabinetId]       = useState<number | null>(null);
  const [attachSuccess, setAttachSuccess] = useState(false);

  /* ── queries ─────────────────────────────────── */
  const { data, isLoading, isError, refetch } =
    api.users.getUserById.useQuery({ userId }, {
      enabled: !!userId && !isNaN(userId),
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    });

  const {
    data: cabinets,
    isLoading: cabinetsLoading,
    isError:  cabinetsError,
  } = api.users.getAllBybitCabinets.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  /* ── mutations ───────────────────────────────── */
  const updateUser = api.users.updateUser.useMutation({
    onSuccess: () => void refetch(),
  });

  const regeneratePassCode = api.users.regeneratePassCode.useMutation({
    onSuccess: () => void refetch(),
  });

  const attachCabinet = api.users.updateOrCreateChainWithBybitCabinet.useMutation({
    onSuccess: () => {
      setAttachSuccess(true);
      void refetch();
      setTimeout(() => setAttachSuccess(false), 3000);
    },
  });

  /* ── preload form ────────────────────────────── */
  useEffect(() => {
    if (data?.user) {
      setUserName(data.user.name);
      setIsActive(data.user.isActive);
    }
  }, [data]);


  /* ➜ новый эффект */
  useEffect(() => {
    if (
      !cabinetId &&                             // ещё не выбран
    data?.user?.BybitCabinetChainedWithUser?.length &&   // есть связки
    cabinets?.length                          // список кабинетов получен
  ) {
    const first = data.user.BybitCabinetChainedWithUser[0].bybitCabinetId;
    setCabinetId(first);
  }
}, [cabinetId, data?.user?.BybitCabinetChainedWithUser, cabinets]);

  /* ── helpers ─────────────────────────────────── */
  const fmt = (d: any) => d ? new Date(d).toLocaleString("ru-RU") : "N/A";

  const handleSave = () => {
    if (!userName.trim()) return;
    updateUser.mutate({ userId, name: userName.trim(), isActive });
  };

  const handleAttach = () =>
    cabinetId && attachCabinet.mutate({ userId, bybitCabinetId: cabinetId });

  /* ── pre-UI states ───────────────────────────── */
  if (isLoading)
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Spinner size="lg" color="primary" label="Загрузка данных пользователя…" />
      </div>
    );

  if (isError || !data?.user)
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 mb-4">Ошибка загрузки пользователя</p>
        <Button asChild color="danger" variant="flat">
          <Link href="/users">Вернуться к списку</Link>
        </Button>
      </div>
    );

  const user = data.user;

  /* ─────────────────────────────────────────────── */
  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-700">
        <Button
          asChild
          variant="light"
          className="-ml-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
        >
          <Link href="/users"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold">{user.name || `Пользователь #${user.id}`}</h1>
        <Badge color={user.isActive ? "success" : "danger"} variant="flat" size="sm">
          {user.isActive ? "Активен" : "Неактивен"}
        </Badge>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN */}
        <Card className="lg:col-span-1 border">
          <CardHeader><h2 className="font-semibold">Основная информация</h2></CardHeader>
          <CardBody className="space-y-5">
            {/* id */}
            <div>
              <label className="form-label">ID пользователя</label>
              <Input value={user.id.toString()} disabled />
            </div>

            {/* name */}
            <div>
              <label className="form-label">Имя пользователя</label>
              <Input value={userName} onChange={e => setUserName(e.target.value)} />
            </div>

            {/* passcode */}
            <div>
              <label className="form-label">Код доступа</label>
              <div className="flex gap-2">
                <Input value={user.passCode} disabled className="font-mono" />
                <Button
                  variant="bordered"
                  isIconOnly
                  onClick={() => regeneratePassCode.mutate({ userId })}
                  isLoading={regeneratePassCode.isPending}
                  title="Сгенерировать новый код"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* status */}
            <div className="flex justify-between items-center">
              <span className="form-label">Статус аккаунта</span>
              <Switch isSelected={isActive} onValueChange={setIsActive} />
            </div>

            {/* createdAt */}
            <div>
              <label className="form-label">Дата регистрации</label>
              <Input value={fmt(user.createdAt)} disabled />
            </div>

            {/* ───── BYBIT CABINET SELECT ───── */}

            <div className="space-y-2 pt-2 border-t border-dashed border-zinc-300 dark:border-zinc-700">
              <label className="form-label">Привязать Bybit кабинет</label>

              {cabinetsLoading && (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              )}

              {(!cabinetsLoading && cabinetsError) && (
                <p className="text-red-500 text-sm">Не удалось загрузить кабинеты</p>
              )}

              {!cabinetsLoading && cabinets && (
                <>
                  {/* 1️⃣ Select с правильным API */}
                  <Select
                    placeholder="Выберите кабинет"
                    // HeroUI требует Set<string>
                    selectedKeys={cabinetId ? new Set([cabinetId.toString()]) : new Set()}
                    // keys: Selection  → берём первый
                    onSelectionChange={(keys) => {
                      const first = [...keys][0] as string | undefined;
                      setCabinetId(first ? Number(first) : null);
                    }}
                    className="w-full"
                  >
                    {cabinets.map((c) => (
                      <SelectItem key={c.id}>{c.bybitEmail}</SelectItem>
                    ))}
                  </Select>

                  {/* 2️⃣ Кнопка «Привязать» теперь активируется */}
                  <Button
                    color="primary"
                    className="w-full"
                    onClick={handleAttach}
                    isDisabled={!cabinetId || attachCabinet.isPending}
                    isLoading={attachCabinet.isPending}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Привязать кабинет
                  </Button>

                  {attachSuccess && (
                    <Badge color="success" variant="flat" className="w-full justify-center">
                      Кабинет успешно привязан
                    </Badge>
                  )}
                </>
              )}
            </div>


            {/* save */}
            <Button
              color="primary"
              className="w-full"
              onClick={handleSave}
              isLoading={updateUser.isPending}
              isDisabled={!userName.trim() || updateUser.isPending}
            >
              <Save className="w-4 h-4 mr-2" /> Сохранить изменения
            </Button>
          </CardBody>
        </Card>

        {/* RIGHT COLUMN – TABS */}
        <div className="lg:col-span-2">
          <Card className="border">
            <CardHeader className="border-b">
              <Tabs
                selectedKey={selectedTab}
                onSelectionChange={key => setSelectedTab(key as string)}
                variant="underlined"
              >
                <Tab key="info"              title="Обзор" />
                <Tab key="telegram"           title={<WithCount text="Телеграм"  count={user.telegramAccounts?.length} />} />
                <Tab key="transactions"       title="Транзакции" />
                <Tab key="bybit-transactions" title="Bybit транзакции" />
                <Tab key="work-sessions"      title="Рабочие сессии" />
                <Tab key="stats"              title="Статистика" />
              </Tabs>
            </CardHeader>

            <CardBody className="p-4 md:p-6">
              {selectedTab === "info"              && <OverviewTab user={user} />}
              {selectedTab === "telegram"           && (
                <UserTelegramAccountsTab userId={userId} accounts={user.telegramAccounts ?? []} onUpdate={refetch} />
              )}
              {selectedTab === "transactions"       && <UserTransactionsTab     userId={userId} />}
              {selectedTab === "bybit-transactions" && <UserBybitTransactionsTab userId={userId} />}
              {selectedTab === "work-sessions"      && <UserWorkSessionsTab     userId={userId} />}
              {selectedTab === "stats"              && <UserStatsTab            userId={userId} />}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ── helpers UI ─────────────────────────────────── */

const WithCount = ({ text, count = 0 }: { text: string; count?: number }) => (
  <div className="flex items-center gap-2">
    {text}
    <Badge color="primary" variant="flat" size="sm">{count}</Badge>
  </div>
);

interface OverviewProps { user: any }
const OverviewTab = ({ user }: OverviewProps) => {
  const fmt = (d: any) => d ? new Date(d).toLocaleString("ru-RU") : "N/A";
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <InfoBox label="Телеграм аккаунты" value={user.telegramAccounts?.length ?? 0} />
        <InfoBox label="Последнее обновление" value={fmt(user.updatedAt)} />
        <InfoBox label="Последнее уведомление" value={fmt(user.lastNotification)} />
        <InfoBox label="Всего транзакций" value={user.transactions?.length ?? 0} />
      </div>
    </div>
  );
};

interface InfoBoxProps {
  label: string;
  value?: string | number;
  valueComponent?: React.ReactNode;
}
const InfoBox = ({ label, value, valueComponent }: InfoBoxProps) => (
  <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border">
    <p className="text-xs text-zinc-500 mb-1 uppercase">{label}</p>
    {valueComponent ? (
      <div className="text-lg font-semibold">{valueComponent}</div>
    ) : (
      <p className="text-lg font-semibold truncate">{value ?? "N/A"}</p>
    )}
  </div>
);
