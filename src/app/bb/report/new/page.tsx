"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Spinner } from "@heroui/spinner";
import { ArrowLeft, Plus, Trash } from "lucide-react";
import { toast } from "react-hot-toast";
import dayjs from "dayjs";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

type CabinetConfig = {
  cabinetId: number;
  startDate: string;
  endDate: string;
  cabinetType: "idex" | "bybit";
};

/* -------------------------------------------------------------------------- */
/*                               COMPONENT                                    */
/* -------------------------------------------------------------------------- */

export default function NewReportPage() {
  const router = useRouter();
  const utils = api.useUtils();

  /* --------------------------------- STATE -------------------------------- */

  // Основные поля отчёта
  const [reportName, setReportName] = useState("");
  const [timeRangeStart, setTimeRangeStart] = useState("");
  const [timeRangeEnd, setTimeRangeEnd] = useState("");
  const [reportDate, setReportDate] = useState(
    dayjs().format("YYYY-MM-DDTHH:mm"),
  );
  const [notes, setNotes] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number>(1);

  // Конфигурации кабинетов
  const [activeTab, setActiveTab] = useState<"bybit" | "idex">("bybit");
  const [cabinetConfigs, setCabinetConfigs] = useState<CabinetConfig[]>([]);

  // Кэшим удалённые автоматически-подгруженные Bybit-кабинеты,
  // чтобы эффект автодобавления их больше не возвращал
  const [ignoredAutoBybitIds, setIgnoredAutoBybitIds] = useState<number[]>([]);

  /* ------------------------------ API QUERIES ----------------------------- */

  const { data: users, isLoading: isLoadingUsers } =
    api.users.getUsers.useQuery();

  const { data: bybitCabinets, isLoading: isLoadingBybitCabinets } =
    api.bb.getBybitCabinets.useQuery(undefined, { enabled: true });

  const { data: userBybitChains } =
    api.users.getBybitCabinetChainedWithUser.useQuery(
      { userId: selectedUserId },
      { enabled: !!selectedUserId },
    );

  const { data: idexCabinetsData, isLoading: isLoadingIdexCabinets } =
    api.idex.getAllCabinets.useQuery(
      { page: 1, perPage: 100 },
      { enabled: true },
    );
  const idexCabinets = idexCabinetsData?.cabinets ?? [];

  /* ----------------------------- MUTATIONS -------------------------------- */

  const autoMatchMutation = api.bb.matchTransactionsAutomatically.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Автоматическое сопоставление выполнено: найдено ${
          result.stats?.newMatches || 0
        } совпадений`,
      );
      router.push("/bb");
    },
    onError: (error) => {
      toast.error(`Ошибка при автоматическом сопоставлении: ${error.message}`);
      router.push("/bb");
    },
  });

  const createReportMutation = api.bb.createMatchBybitReport.useMutation({
    onSuccess: (data) => {
      toast.success("Отчёт успешно сохранён.");
      autoMatchMutation.mutate({
        reportId: data.id,
        userId: selectedUserId,
      });
    },
    onError: (error) => {
      toast.error(`Ошибка при создании отчёта: ${error.message}`);
    },
  });

  /* -------------------------------------------------------------------------- */
  /*                                 HANDLERS                                   */
  /* -------------------------------------------------------------------------- */

  const handleAddCabinet = (
    cabinetId: number,
    cabinetType: "idex" | "bybit",
  ) => {
    const alreadyAdded = cabinetConfigs.some(
      (c) => c.cabinetId === cabinetId && c.cabinetType === cabinetType,
    );
    if (alreadyAdded) {
      toast.error(
        `Этот ${cabinetType === "idex" ? "IDEX" : "Bybit"} кабинет уже добавлен`,
      );
      return;
    }

    const nowStart = timeRangeStart || dayjs().format("YYYY-MM-DDTHH:mm");
    const nowEnd =
      timeRangeEnd || dayjs().add(1, "day").format("YYYY-MM-DDTHH:mm");

    setCabinetConfigs((prev) => [
      ...prev,
      {
        cabinetId,
        cabinetType,
        startDate: nowStart,
        endDate: nowEnd,
      },
    ]);
  };

  const handleRemoveCabinet = (
    cabinetId: number,
    cabinetType: "idex" | "bybit",
  ) => {
    setCabinetConfigs((prev) =>
      prev.filter(
        (c) => !(c.cabinetId === cabinetId && c.cabinetType === cabinetType),
      ),
    );
    // если это авто-подгруженный Bybit-кабинет — запоминаем, что пользователь его убрал
    if (cabinetType === "bybit") {
      setIgnoredAutoBybitIds((prev) => [...prev, cabinetId]);
    }
  };

  const handleCabinetDateChange = (
    cabinetId: number,
    cabinetType: "idex" | "bybit",
    field: "startDate" | "endDate",
    value: string,
  ) => {
    setCabinetConfigs((prev) =>
      prev.map((c) =>
        c.cabinetId === cabinetId && c.cabinetType === cabinetType
          ? { ...c, [field]: value }
          : c,
      ),
    );
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    /* ----------- валидации оставлены без изменений ----------- */

    if (!reportName) {
      toast.error("Пожалуйста, введите название отчёта");
      return;
    }
    if (!timeRangeStart) {
      toast.error("Пожалуйста, укажите начальную дату периода поиска");
      return;
    }
    if (!timeRangeEnd) {
      toast.error("Пожалуйста, укажите конечную дату периода поиска");
      return;
    }
    if (!reportDate) {
      toast.error("Пожалуйста, укажите дату формирования отчёта");
      return;
    }
    if (!selectedUserId) {
      toast.error("Пожалуйста, выберите пользователя");
      return;
    }
    if (cabinetConfigs.length === 0) {
      toast.error("Пожалуйста, добавьте хотя бы один кабинет");
      return;
    }

    const processedConfigs = cabinetConfigs.map(
      ({ cabinetId, startDate, endDate, cabinetType }) => ({
        cabinetId,
        startDate,
        endDate,
        cabinetType,
      }),
    );

    const selectedUser = users?.find((u) => u.id === selectedUserId);
    const userInfo = selectedUser
      ? selectedUser.name ||
        (selectedUser.passCode && `Паскод: ${selectedUser.passCode}`) ||
        `ID: ${selectedUser.id}`
      : `Пользователь ID: ${selectedUserId}`;

    const notesWithUser = notes
      ? `${notes} | Пользователь: ${userInfo}`
      : `Отчёт: ${reportName} | Пользователь: ${userInfo}`;

    createReportMutation.mutate({
      name: reportName,
      timeRangeStart,
      timeRangeEnd,
      reportDate,
      notes: notesWithUser,
      cabinetConfigs: processedConfigs,
      userId: selectedUserId,
    });
  };

  /* -------------------------------------------------------------------------- */
  /*                                   EFFECTS                                  */
  /* -------------------------------------------------------------------------- */

  // 1️⃣  При изменении глобальных дат → обновляем все конфиги
  useEffect(() => {
    setCabinetConfigs((prev) =>
      prev.map((c) => ({
        ...c,
        startDate: timeRangeStart || c.startDate,
        endDate: timeRangeEnd || c.endDate,
      })),
    );
  }, [timeRangeStart, timeRangeEnd]);

  // 2️⃣  Смена пользователя → убираем любые Bybit-кабинеты (они были для старого пользователя)
  useEffect(() => {
    setCabinetConfigs((prev) => prev.filter((c) => c.cabinetType !== "bybit"));
    setIgnoredAutoBybitIds([]); // начинаем заново — для нового пользователя
  }, [selectedUserId]);

  // 3️⃣  Автодобавление цепочек “user ↔ Bybit cabinet”, исключая вручную удалённые
  useEffect(() => {
    if (!userBybitChains?.length || !bybitCabinets?.length) return;

    const defaults = {
      startDate: timeRangeStart || dayjs().format("YYYY-MM-DDTHH:mm"),
      endDate: timeRangeEnd || dayjs().add(1, "day").format("YYYY-MM-DDTHH:mm"),
    };

    const newConfigs: CabinetConfig[] = [];

    userBybitChains.forEach((ch) => {
      if (ignoredAutoBybitIds.includes(ch.bybitCabinetId)) return; // пользователь убрал — не возвращаем
      const already = cabinetConfigs.some(
        (c) => c.cabinetId === ch.bybitCabinetId && c.cabinetType === "bybit",
      );
      if (!already) {
        newConfigs.push({
          cabinetId: ch.bybitCabinetId,
          cabinetType: "bybit",
          ...defaults,
        });
      }
    });

    if (newConfigs.length) {
      setCabinetConfigs((prev) => [...prev, ...newConfigs]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userBybitChains, ignoredAutoBybitIds]);

  /* -------------------------------------------------------------------------- */
  /*                                   RENDER                                   */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="container mx-auto p-4">
      <Button
        type="button"
        variant="light"
        onClick={() => router.push("/bb")}
        startContent={<ArrowLeft size={18} />}
        className="mb-4 dark:text-zinc-300"
      >
        Назад к списку отчётов
      </Button>

      <h1 className="mb-6 text-2xl font-bold dark:text-zinc-100">
        Создание отчёта сопоставления
      </h1>

      <Card className="mx-auto max-w-4xl dark:border-zinc-700 dark:bg-zinc-800">
        <CardBody>
          <div className="mb-4 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200">
            При сохранении отчёта будет автоматически выполнен мэтчинг Bybit и
            IDEX транзакций за указанный период.
          </div>

          {/* ------------------------------------------------------------------ */}
          {/*                               ФОРМА                                */}
          {/* ------------------------------------------------------------------ */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* --------------------------- ОБЩИЕ ПАРАМЕТРЫ -------------------------- */}
            <div className="mb-6 rounded-lg border bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
              <h2 className="mb-4 text-xl font-semibold dark:text-zinc-200">
                Общие параметры отчёта
              </h2>

              <div className="mb-4">
                <Input
                  label="Название отчёта"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder="Введите название отчёта"
                  className="dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div className="mb-4">
                <Select
                  label="Пользователь"
                  placeholder="Выберите пользователя"
                  value={selectedUserId.toString()}
                  onChange={(e) => setSelectedUserId(Number(e.target.value))}
                  className="dark:border-zinc-700 dark:bg-zinc-900"
                  isLoading={isLoadingUsers}
                  isRequired
                >
                  {users?.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name ||
                        (user.passCode && `Паскод: ${user.passCode}`) ||
                        `Пользователь ID: ${user.id}`}
                      {user.isActive === false ? " (Неактивен)" : ""}
                    </SelectItem>
                  ))}
                  {!users?.length && (
                    <SelectItem key="1" value="1">
                      Пользователь ID: 1
                    </SelectItem>
                  )}
                </Select>

                {selectedUserId && users && (
                  <div className="mt-2 rounded bg-blue-50 p-2 text-sm dark:bg-blue-900/20">
                    <span className="font-medium">
                      Выбранный пользователь:{" "}
                    </span>
                    {(() => {
                      const u = users.find((x) => x.id === selectedUserId);
                      return u
                        ? u.name ||
                            (u.passCode && `Паскод: ${u.passCode}`) ||
                            `ID: ${u.id}`
                        : `ID: ${selectedUserId}`;
                    })()}
                  </div>
                )}
              </div>

              <div className="mb-4">
                <Input
                  label="Примечания к отчёту"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Дополнительная информация (необязательно)"
                  className="dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div className="mb-6 grid grid-cols-1 gap-6 dark:text-zinc-300 md:grid-cols-3">
                <div>
                  <label htmlFor="timeRangeStart">Начало периода поиска</label>
                  <Input
                    type="datetime-local"
                    id="timeRangeStart"
                    value={timeRangeStart}
                    onChange={(e) => setTimeRangeStart(e.target.value)}
                    className="dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
                <div>
                  <label htmlFor="timeRangeEnd">Конец периода поиска</label>
                  <Input
                    type="datetime-local"
                    id="timeRangeEnd"
                    value={timeRangeEnd}
                    onChange={(e) => setTimeRangeEnd(e.target.value)}
                    className="dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
                <div>
                  <label htmlFor="reportDate">Дата формирования отчёта</label>
                  <Input
                    type="datetime-local"
                    id="reportDate"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
              </div>
            </div>

            {/* --------------------------- КАБИНЕТЫ --------------------------- */}
            <div className="mb-6 rounded-lg border bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
              <h3 className="mb-2 text-lg font-semibold dark:text-zinc-200">
                Кабинеты для сопоставления
              </h3>

              {/* --- переключатель Bybit / IDEX --- */}
              <div className="mb-4 border-b dark:border-zinc-700">
                <button
                  type="button"
                  className={`px-4 py-2 ${
                    activeTab === "bybit"
                      ? "border-b-2 border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                      : "text-gray-600 dark:text-zinc-400"
                  }`}
                  onClick={() => setActiveTab("bybit")}
                >
                  Bybit
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 ${
                    activeTab === "idex"
                      ? "border-b-2 border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                      : "text-gray-600 dark:text-zinc-400"
                  }`}
                  onClick={() => setActiveTab("idex")}
                >
                  IDEX
                </button>
              </div>

              {/* ----------- Содержимое вкладки Bybit ----------- */}
              {activeTab === "bybit" && (
                <div className="mt-4">
                  {!isLoadingBybitCabinets && bybitCabinets?.length ? (
                    <div className="rounded-md border p-2 dark:border-zinc-700">
                      <div className="mb-6 grid grid-cols-1 gap-6 dark:text-zinc-300 md:grid-cols-2">
                        {bybitCabinets.map((cab) => (
                          <div
                            key={cab.id}
                            className="flex items-center justify-between rounded border p-2 hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-700"
                          >
                            <div>
                              <div className="font-medium dark:text-zinc-300">
                                {cab.bybitEmail}
                              </div>
                              <span className="text-sm text-gray-500 dark:text-zinc-400">
                                ID: {cab.id}
                              </span>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              color="primary"
                              variant="light"
                              onClick={() => handleAddCabinet(cab.id, "bybit")}
                              startContent={<Plus size={16} />}
                            >
                              Добавить
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : isLoadingBybitCabinets ? (
                    <div className="p-4 text-center">
                      <Spinner />
                    </div>
                  ) : (
                    <p className="rounded-md border p-4 text-center text-sm text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
                      Нет доступных Bybit кабинетов.
                    </p>
                  )}
                </div>
              )}

              {/* ----------- Содержимое вкладки IDEX ----------- */}
              {activeTab === "idex" && (
                <div className="mt-4">
                  {!isLoadingIdexCabinets && idexCabinets.length ? (
                    <div className="rounded-md border p-2 dark:border-zinc-700">
                      <div className="mb-6 grid grid-cols-1 gap-6 dark:text-zinc-300 md:grid-cols-2">
                        {idexCabinets.map((cab) => (
                          <div
                            key={cab.id}
                            className="flex items-center justify-between rounded border p-2 hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-700"
                          >
                            <div>
                              <div className="font-medium dark:text-zinc-300">
                                Login: {cab.login}{" "}
                                <span className="font-bold text-blue-600 dark:text-blue-400">
                                  [ID: {cab.idexId || "не указан"}]
                                </span>
                              </div>
                              <span className="text-sm text-gray-500 dark:text-zinc-400">
                                Name: {cab.name}
                              </span>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              color="primary"
                              variant="light"
                              onClick={() => handleAddCabinet(cab.id, "idex")}
                              startContent={<Plus size={16} />}
                            >
                              Добавить
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : isLoadingIdexCabinets ? (
                    <div className="p-4 text-center">
                      <Spinner />
                    </div>
                  ) : (
                    <p className="rounded-md border p-4 text-center text-sm text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
                      Нет доступных IDEX кабинетов.
                    </p>
                  )}
                </div>
              )}

              {/* ------------------ Выбранные кабинеты ------------------ */}
              <div className="mb-6 dark:text-zinc-300">
                <h4 className="text-md mb-2 font-medium">
                  Выбранные кабинеты ({cabinetConfigs.length})
                </h4>

                {cabinetConfigs.length === 0 ? (
                  <p className="rounded-md border p-4 text-center text-sm text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
                    Не выбрано ни одного кабинета
                  </p>
                ) : (
                  <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* ------------ BYBIT ------------- */}
                    <CabinetList
                      title="Bybit кабинеты"
                      typeFilter="bybit"
                      cabinetConfigs={cabinetConfigs}
                      bybitCabinets={bybitCabinets}
                      idexCabinets={idexCabinets}
                      onDateChange={handleCabinetDateChange}
                      onRemove={handleRemoveCabinet}
                    />
                    {/* ------------ IDEX -------------- */}
                    <CabinetList
                      title="IDEX кабинеты"
                      typeFilter="idex"
                      cabinetConfigs={cabinetConfigs}
                      bybitCabinets={bybitCabinets}
                      idexCabinets={idexCabinets}
                      onDateChange={handleCabinetDateChange}
                      onRemove={handleRemoveCabinet}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ------------------------ SUBMIT BUTTON ------------------------- */}
            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                color="primary"
                isLoading={createReportMutation.isLoading}
                isDisabled={
                  isLoadingBybitCabinets ||
                  isLoadingIdexCabinets ||
                  createReportMutation.isLoading ||
                  cabinetConfigs.length === 0
                }
                title="При сохранении отчёта будет выполнен автомэтчинг транзакций"
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

/* -------------------------------------------------------------------------- */
/*                         ВСПОМОГАТЕЛЬНЫЙ КОМПОНЕНТ                           */
/* -------------------------------------------------------------------------- */

type CabinetListProps = {
  title: string;
  typeFilter: "idex" | "bybit";
  cabinetConfigs: CabinetConfig[];
  bybitCabinets: any[] | undefined;
  idexCabinets: any[];
  onDateChange: (
    id: number,
    type: "idex" | "bybit",
    field: "startDate" | "endDate",
    value: string,
  ) => void;
  onRemove: (id: number, type: "idex" | "bybit") => void;
};

const CabinetList: React.FC<CabinetListProps> = ({
  title,
  typeFilter,
  cabinetConfigs,
  bybitCabinets,
  idexCabinets,
  onDateChange,
  onRemove,
}) => {
  const filtered = cabinetConfigs.filter((c) => c.cabinetType === typeFilter);

  return (
    <div>
      <h5 className="mb-2 text-sm font-medium dark:text-zinc-300">{title}</h5>
      <div className="h-80 overflow-y-auto rounded-md border p-2 dark:border-zinc-700 dark:bg-zinc-900">
        {filtered.length === 0 ? (
          <p className="p-2 text-center text-sm text-gray-500 dark:text-zinc-400">
            Не выбрано ни одного&nbsp;
            {typeFilter === "bybit" ? "Bybit" : "IDEX"} кабинета
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((config, index) => {
              const info =
                typeFilter === "bybit"
                  ? bybitCabinets?.find((c) => c.id === config.cabinetId)
                  : idexCabinets.find((c) => c.id === config.cabinetId);

              const label =
                typeFilter === "bybit"
                  ? info?.bybitEmail || `Bybit ID: ${config.cabinetId}`
                  : info?.name || `IDEX ID: ${info?.idexId}`;

              return (
                <div
                  key={`${typeFilter}-${config.cabinetId}-${index}`}
                  className="rounded-md border p-3 hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">{label}</span>
                      <span
                        className={`ml-2 rounded-full px-2 py-1 text-xs ${
                          typeFilter === "bybit"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                            : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        }`}
                      >
                        {typeFilter.toUpperCase()}
                      </span>
                    </div>
                    <Button
                      type="button"
                      color="danger"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        onRemove(config.cabinetId, config.cabinetType)
                      }
                    >
                      <Trash size={16} />
                    </Button>
                  </div>

                  <div className="mt-2 grid grid-cols-1 gap-2">
                    <Input
                      type="datetime-local"
                      label="Начало периода"
                      value={config.startDate}
                      onChange={(e) =>
                        onDateChange(
                          config.cabinetId,
                          config.cabinetType,
                          "startDate",
                          e.target.value,
                        )
                      }
                      size="sm"
                      className="text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    />
                    <Input
                      type="datetime-local"
                      label="Конец периода"
                      value={config.endDate}
                      onChange={(e) =>
                        onDateChange(
                          config.cabinetId,
                          config.cabinetType,
                          "endDate",
                          e.target.value,
                        )
                      }
                      size="sm"
                      className="text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
