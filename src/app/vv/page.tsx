"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { toast } from "react-hot-toast";
import dayjs from "dayjs";

/******************** ViresCabinetModal ***************************/
const ViresCabinetModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const utils = api.useUtils();
  const userId = undefined; // TODO: текущий пользователь

  const { data: cabinets, isLoading } = api.vires.getAll.useQuery(
    undefined,
    { enabled: isOpen },
  );

  const createMutation = api.vires.create.useMutation({
    onSuccess: () => {
      toast.success("Кабинет Vires добавлен!");
      utils.vires.getAll.invalidate();
      setIsAdding(false);
      resetForm();
    },
    onError: (e) => toast.error(`Ошибка: ${e.message}`),
  });
  const updateMutation = api.vires.update.useMutation({
    onSuccess: () => {
      toast.success("Кабинет Vires обновлён!");
      utils.vires.getAll.invalidate();
      setEditing(null);
      resetForm();
    },
    onError: (e) => toast.error(`Ошибка: ${e.message}`),
  });
  const deleteMutation = api.vires.delete.useMutation({
    onSuccess: () => {
      toast.success("Кабинет Vires удалён!");
      utils.vires.getAll.invalidate();
    },
    onError: (e) => toast.error(`Ошибка: ${e.message}`),
  });

  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", login: "", password: "", comment: "" });
  const resetForm = () => setForm({ name: "", login: "", password: "", comment: "" });

  // Запрос на получение всех пользователей для выпадающего списка
  const { data: users } = api.users.getUsers.useQuery();
  const [selectedUserId, setSelectedUserId] = useState<number>(1);

  useEffect(() => {
    if (!isOpen) {
      setIsAdding(false);
      setEditing(null);
      resetForm();
    }
  }, [isOpen]);
  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name ?? "",
        login: editing.login ?? "",
        password: editing.password ?? "",
        comment: editing.comment ?? "",
      });
      if (editing.userId) {
        setSelectedUserId(editing.userId);
      }
    }
  }, [editing]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const save = () => {
    const { name, login, password, comment } = form;
    if (!login || !password) return toast.error("Заполните обязательные поля.");
    if (editing) {
      updateMutation.mutate({ id: editing.id, userId: selectedUserId, ...form });
    } else {
      createMutation.mutate({ userId: selectedUserId, ...form });
    }
  };
  const remove = (id: number) => {
    if (confirm("Удалить кабинет?")) deleteMutation.mutate({ id });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalContent className="max-h-[90dvh] overflow-y-auto">
        <ModalHeader>{editing ? "Редактировать кабинет" : isAdding ? "Добавить кабинет" : "Кабинеты Vires"}</ModalHeader>
        <ModalBody className="space-y-4">
          {isLoading && <Spinner label="Загрузка кабинетов…" />}
          {!isLoading && !isAdding && !editing && (
            <>
              <Button color="primary" className="mb-4" startContent={<PlusIcon size={18} />} onPress={() => setIsAdding(true)}>Добавить кабинет</Button>
              {cabinets?.length ? (
                <Table aria-label="Кабинеты">
                  <TableHeader>
                    <TableColumn>Название</TableColumn>
                    <TableColumn>Логин</TableColumn>
                    <TableColumn>Пользователь</TableColumn>
                    <TableColumn>Добавлен</TableColumn>
                    <TableColumn>Действия</TableColumn>
                  </TableHeader>
                  <TableBody items={cabinets}>
                    {(item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="truncate max-w-[14ch]">{item.name ?? item.login}</TableCell>
                        <TableCell>{item.login}</TableCell>
                        <TableCell>{item.User?.name || `ID: ${item.userId}`}</TableCell>
                        <TableCell>{dayjs(item.createdAt).format("YYYY-MM-DD HH:mm")}</TableCell>
                        <TableCell className="flex gap-1">
                          <Tooltip content="Редактировать"><Button isIconOnly variant="light" size="sm" onPress={() => setEditing(item)}><Edit size={16} /></Button></Tooltip>
                          <Tooltip content="Удалить"><Button isIconOnly variant="light" color="danger" size="sm" onPress={() => remove(item.id)}><Trash size={16} /></Button></Tooltip>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              ) : <p className="text-center text-sm text-gray-500 dark:text-zinc-400">Кабинеты не найдены.</p>}
            </>
          )}
          {(isAdding || editing) && (
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Название" name="name" value={form.name} onChange={onChange} placeholder="Опционально" />
              <Input label="Логин" name="login" value={form.login} onChange={onChange} isRequired />
              <Input label="Пароль" name="password" type="password" value={form.password} onChange={onChange} isRequired />
              <Input label="Комментарий" name="comment" value={form.comment} onChange={onChange} placeholder="Опционально" />
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                  Владелец кабинета
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(Number(e.target.value))}
                  className="block w-full rounded-md border-gray-300 dark:border-zinc-700 dark:bg-zinc-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  {users?.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || `ID: ${user.id}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter className="flex gap-2 justify-end flex-wrap">
          {(isAdding || editing) ? (
            <>
              <Button variant="light" onPress={() => { setIsAdding(false); setEditing(null); resetForm(); }}>Отмена</Button>
              <Button color="primary" isLoading={createMutation.isPending || updateMutation.isPending} onPress={save}>{editing ? "Сохранить" : "Добавить"}</Button>
            </>
          ) : <Button variant="light" onPress={onClose}>Закрыть</Button>}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

/******************** ViresReportsPage ***************************/
export default function ViresReportsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const limit = 9;

  const { data, isLoading, error, refetch } = api.vv.getMatchViresReports.useQuery(
    { page, limit },
    { enabled: true },
  );

  const deleteReportMutation = api.vv.deleteMatchViresReport.useMutation({
    onSuccess: () => { toast.success("Отчёт удалён"); refetch(); },
    onError: (e) => toast.error(`Ошибка: ${e.message}`),
  });

  const { isOpen: modalOpen, onOpen: openModal, onClose: closeModal } = useDisclosure();

  const removeReport = (id: number) => {
    if (confirm("Удалить отчёт и связанные данные?")) deleteReportMutation.mutate({ id });
  };

  return (
    <div className="px-4 py-6 mx-auto w-full max-w-7xl">
      <h1 className="text-3xl font-extrabold mb-6">Отчёты сопоставления Vires</h1>
      {/* toolbar */}
      <div className="flex flex-wrap gap-2 justify-end mb-6">
        <Button color="secondary" variant="bordered" startContent={<Settings size={18} />} onPress={openModal}>Кабинеты Vires</Button>
        <Button color="primary" startContent={<PlusIcon size={18} />} onPress={() => router.push("/vv/report/new")}>Создать отчёт</Button>
        <Button isIconOnly variant="light" onPress={() => refetch()}><RefreshCw size={18} /></Button>
      </div>

      <Card className="border-none shadow-none">
        <CardHeader className="border-b dark:border-zinc-700 pb-4"><h2 className="text-xl font-semibold">Список отчётов</h2></CardHeader>
        <CardBody className="p-0">
          {isLoading && <Spinner label="Загрузка…" className="my-20" />}
          {error && <p className="text-danger text-center my-10">Ошибка: {error.message}</p>}

          {!isLoading && !error && data?.reports && (
            <>
              {data.reports.length === 0 ? (
                <EmptyState onCreate={() => router.push("/vv/report/new")}/>
              ) : (
                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {data.reports.map((r: any) => <ReportCard key={r.id} report={r} onDelete={removeReport} />)}
                </div>
              )}
              {data.totalPages > 1 && (
                <div className="flex justify-center mt-8"><Pagination total={data.totalPages} initialPage={page} onChange={setPage} size="lg" /></div>
              )}
            </>
          )}
        </CardBody>
      </Card>

      <ViresCabinetModal isOpen={modalOpen} onClose={closeModal} />
    </div>
  );
}

/******************** Helper components ***************************/
const EmptyState = ({ onCreate }: { onCreate: () => void }) => (
  <div className="flex flex-col items-center gap-4 py-20 bg-gray-50 dark:bg-zinc-800 rounded-lg">
    <p className="text-lg">Отчёты ещё не созданы.</p>
    <Button color="primary" size="lg" startContent={<PlusIcon size={20} />} onPress={onCreate}>Создать первый отчёт</Button>
  </div>
);

function ReportCard({ report, onDelete }: { report: any; onDelete: (id: number) => void }) {
  /* extract cabinets */
  const safeArr = (v: any) => (Array.isArray(v) ? v : []);
  let vires = safeArr(report.viresCabinets);
  let bybit = safeArr(report.bybitCabinets);

  if ((!vires.length && !bybit.length) && typeof report.idexCabinets === "string") {
    try {
      const cfg = JSON.parse(report.idexCabinets);
      bybit = cfg.filter((c: any) => c.cabinetType === "bybit");
      vires = cfg.filter((c: any) => c.cabinetType === "vires" || !c.cabinetType);
    } catch {}
  }

  return (
    <Card className="flex flex-col h-full hover:shadow-lg transition-shadow dark:bg-zinc-800 dark:border-zinc-700">
      <CardBody className="flex flex-col grow p-0 divide-y divide-gray-200 dark:divide-zinc-700">
        <Header report={report} />
        <Main report={report} vires={vires} bybit={bybit} />
        <Footer id={report.id} onDelete={onDelete} />
      </CardBody>
    </Card>
  );
}

const Header = ({ report }: { report: any }) => (
  <div className="p-4 bg-gray-50 dark:bg-zinc-900 flex justify-between items-start gap-2 flex-wrap">
    <div className="flex items-center gap-2 min-w-0">
      <span className="bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300 px-2 py-0.5 rounded text-xs font-mono shrink-0">ID: {report.id}</span>
      <h3 className="truncate text-lg font-semibold max-w-[14ch] sm:max-w-none">{report.notes || `Отчет #${report.id}`}</h3>
    </div>
    <span className="text-sm text-gray-500 dark:text-zinc-400 whitespace-nowrap">{dayjs(report.createdAt).format("DD.MM.YYYY HH:mm")}</span>
  </div>
);

const Main = ({ report, vires, bybit }: { report: any; vires: any[]; bybit: any[] }) => (
  <div className="p-4 flex flex-col gap-4">
    <UserBlock report={report} />
    <StatsBlock report={report} />
    <CabinetsBlock vires={vires} bybit={bybit} />
  </div>
);

const Footer = ({ id, onDelete }: { id: number; onDelete: (id: number) => void }) => (
  <div className="p-3 bg-gray-50 dark:bg-zinc-900 flex items-center gap-2">
    <Button className="flex-grow" color="primary" startContent={<Eye size={18} />} onPress={() => location.assign(`/vv/report/${id}`)}>Просмотр</Button>
    <Button isIconOnly className="rounded-md" variant="flat" color="danger" onPress={() => onDelete(id)}><Trash size={20} /></Button>
  </div>
);

function UserBlock({ report }: { report: any }) {
  return (
    <div className="space-y-2">
      <Label>Пользователь</Label>
      <div className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-800 p-2 rounded-md border dark:border-zinc-700">
        <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
          {report.User?.name?.charAt(0) || "U"}
        </div>
        <span className="font-medium truncate">{report.User?.name || String(report.notes).split("|")[1]?.replace("Пользователь: ", "") || `ID: ${report.userId}`}</span>
      </div>
      <Label>Период отчёта</Label>
      <div className="bg-gray-50 dark:bg-zinc-800 p-2 rounded-md border dark:border-zinc-700 text-sm">
        <p><span className="mr-1">От:</span><span className="font-semibold">{dayjs(report.timeRangeStart).format("DD.MM.YYYY HH:mm")}</span></p>
        <p className="mt-1"><span className="mr-1">До:</span><span className="font-semibold">{dayjs(report.timeRangeEnd).format("DD.MM.YYYY HH:mm")}</span></p>
      </div>
      {report.notes && (
        <>
          <Label>Комментарий</Label>
          <p className="bg-gray-50 dark:bg-zinc-800 p-2 rounded-md border dark:border-zinc-700 whitespace-pre-wrap text-sm">{report.notes}</p>
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

function CabinetsBlock({ vires, bybit }: { vires: any[]; bybit: any[] }) {
  return (
    <div className="space-y-2">
      <CabinetSection title="Vires кабинеты" list={vires.map((c) => ({ label: c.name ?? c.login ?? c.id, start: c.startDate ?? c.start, end: c.endDate ?? c.end }))} badge="orange" />
      <CabinetSection title="Bybit кабинеты" list={bybit.map((c) => ({ label: c.bybitEmail ?? c.id, start: c.startDate ?? c.start, end: c.endDate ?? c.end }))} badge="yellow" />
    </div>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => <span className="block text-sm font-medium text-gray-500 dark:text-zinc-400">{children}:</span>;

function StatBox({ title, value, color }: { title: string; value: string | number; color: "green" | "blue" | "purple" | "amber" }) {
  const map: Record<string, string> = {
    green: "bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/50 text-green-600 dark:text-green-400",
    blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/50 text-blue-600 dark:text-blue-400",
    purple: "bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800/50 text-purple-600 dark:text-purple-400",
    amber: "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/50 text-amber-600 dark:text-amber-400",
  };
  return (
    <div className={`p-2 rounded-md border text-center flex flex-col ${map[color]}`}>      
      <span className="text-xs">{title}</span>
      <span className="text-lg font-bold mt-0.5">{value}</span>
    </div>
  );
}

function CabinetSection({ title, list, badge }: { title: string; list: { label: string; start: string; end: string }[]; badge: "blue" | "yellow" | "orange" }) {
  const cls = badge === 'blue' 
    ? "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300" 
    : badge === 'yellow' 
    ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300" 
    : "bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300";
  return (
    <div>
      <Label>{title}</Label>
      <div className="mt-1 flex flex-wrap gap-1">
        {list.length ? list.map((c, i) => (
          <Tooltip key={i} content={`Период: ${dayjs(c.start).format("DD.MM.YYYY HH:mm")} - ${dayjs(c.end).format("DD.MM.YYYY HH:mm")}`}>
            <span className={`${cls} text-xs px-2 py-1 rounded-full`}>{c.label}</span>
          </Tooltip>
        )) : <span className="text-sm text-gray-500 dark:text-zinc-400">Нет кабинетов</span>}
      </div>
    </div>
  );
}
