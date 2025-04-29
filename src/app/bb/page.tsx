
"use client";

import React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";

import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Spinner } from "@heroui/spinner";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from "@heroui/modal";
import { Input } from "@heroui/input";
import { Tooltip } from "@heroui/tooltip";
import { Pagination } from "@heroui/pagination";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import {
  PlusIcon,
  RefreshCw,
  Edit,
  Trash,
  Settings,
  Eye,
  CheckSquare,
  Square,
} from "lucide-react";
import { toast } from "react-hot-toast";
import dayjs from "dayjs";

// =============================================================
// Page component
// =============================================================
export default function BybitReportsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const limit = 9;
  const [selected, setSelected] = useState<number[]>([]);

  // list of reports --------------------------------------------------------
  const {
    data: listData,
    isLoading: isListLoading,
    error: listError,
    refetch: refetchList,
  } = api.bb.getMatchBybitReports.useQuery({ page, limit, userId: 0 });

  // summary for selected ---------------------------------------------------
  const { data: summary, isLoading: isSummaryLoading } =
    api.bb.getReportsSummary.useQuery(
      { reportIds: selected },
      { enabled: selected.length > 0 }
    );

  // delete ---------------------------------------------------------------
  const deleteReportMutation = api.bb.deleteMatchBybitReport.useMutation({
    onSuccess: () => {
      toast.success("Отчёт удалён");
      refetchList();
      setSelected([]);
    },
    onError: (e) => toast.error(`Ошибка: ${e.message}`),
  });

  // modal with Bybit cabinets ---------------------------------------------
  const { isOpen: modalOpen, onOpen: openModal, onClose: closeModal } =
    useDisclosure();

  // helpers ---------------------------------------------------------------
  const toggleSelected = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const removeReport = (id: number) => {
    if (confirm("Удалить отчёт и связанные данные?"))
      deleteReportMutation.mutate({ id });
  };

  // ----------------------------------------------------------------------
  return (
    <div className="px-4 py-6 mx-auto w-full max-w-7xl">
      <h1 className="text-3xl font-extrabold mb-6">Отчёты сопоставления Bybit</h1>

      {/* toolbar */}
      <div className="flex flex-wrap gap-2 justify-end mb-6">
        <Button
          color="secondary"
          variant="bordered"
          startContent={<Settings size={18} />}
          onPress={openModal}
        >
          Кабинеты Bybit
        </Button>
        <Button
          color="primary"
          startContent={<PlusIcon size={18} />}
          onPress={() => router.push("/bb/report/new")}
        >
          Создать отчёт
        </Button>
        <Button isIconOnly variant="light" onPress={() => refetchList()}>
          <RefreshCw size={18} />
        </Button>
      </div>

      {/* summary banner */}
      {selected.length > 0 && (
        <SummaryBanner
          ids={selected}
          loading={isSummaryLoading}
          data={summary ?? null}
          onClear={() => setSelected([])}
        />
      )}

      {/* reports list */}
      <Card className="border-none shadow-none">
        <CardHeader className="border-b dark:border-zinc-700 pb-4">
          <h2 className="text-xl font-semibold">Список отчётов</h2>
        </CardHeader>
        <CardBody className="p-0">
          {isListLoading && <Spinner label="Загрузка…" className="my-20" />}
          {listError && (
            <p className="text-danger text-center my-10">
              Ошибка: {listError.message}
            </p>
          )}

          {!isListLoading && !listError && listData?.reports && (
            <>
              {listData.reports.length === 0 ? (
                <EmptyState onCreate={() => router.push("/bb/report/new")} />
              ) : (
                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {listData.reports.map((r: any) => (
                    <ReportCard
                      key={r.id}
                      report={r}
                      checked={selected.includes(r.id)}
                      onToggle={() => toggleSelected(r.id)}
                      onDelete={removeReport}
                    />
                  ))}
                </div>
              )}
              {listData.totalPages > 1 && (
                <div className="flex justify-center mt-8">
                  <Pagination
                    total={listData.totalPages}
                    initialPage={page}
                    onChange={setPage}
                    size="lg"
                  />
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>

      {/* Bybit cabinets modal */}
      <BybitCabinetModal isOpen={modalOpen} onClose={closeModal} />
    </div>
  );
}

// =============================================================
// Summary banner
// =============================================================
function SummaryBanner({
  ids,
  loading,
  data,
  onClear,
}: {
  ids: number[];
  loading: boolean;
  data: any | null;
  onClear: () => void;
}) {
  return (
    <div className="mb-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 flex flex-col gap-2">
      <div className="flex items-center gap-2 justify-between flex-wrap">
        <h2 className="text-lg font-semibold">Выбрано отчётов: {ids.length}</h2>
        <Button size="sm" variant="flat" onPress={onClear}>
          Сбросить выбор
        </Button>
      </div>
      {loading && <Spinner size="sm" label="Считаем статистику…" />}
      {data && (
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <StatBox title="Сопоставлений" value={data.totalMatches} color="green" />
          <StatBox
            title="Расход"
            value={`${data.totalExpense.toFixed(2)} USDT`}
            color="amber"
          />
          <StatBox
            title="Доход"
            value={`${data.totalIncome.toFixed(2)} USDT`}
            color="blue"
          />
          <StatBox
            title="Прибыль"
            value={`${data.totalProfit.toFixed(2)} USDT`}
            color="purple"
          />
          <StatBox
            title="Спред"
            value={`${data.profitPercentage.toFixed(1)} %`}
            color="green"
          />
          <StatBox
            title="Unmatched IDEX"
            value={data.unmatchedIdexTransactions}
            color="amber"
          />
          <StatBox
            title="Unmatched Bybit"
            value={data.unmatchedBybitTransactions}
            color="amber"
          />
        </div>
      )}
    </div>
  );
}

// =============================================================
// Report card & helpers
// =============================================================
function ReportCard({
  report,
  checked,
  onToggle,
  onDelete,
}: {
  report: any;
  checked: boolean;
  onToggle: () => void;
  onDelete: (id: number) => void;
}) {
  // extract cabinets
  const safeArr = (v: any) => (Array.isArray(v) ? v : []);
  let idex = safeArr(report.idexCabinets);
  let bybit = safeArr(report.bybitCabinetEmails);
  if ((!idex.length && !bybit.length) && typeof report.idexCabinets === "string") {
    try {
      const cfg = JSON.parse(report.idexCabinets);
      idex = cfg.filter((c: any) => c.cabinetType === "idex");
      bybit = cfg.filter((c: any) => c.cabinetType === "bybit" || !c.cabinetType);
    } catch {}
  }

  return (
    <Card className="flex flex-col h-full hover:shadow-lg transition-shadow dark:bg-zinc-800 dark:border-zinc-700">
      <CardBody className="flex flex-col  grow p-0 divide-y divide-gray-200 dark:divide-zinc-700 relative">
        {/* checkbox */}
        <button
          aria-label="select report"
          onClick={onToggle}
          className="absolute top-4 right-3 text-blue-600 dark:text-blue-400"
        >
          {checked ? <CheckSquare size={20} /> : <Square size={20} />}
        </button>

        <Header report={report} />
        <Main report={report} idex={idex} bybit={bybit} />
        <Footer id={report.id} onDelete={onDelete} />
      </CardBody>
    </Card>
  );
}

const Header = ({ report }: { report: any }) => (
  <div className="p-4 bg-gray-50 dark:bg-zinc-900 flex justify-between items-start gap-2 flex-wrap">
    <div className="flex items-center gap-2 min-w-0">
      <span className="bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300 px-2 py-0.5 rounded text-xs font-mono shrink-0">
        ID: {report.id}
      </span>
      <h3 className="truncate text-lg font-semibold max-w-[14ch] sm:max-w-none">
        {report.name}
      </h3>
    </div>
    <span className="text-sm mr-10 text-gray-500 dark:text-zinc-400 whitespace-nowrap">
      {dayjs(report.createdAt).format("DD.MM.YYYY HH:mm")}
    </span>
  </div>
);

const Main = ({
  report,
  idex,
  bybit,
}: {
  report: any;
  idex: any[];
  bybit: any[];
}) => (
  <div className="p-4 flex flex-col gap-4">
    <UserBlock report={report} />
    <StatsBlock report={report} />
    <CabinetsBlock idex={idex} bybit={bybit} />
  </div>
);

const Footer = ({ id, onDelete }: { id: number; onDelete: (id: number) => void }) => (
  <div className="p-3 bg-gray-50 dark:bg-zinc-900 flex items-center gap-2">
    <Button
      className="flex-grow"
      color="primary"
      startContent={<Eye size={18} />}
      onPress={() => location.assign(`/bb/report/${id}`)}
    >
      Просмотр
    </Button>
    <Button
      isIconOnly
      className="rounded-md"
      variant="flat"
      color="danger"
      onPress={() => onDelete(id)}
    >
      <Trash size={20} />
    </Button>
  </div>
);

function UserBlock({ report }: { report: any }) {
  return (
    <div className="space-y-2">
      <Label>Пользователь</Label>
      <div className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-800 p-2 rounded-md border dark:border-zinc-700">
        <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
          {report.user?.name?.charAt(0) || "U"}
        </div>
        <span className="font-medium truncate">
          {report.user?.name || String(report.notes).split("|")[1]?.replace("Пользователь: ", "") || `ID: ${report.userId}`}
        </span>
      </div>
      <Label>Период отчёта</Label>
      <div className="bg-gray-50 dark:bg-zinc-800 p-2 rounded-md border dark:border-zinc-700 text-sm">
        <p>
          <span className="mr-1">От:</span>
          <span className="font-semibold">
            {dayjs(report.timeRangeStart).subtract(3, 'hour').format("DD.MM.YYYY HH:mm")}
          </span>
        </p>
        <p className="mt-1">
          <span className="mr-1">До:</span>
          <span className="font-semibold">
            {dayjs(report.timeRangeEnd).subtract(3, 'hour').format("DD.MM.YYYY HH:mm")}
          </span>
        </p>
      </div>
      {report.notes && (
        <>
          <Label>Комментарий</Label>
          <p className="bg-gray-50 dark:bg-zinc-800 p-2 rounded-md border dark:border-zinc-700 whitespace-pre-wrap text-sm">
            {report.notes}
          </p>
        </>
      )}
    </div>
  );
}

function StatsBlock({ report }: { report: any }) {
  return (
    <div className="space-y-2">
      <Label>Статистика</Label>
      <div className="grid grid-cols-2 gap-2">
        <StatBox title="Сопоставлений" value={report.totalMatches ?? 0} color="green" />
        <StatBox title="Прибыль" value={`${report.totalProfit?.toFixed(2) ?? 0} USDT`} color="blue" />
        <StatBox title="Успешных" value={`${report.successRate?.toFixed(1) ?? 0}%`} color="purple" />
        <StatBox title="Ср. прибыль" value={`${report.averageProfit?.toFixed(2) ?? 0} USDT`} color="amber" />
      </div>
    </div>
  );
}

function CabinetsBlock({
  idex,
  bybit,
}: {
  idex: any[];
  bybit: any[];
}) {
  return (
    <div className="space-y-2">
      <CabinetSection
        title="IDEX кабинеты"
        list={idex.map((c) => ({
          label: c.idexId ?? c.id,
          start: c.startDate ?? c.start,
          end: c.endDate ?? c.end,
        }))}
        badge="blue"
      />
      <CabinetSection
        title="Bybit кабинеты"
        list={bybit.map((c) => ({
          label: c.email ?? c.id,
          start: c.startDate ?? c.start,
          end: c.endDate ?? c.end,
        }))}
        badge="yellow"
      />
    </div>
  );
}

// =============================================================
// Small reusable UI bits
// =============================================================
const Label = ({ children }: { children: React.ReactNode }) => (
  <span className="block text-sm font-medium text-gray-500 dark:text-zinc-400">
    {children}:
  </span>
);

function StatBox({
  title,
  value,
  color,
}: {
  title: string;
  value: string | number;
  color: "green" | "blue" | "purple" | "amber";
}) {
  const map: Record<string, string> = {
    green:
      "bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/50 text-green-600 dark:text-green-400",
    blue:
      "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/50 text-blue-600 dark:text-blue-400",
    purple:
      "bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800/50 text-purple-600 dark:text-purple-400",
    amber:
      "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/50 text-amber-600 dark:text-amber-400",
  };
  return (
    <div className={`p-2 rounded-md border text-center flex flex-col ${map[color]}`}>      
      <span className="text-xs whitespace-nowrap">{title}</span>
      <span className="text-lg font-bold mt-0.5 truncate">{value}</span>
    </div>
  );
}

function CabinetSection({
  title,
  list,
  badge,
}: {
  title: string;
  list: { label: string; start: string; end: string }[];
  badge: "blue" | "yellow";
}) {
  const cls =
    badge === "blue"
      ? "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300"
      : "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300";
  return (
    <div>
      <Label>{title}</Label>
      <div className="mt-1 flex flex-wrap gap-1">
        {list.length ? (
          list.map((c, i) => (
            <Tooltip
              key={i}
              content={`Период: ${dayjs(c.start).format("DD.MM.YYYY HH:mm")} - ${dayjs(c.end).format("DD.MM.YYYY HH:mm")}`}
            >
              <span className={`${cls} text-xs px-2 py-1 rounded-full`}>{c.label}</span>
            </Tooltip>
          ))
        ) : (
          <span className="text-sm text-gray-500 dark:text-zinc-400">Нет кабинетов</span>
        )}
      </div>
    </div>
  );
}

// =============================================================
// Empty state
// =============================================================
const EmptyState = ({ onCreate }: { onCreate: () => void }) => (
  <div className="flex flex-col items-center gap-4 py-20 bg-gray-50 dark:bg-zinc-800 rounded-lg">
    <p className="text-lg">Отчёты ещё не созданы.</p>
    <Button
      color="primary"
      size="lg"
      startContent={<PlusIcon size={20} />}
      onPress={onCreate}
    >
      Создать первый отчёт
    </Button>
  </div>
);

// =============================================================
// BybitCabinetModal (unchanged from your original file)
// =============================================================
const BybitCabinetModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const utils = api.useUtils();
  const userId = undefined; // TODO: текущий пользователь

  const { data: cabinets, isLoading } = api.bb.getBybitCabinets.useQuery(
    { userId: 0 },
    { enabled: isOpen }
  );

  const createMutation = api.bb.createBybitCabinet.useMutation({
    onSuccess: () => {
      toast.success("Кабинет Bybit добавлен!");
      utils.bb.getBybitCabinets.invalidate();
      setIsAdding(false);
      resetForm();
    },
    onError: (e) => toast.error(`Ошибка: ${e.message}`),
  });
  const updateMutation = api.bb.updateBybitCabinet.useMutation({
    onSuccess: () => {
      toast.success("Кабинет Bybit обновлён!");
      utils.bb.getBybitCabinets.invalidate();
      setEditing(null);
      resetForm();
    },
    onError: (e) => toast.error(`Ошибка: ${e.message}`),
  });
  const deleteMutation = api.bb.deleteBybitCabinet.useMutation({
    onSuccess: () => {
      toast.success("Кабинет Bybit удалён!");
      utils.bb.getBybitCabinets.invalidate();
    },
    onError: (e) => toast.error(`Ошибка: ${e.message}`),
  });

  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ bybitEmail: "", apiKey: "", apiSecret: "" });
  const resetForm = () => setForm({ bybitEmail: "", apiKey: "", apiSecret: "" });

  // reset modal state when closed
  React.useEffect(() => {
    if (!isOpen) {
      setIsAdding(false);
      setEditing(null);
      resetForm();
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (editing) {
      setForm({
        bybitEmail: editing.bybitEmail ?? "",
        apiKey: editing.bybitApiToken ?? "",
        apiSecret: editing.bybitApiSecret ?? "",
      });
    }
  }, [editing]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const save = () => {
    const currentUserId = 0; // TODO
    const { bybitEmail, apiKey, apiSecret } = form;
    if (!bybitEmail || !apiKey || !apiSecret)
      return toast.error("Заполните все поля.");
    if (editing) {
      updateMutation.mutate({ id: editing.id, userId: currentUserId, ...form });
    } else {
      createMutation.mutate({ userId: currentUserId, ...form });
    }
  };

  const remove = (id: number) => {
    const currentUserId = 0; // TODO
    if (confirm("Удалить кабинет?")) deleteMutation.mutate({ id, userId: currentUserId });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalContent className="max-h-[90dvh] overflow-y-auto">
        <ModalHeader>
          {editing
            ? "Редактировать кабинет"
            : isAdding
            ? "Добавить кабинет"
            : "Кабинеты Bybit"}
        </ModalHeader>
        <ModalBody className="space-y-4">
          {isLoading && <Spinner label="Загрузка кабинетов…" />}
          {!isLoading && !isAdding && !editing && (
            <>
              <Button
                color="primary"
                className="mb-4"
                startContent={<PlusIcon size={18} />}
                onPress={() => setIsAdding(true)}
              >
                Добавить кабинет
              </Button>
              {cabinets?.length ? (
                <Table aria-label="Кабинеты">
                  <TableHeader>
                    <TableColumn>Email</TableColumn>
                    <TableColumn>API Key</TableColumn>
                    <TableColumn>Добавлен</TableColumn>
                    <TableColumn>Действия</TableColumn>
                  </TableHeader>
                  <TableBody items={cabinets}>
                    {(item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="truncate max-w-[14ch]">
                          {item.bybitEmail}
                        </TableCell>
                        <TableCell>
                          {item.bybitApiToken?.slice(0, 5)}…
                        </TableCell>
                        <TableCell>
                          {dayjs(item.createdAt).format("YYYY-MM-DD HH:mm")}
                        </TableCell>
                        <TableCell className="flex gap-1">
                          <Tooltip content="Редактировать">
                            <Button
                              isIconOnly
                              variant="light"
                              size="sm"
                              onPress={() => setEditing(item)}
                            >
                              <Edit size={16} />
                            </Button>
                          </Tooltip>
                          <Tooltip content="Удалить">
                            <Button
                              isIconOnly
                              variant="light"
                              color="danger"
                              size="sm"
                              onPress={() => remove(item.id)}
                            >
                              <Trash size={16} />
                            </Button>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-sm text-gray-500 dark:text-zinc-400">
                  Кабинеты не найдены.
                </p>
              )}
            </>
          )}
          {(isAdding || editing) && (
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Bybit Email"
                name="bybitEmail"
                value={form.bybitEmail}
                onChange={onChange}
                isRequired
              />
              <Input
                label="API Key"
                name="apiKey"
                type="password"
                value={form.apiKey}
                onChange={onChange}
                isRequired
              />
              <Input
                label="API Secret"
                name="apiSecret"
                type="password"
                value={form.apiSecret}
                onChange={onChange}
                isRequired
              />
            </div>
          )}
        </ModalBody>
        <ModalFooter className="flex gap-2 justify-end flex-wrap">
          {isAdding || editing ? (
            <>
              <Button
                variant="light"
                onPress={() => {
                  setIsAdding(false);
                  setEditing(null);
                  resetForm();
                }}
              >
                Отмена
              </Button>
              <Button
                color="primary"
                isLoading={createMutation.isLoading || updateMutation.isLoading}
                onPress={save}
              >
                {editing ? "Сохранить" : "Добавить"}
              </Button>
            </>
          ) : (
            <Button variant="light" onPress={onClose}>
              Закрыть
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
