"use client";

import React, { useState, useRef, useCallback, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Alert } from "@heroui/alert";
import {
  PlusCircle,
  Edit,
  Trash2,
  MoveUp,
  MoveDown,
  Save,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Layers,
} from "lucide-react";
import Link from "next/link";

/* -------------------------------------------------------------------------- */
/*                              helper utils                                  */
/* -------------------------------------------------------------------------- */

function getColumnTypeLabel(type: string) {
  switch (type) {
    case "TEXT":
      return "Текст";
    case "NUMBER":
      return "Число";
    case "DATE":
      return "Дата";
    case "DATETIME":
      return "Дата и время";
    case "BOOLEAN":
      return "Да/Нет";
    case "SELECT":
      return "Выбор из списка";
    case "BUTTON":
      return "Кнопка";
    case "CALCULATED":
      return "Вычисляемое";
    case "CURRENCY":
      return "Валюта";
    case "LINK":
      return "Ссылка";
    case "COMMENT":
      return "Комментарий";
    default:
      return type;
  }
}

/* -------------------------------------------------------------------------- */
/*                  Type‑specific settings block for a column                 */
/* -------------------------------------------------------------------------- */

interface ColumnTypeOptionsProps {
  column: any;
  setColumn: React.Dispatch<React.SetStateAction<any>>;
}

function ColumnTypeOptions({ column, setColumn }: ColumnTypeOptionsProps) {
  const currentType = column.type;

  const handleChange =
    (field: string) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      const value =
        e.target.type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : e.target.value;
      setColumn((prev: any) => ({
        ...prev,
        [field]: value,
        options: { ...prev.options, [field]: value },
      }));
    };

  if (currentType === "SELECT") {
    return (
      <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
        <h3 className="mb-3 font-medium dark:text-zinc-200">
          Настройка вариантов выбора
        </h3>
        <textarea
          value={(column.options?.values || []).join("\n")}
          onChange={(e) => {
            const values = e.target.value.split("\n").filter((v) => v.trim());
            setColumn((prev: any) => ({
              ...prev,
              options: { ...prev.options, values },
            }));
          }}
          rows={4}
          className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
        />
        <label className="mt-3 flex items-center text-sm dark:text-zinc-300">
          <input
            type="checkbox"
            checked={!!column.options?.allowMultiple}
            onChange={handleChange("allowMultiple")}
            className="mr-2 h-4 w-4 accent-blue-600 dark:accent-blue-500"
          />
          Разрешить множественный выбор
        </label>
      </div>
    );
  }

  if (currentType === "CALCULATED") {
    return (
      <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
        <h3 className="mb-3 font-medium dark:text-zinc-200">
          Настройка формулы
        </h3>
        <textarea
          value={column.options?.formula || ""}
          onChange={handleChange("formula")}
          rows={3}
          placeholder="[columnA] * [columnB]"
          className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
        />
      </div>
    );
  }

  if (currentType === "CURRENCY") {
    return (
      <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
        <h3 className="mb-3 font-medium dark:text-zinc-200">
          Настройка валюты
        </h3>
        <label className="mb-2 block text-sm font-medium dark:text-zinc-300">
          Валюта
        </label>
        <select
          value={column.options?.currency || "RUB"}
          onChange={handleChange("currency")}
          className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
        >
          {[
            ["RUB", "Российский рубль (₽)"],
            ["USD", "Доллар США ($)"],
            ["EUR", "Евро (€)"],
            ["USDT", "USDT"],
          ].map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (currentType === "NUMBER") {
    return (
      <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
        <h3 className="mb-3 font-medium dark:text-zinc-200">Настройка числа</h3>
        <label className="mb-2 block text-sm font-medium dark:text-zinc-300">
          Точность
        </label>
        <select
          value={column.options?.precision || "2"}
          onChange={handleChange("precision")}
          className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
        >
          {[0, 1, 2, 3, 4].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
    );
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*                             Generic modal shell                             */
/* -------------------------------------------------------------------------- */

const useInitialFocus = <T extends HTMLElement>() => {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
};

interface AddEditColumnModalProps {
  column: any;
  setColumn: React.Dispatch<React.SetStateAction<any>>;
  isSaving: boolean;
  onSave: () => void;
  onClose: () => void;
  title: string;
}

function AddEditColumnModal({
  column,
  setColumn,
  isSaving,
  onSave,
  onClose,
  title,
}: AddEditColumnModalProps) {
  const nameRef = useInitialFocus<HTMLInputElement>();

  const handleField =
    (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value =
        e.target.type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : e.target.value;
      setColumn((prev: any) => ({ ...prev, [field]: value }));
    };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg dark:bg-zinc-800 dark:text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-xl font-bold">{title}</h2>
        {/* --------- название --------- */}
        <label className="mb-2 block text-sm font-medium dark:text-zinc-300">
          Название <span className="text-red-500">*</span>
        </label>
        <input
          ref={nameRef}
          type="text"
          value={column.name}
          onChange={handleField("name")}
          className="mb-4 w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
        />
        {/* --------- тип --------- */}
        <label className="mb-2 block text-sm font-medium dark:text-zinc-300">
          Тип данных
        </label>
        <select
          value={column.type}
          onChange={handleField("type")}
          className="mb-4 w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
        >
          {[
            "TEXT",
            "NUMBER",
            "DATE",
            "DATETIME",
            "BOOLEAN",
            "SELECT",
            "CALCULATED",
            "CURRENCY",
            "LINK",
            "COMMENT",
          ].map((t) => (
            <option key={t} value={t}>
              {getColumnTypeLabel(t)}
            </option>
          ))}
        </select>
        {/* --------- ширина / default --------- */}
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium dark:text-zinc-300">
              Ширина (px)
            </label>
            <input
              type="number"
              min={50}
              value={column.width || ""}
              onChange={handleField("width")}
              className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium dark:text-zinc-300">
              Значение по умолчанию
            </label>
            <input
              type="text"
              value={column.defaultValue || ""}
              onChange={handleField("defaultValue")}
              className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
            />
          </div>
        </div>
        {/* --------- чекбоксы --------- */}
        <div className="mb-4 grid grid-cols-3 gap-2 text-sm dark:text-zinc-300">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={column.isRequired}
              onChange={handleField("isRequired")}
              className="mr-2 h-4 w-4 accent-blue-600 dark:accent-blue-500"
            />
            Обязательное
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={column.isFilterable}
              onChange={handleField("isFilterable")}
              className="mr-2 h-4 w-4 accent-blue-600 dark:accent-blue-500"
            />
            Фильтрация
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={column.isSummable}
              onChange={handleField("isSummable")}
              disabled={
                !["NUMBER", "CURRENCY", "CALCULATED"].includes(column.type)
              }
              className="mr-2 h-4 w-4 accent-blue-600 dark:accent-blue-500"
            />
            Итоги
          </label>
        </div>
        {/* --------- type‑specific settings --------- */}
        <ColumnTypeOptions column={column} setColumn={setColumn} />
        {/* --------- footer --------- */}
        <div className="mt-6 flex justify-end space-x-2">
          <Button
            onPress={onClose}
            variant="outline"
            className="dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Отмена
          </Button>
          <Button
            onPress={onSave}
            disabled={!column.name || isSaving}
            className="dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            {isSaving ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ConfirmDeleteModalProps {
  name: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

function ConfirmDeleteColumnModal({
  name,
  isDeleting,
  onConfirm,
  onClose,
}: ConfirmDeleteModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-zinc-800 dark:text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-xl font-bold text-red-600 dark:text-red-400">
          Удаление колонки
        </h2>
        <p className="mb-4 dark:text-zinc-300">
          Вы уверены, что хотите удалить колонку "{name}"? Это действие
          необратимо.
        </p>
        <div className="flex justify-end space-x-2">
          <Button
            onPress={onClose}
            variant="outline"
            className="dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Отмена
          </Button>
          <Button
            onPress={onConfirm}
            variant="destructive"
            disabled={isDeleting}
            className="dark:bg-red-700 dark:hover:bg-red-600"
          >
            {isDeleting ? "Удаление..." : "Удалить"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Main page                                    */
/* -------------------------------------------------------------------------- */

export default function TableConstructorPage({
  params,
}: {
  params: { id: string };
}) {
  /* -------------------------- unwrap params -------------------------- */
  const resolvedParams = use(params);
  const tableId = resolvedParams?.id ? parseInt(resolvedParams.id, 10) : null;
  const router = useRouter();

  /* -------------------------- local state --------------------------- */
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [editingTable, setEditingTable] = useState(false);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [showEditColumn, setShowEditColumn] = useState(false);
  const [showDeleteColumn, setShowDeleteColumn] = useState(false);

  const [editedTable, setEditedTable] = useState<any>({
    name: "",
    description: "",
    isSearchable: true,
    hasPagination: true,
    pageSize: 10,
  });

  const [newColumn, setNewColumn] = useState<any>({
    name: "",
    type: "TEXT",
    width: null,
    isRequired: false,
    isFilterable: false,
    isSummable: false,
    defaultValue: "",
    format: "",
    options: null,
  });
  const [columnToEdit, setColumnToEdit] = useState<any | null>(null);
  const [columnToDelete, setColumnToDelete] = useState<any | null>(null);

  /* -------------------------- queries ------------------------------ */
  const { data: sectionsData } = api.tables.getAllSections.useQuery();
  const sections = sectionsData?.success ? sectionsData.sections : [];

  const {
    data: tableData,
    refetch: refetchTable,
    isLoading: isLoadingTable,
  } = api.tables.getTableById.useQuery(
    { tableId },
    {
      enabled: !!tableId,
      onSuccess: (d) => {
        if (d?.success) {
          setEditedTable({
            name: d.table.name,
            description: d.table.description || "",
            sectionId: d.table.sectionId,
            isSearchable: d.table.isSearchable,
            hasPagination: d.table.hasPagination,
            pageSize: d.table.pageSize,
          });
        } else setError(d?.message || "Не удалось загрузить таблицу");
      },
      onError: (e) => setError(e.message || "Ошибка запроса"),
    },
  );

  const table = tableData?.success ? tableData.table : null;

  /* -------------------------- mutations ---------------------------- */
  const updateTableMutation = api.tables.updateTable.useMutation({
    onSuccess: (d) => {
      if (d.success) {
        setSuccessMessage("Таблица обновлена");
        setEditingTable(false);
        refetchTable();
        setTimeout(() => setSuccessMessage(""), 3000);
      } else setError(d.message || "Не удалось обновить таблицу");
    },
    onError: (e) => setError(e.message || "Ошибка обновления таблицы"),
  });

  const createColumnMutation = api.tables.createColumn.useMutation({
    onSuccess: (d) => {
      if (d.success) {
        setSuccessMessage("Колонка создана");
        setShowAddColumn(false);
        setNewColumn({
          name: "",
          type: "TEXT",
          width: null,
          isRequired: false,
          isFilterable: false,
          isSummable: false,
          defaultValue: "",
          format: "",
          options: null,
        });
        refetchTable();
        if (d.warning) setError(d.warning);
        setTimeout(() => setSuccessMessage(""), 3000);
      } else setError(d.message || "Не удалось создать колонку");
    },
    onError: (e) => setError(e.message || "Ошибка создания колонки"),
  });

  const updateColumnMutation = api.tables.updateColumn.useMutation({
    onSuccess: (d) => {
      if (d.success) {
        setSuccessMessage("Колонка обновлена");
        setShowEditColumn(false);
        setColumnToEdit(null);
        refetchTable();
        if (d.warning) setError(d.warning);
        setTimeout(() => setSuccessMessage(""), 3000);
      } else setError(d.message || "Не удалось обновить колонку");
    },
    onError: (e) => setError(e.message || "Ошибка обновления колонки"),
  });

  const deleteColumnMutation = api.tables.deleteColumn.useMutation({
    onSuccess: (d) => {
      if (d.success) {
        setSuccessMessage("Колонка удалена");
        setShowDeleteColumn(false);
        setColumnToDelete(null);
        refetchTable();
        setTimeout(() => setSuccessMessage(""), 3000);
      } else setError(d.message || "Не удалось удалить колонку");
    },
    onError: (e) => setError(e.message || "Ошибка удаления колонки"),
  });

  /* -------------------------- handlers ----------------------------- */
  const handleSaveTable = () => {
    if (!editedTable.name) return setError("Название таблицы обязательно");
    updateTableMutation.mutate({
      id: tableId,
      ...editedTable,
      order: table?.order || 0,
    });
  };

  const handleAddColumn = () => {
    if (!newColumn.name) return setError("Название колонки обязательно");
    createColumnMutation.mutate({
      ...newColumn,
      tableId,
      order: table?.columns?.length || 0,
    });
  };

  const handleEditColumn = () => {
    if (!columnToEdit) return;
    updateColumnMutation.mutate({ ...columnToEdit });
  };

  const confirmDeleteColumn = () => {
    if (columnToDelete)
      deleteColumnMutation.mutate({ columnId: columnToDelete.id });
  };

  const moveColumn = (columnId: number, direction: "up" | "down") => {
    if (!table || !table.columns) return;
    const cols = [...table.columns];
    const idx = cols.findIndex((c) => c.id === columnId);
    if (idx === -1) return;
    const newIdx =
      direction === "up"
        ? Math.max(0, idx - 1)
        : Math.min(cols.length - 1, idx + 1);
    if (idx === newIdx) return;
    [cols[idx], cols[newIdx]] = [cols[newIdx], cols[idx]];
    updateColumnMutation.mutate({ ...cols[idx], order: idx });
    updateColumnMutation.mutate({ ...cols[newIdx], order: newIdx });
  };

  /* ---------------------------------------------------------------------- */
  /*                                RENDER                                  */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="container mx-auto p-4 dark:bg-zinc-900 dark:text-zinc-100">
      {/* header */}
      <div className="mb-6">
        <div className="flex items-center">
          <Link href="/tables">
            <Button
              variant="outline"
              className="mr-2 flex items-center gap-1 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <ArrowLeft size={16} /> Назад к списку
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">
            {isLoadingTable
              ? "Загрузка..."
              : `Конструктор таблицы: ${table?.name || ""}`}
          </h1>
        </div>
      </div>

      {/* alerts */}
      {error && (
        <Alert
          variant="destructive"
          className="mb-4 dark:border-red-800 dark:bg-red-900/40 dark:text-red-100"
        >
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => setError(null)}
            className="ml-auto h-6 w-6 p-0 dark:text-zinc-300"
          >
            ×
          </Button>
        </Alert>
      )}
      {successMessage && (
        <Alert
          variant="success"
          className="mb-4 dark:border-green-800 dark:bg-green-900/40 dark:text-green-100"
        >
          <CheckCircle className="h-4 w-4" />
          <span>{successMessage}</span>
        </Alert>
      )}

      {/* loading */}
      {isLoadingTable && (
        <div className="my-12 flex items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 dark:border-zinc-700 dark:bg-zinc-800/50">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 dark:border-zinc-700 dark:border-t-blue-500"></div>
          <span className="ml-3 text-lg dark:text-zinc-300">
            Загрузка данных таблицы...
          </span>
        </div>
      )}

      {/* content */}
      {!isLoadingTable && table && (
        <>
          {/* table settings card */}
          <Card className="mb-6 overflow-hidden dark:border-zinc-700 dark:bg-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between bg-gray-50 dark:bg-zinc-700">
              <div className="flex items-center gap-2">
                <Layers
                  size={20}
                  className="text-blue-600 dark:text-blue-500"
                />
                <h2 className="text-lg font-semibold dark:text-white">
                  Настройки таблицы
                </h2>
              </div>
              {!editingTable ? (
                <Button
                  onPress={() => setEditingTable(true)}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  <Edit size={16} /> Редактировать
                </Button>
              ) : (
                <Button
                  onPress={handleSaveTable}
                  size="sm"
                  className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
                  disabled={updateTableMutation.isLoading}
                >
                  <Save size={16} />{" "}
                  {updateTableMutation.isLoading
                    ? "Сохранение..."
                    : "Сохранить"}
                </Button>
              )}
            </CardHeader>
            <CardBody className="dark:text-zinc-200">
              {/* non-edit view */}
              {!editingTable ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-sm font-medium text-gray-500 dark:text-zinc-400">
                      Название:
                    </p>
                    <p>{table.name}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-sm font-medium text-gray-500 dark:text-zinc-400">
                      Раздел:
                    </p>
                    <p>{table.section.name}</p>
                  </div>
                  {table.description && (
                    <div className="col-span-1 md:col-span-2">
                      <p className="mb-1 text-sm font-medium text-gray-500 dark:text-zinc-400">
                        Описание:
                      </p>
                      <p>{table.description}</p>
                    </div>
                  )}
                  <div>
                    <p className="mb-1 text-sm font-medium text-gray-500 dark:text-zinc-400">
                      Поиск:
                    </p>
                    <p>{table.isSearchable ? "Включен" : "Отключен"}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-sm font-medium text-gray-500 dark:text-zinc-400">
                      Пагинация:
                    </p>
                    <p>
                      {table.hasPagination
                        ? `Включена (${table.pageSize} на странице)`
                        : "Отключена"}
                    </p>
                  </div>
                </div>
              ) : (
                /* edit view */
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium dark:text-zinc-300">
                      Название <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editedTable.name}
                      onChange={(e) =>
                        setEditedTable((p: any) => ({
                          ...p,
                          name: e.target.value,
                        }))
                      }
                      className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium dark:text-zinc-300">
                      Раздел <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={editedTable.sectionId}
                      onChange={(e) =>
                        setEditedTable((p: any) => ({
                          ...p,
                          sectionId: parseInt(e.target.value, 10),
                        }))
                      }
                      className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
                    >
                      {sections.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-1 md:col-span-2">
                    <label className="mb-1 block text-sm font-medium dark:text-zinc-300">
                      Описание
                    </label>
                    <textarea
                      value={editedTable.description}
                      onChange={(e) =>
                        setEditedTable((p: any) => ({
                          ...p,
                          description: e.target.value,
                        }))
                      }
                      rows={3}
                      className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
                    />
                  </div>
                  <label className="flex items-center dark:text-zinc-300">
                    <input
                      type="checkbox"
                      className="mr-2 h-4 w-4 accent-blue-600 dark:accent-blue-500"
                      checked={editedTable.isSearchable}
                      onChange={(e) =>
                        setEditedTable((p: any) => ({
                          ...p,
                          isSearchable: e.target.checked,
                        }))
                      }
                    />
                    Включить поиск
                  </label>
                  <label className="flex items-center dark:text-zinc-300">
                    <input
                      type="checkbox"
                      className="mr-2 h-4 w-4 accent-blue-600 dark:accent-blue-500"
                      checked={editedTable.hasPagination}
                      onChange={(e) =>
                        setEditedTable((p: any) => ({
                          ...p,
                          hasPagination: e.target.checked,
                        }))
                      }
                    />
                    Включить пагинацию
                  </label>
                  {editedTable.hasPagination && (
                    <div>
                      <label className="mb-1 block text-sm font-medium dark:text-zinc-300">
                        Записей на странице
                      </label>
                      <select
                        value={editedTable.pageSize}
                        onChange={(e) =>
                          setEditedTable((p: any) => ({
                            ...p,
                            pageSize: parseInt(e.target.value, 10),
                          }))
                        }
                        className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
                      >
                        {[5, 10, 20, 50, 100].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          {/* columns card */}
          <Card className="dark:border-zinc-700 dark:bg-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between bg-gray-50 dark:bg-zinc-700">
              <div className="flex items-center gap-2">
                <Layers
                  size={20}
                  className="text-indigo-600 dark:text-indigo-500"
                />
                <h2 className="text-lg font-semibold dark:text-white">
                  Колонки таблицы
                </h2>
              </div>
              <Button
                onPress={() => setShowAddColumn(true)}
                className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700"
              >
                <PlusCircle size={16} /> Добавить колонку
              </Button>
            </CardHeader>
            <CardBody>
              {table.columns.length === 0 ? (
                <div className="my-12 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 py-12 dark:border-zinc-700">
                  <p className="mb-4 text-lg text-gray-500 dark:text-zinc-400">
                    В таблице пока нет колонок
                  </p>
                  <Button
                    onPress={() => setShowAddColumn(true)}
                    className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700"
                  >
                    <PlusCircle size={16} /> Добавить первую колонку
                  </Button>
                </div>
              ) : (
                <div className="overflow-auto rounded-lg border dark:border-zinc-700">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
                    <thead className="bg-gray-50 dark:bg-zinc-700">
                      <tr>
                        {[
                          "Порядок",
                          "Название",
                          "Тип",
                          "Обязательное",
                          "Фильтрация",
                          "Итоги",
                          "", // actions
                        ].map((h, i) => (
                          <th
                            key={i}
                            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-300"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white dark:divide-zinc-700 dark:bg-zinc-800">
                      {table.columns.map((col: any, idx: number) => (
                        <tr
                          key={col.id}
                          className="h-16 hover:bg-gray-50 dark:hover:bg-zinc-700"
                        >
                          {/* порядок */}
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-zinc-400">
                            <div className="flex items-center">
                              <span className="mr-2">{idx + 1}</span>
                              <div className="flex flex-col">
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onPress={() => moveColumn(col.id, "up")}
                                  disabled={idx === 0}
                                  className="h-6 w-6 p-1 text-gray-500 dark:text-zinc-400"
                                >
                                  <MoveUp size={14} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onPress={() => moveColumn(col.id, "down")}
                                  disabled={idx === table.columns.length - 1}
                                  className="h-6 w-6 p-1 text-gray-500 dark:text-zinc-400"
                                >
                                  <MoveDown size={14} />
                                </Button>
                              </div>
                            </div>
                          </td>
                          {/* название */}
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-medium dark:text-zinc-200">
                            {col.name}
                          </td>
                          {/* тип */}
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-zinc-400">
                            {getColumnTypeLabel(col.type)}
                          </td>
                          {/* обязательное */}
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-zinc-400">
                            <span
                              className={`rounded-full px-2 py-1 text-xs ${col.isRequired ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" : "bg-gray-100 text-gray-800 dark:bg-zinc-700 dark:text-zinc-400"}`}
                            >
                              {col.isRequired ? "Да" : "Нет"}
                            </span>
                          </td>
                          {/* фильтр */}
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-zinc-400">
                            <span
                              className={`rounded-full px-2 py-1 text-xs ${col.isFilterable ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" : "bg-gray-100 text-gray-800 dark:bg-zinc-700 dark:text-zinc-400"}`}
                            >
                              {col.isFilterable ? "Да" : "Нет"}
                            </span>
                          </td>
                          {/* итоги */}
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-zinc-400">
                            <span
                              className={`rounded-full px-2 py-1 text-xs ${col.isSummable ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" : "bg-gray-100 text-gray-800 dark:bg-zinc-700 dark:text-zinc-400"}`}
                            >
                              {col.isSummable ? "Да" : "Нет"}
                            </span>
                          </td>
                          {/* actions */}
                          <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                            <div className="flex justify-end space-x-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onPress={() => {
                                  setColumnToEdit({ ...col });
                                  setShowEditColumn(true);
                                }}
                                className="h-8 w-8 p-0 dark:border-zinc-600 dark:hover:bg-zinc-700"
                              >
                                <Edit
                                  size={14}
                                  className="dark:text-zinc-300"
                                />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onPress={() => {
                                  setColumnToDelete(col);
                                  setShowDeleteColumn(true);
                                }}
                                className="h-8 w-8 p-0 text-gray-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-500"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-zinc-400">
                  Всего колонок: {table.columns.length}
                </p>
                <div className="flex space-x-2">
                  <Link href={`/tables/view/${tableId}`}>
                    <Button
                      variant="outline"
                      className="flex items-center gap-1 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      Просмотр таблицы
                    </Button>
                  </Link>
                  <Button
                    onPress={() => setShowAddColumn(true)}
                    className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700"
                  >
                    <PlusCircle size={16} /> Добавить колонку
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </>
      )}

      {/* modals */}
      {showAddColumn && (
        <AddEditColumnModal
          title="Добавить колонку"
          column={newColumn}
          setColumn={setNewColumn}
          isSaving={createColumnMutation.isLoading}
          onSave={handleAddColumn}
          onClose={() => setShowAddColumn(false)}
        />
      )}
      {showEditColumn && columnToEdit && (
        <AddEditColumnModal
          title="Редактировать колонку"
          column={columnToEdit}
          setColumn={setColumnToEdit}
          isSaving={updateColumnMutation.isLoading}
          onSave={handleEditColumn}
          onClose={() => setShowEditColumn(false)}
        />
      )}
      {showDeleteColumn && columnToDelete && (
        <ConfirmDeleteColumnModal
          name={columnToDelete.name}
          isDeleting={deleteColumnMutation.isLoading}
          onConfirm={confirmDeleteColumn}
          onClose={() => setShowDeleteColumn(false)}
        />
      )}
    </div>
  );
}
