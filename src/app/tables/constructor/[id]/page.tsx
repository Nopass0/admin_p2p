"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader, CardFooter } from "@heroui/card";
import { Input } from "@heroui/input";
import { Alert } from "@heroui/alert";
import { PlusCircle, Edit, Trash2, MoveUp, MoveDown, Save, ArrowLeft, CheckCircle, AlertCircle, Layers } from "lucide-react";
import Link from "next/link";
import { use } from "react";

export default function TableConstructorPage({ params }) {
  const resolvedParams = use(params);
  const tableId = resolvedParams?.id ? parseInt(resolvedParams.id) : null;
  
  const router = useRouter();
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [showEditColumn, setShowEditColumn] = useState(false);
  const [showDeleteColumn, setShowDeleteColumn] = useState(false);
  const [editingTable, setEditingTable] = useState(false);
  const [editedTable, setEditedTable] = useState({
    name: "",
    description: "",
    isSearchable: true,
    hasPagination: true,
    pageSize: 10
  });
  const [columnToEdit, setColumnToEdit] = useState(null);
  const [columnToDelete, setColumnToDelete] = useState(null);
  const [newColumn, setNewColumn] = useState({
    name: "",
    type: "TEXT",
    width: null,
    isRequired: false,
    isFilterable: false,
    isSummable: false,
    defaultValue: "",
    format: "",
    options: null
  });

  // Получение разделов для выбора при редактировании таблицы
  const { data: sectionsData } = api.tables.getAllSections.useQuery();
  const sections = sectionsData?.success ? sectionsData.sections : [];

  // Получение данных таблицы
  const { 
    data: tableData, 
    refetch: refetchTable, 
    isLoading: isLoadingTable 
  } = api.tables.getTableById.useQuery(
    { tableId },
    {
      enabled: !!tableId,
      onSuccess: (data) => {
        if (data?.success) {
          setEditedTable({
            name: data.table.name,
            description: data.table.description || "",
            sectionId: data.table.sectionId,
            isSearchable: data.table.isSearchable,
            hasPagination: data.table.hasPagination,
            pageSize: data.table.pageSize
          });
        } else if (data) {
          setError(data.message || "Не удалось загрузить данные таблицы");
        }
      },
      onError: (error) => {
        setError(error.message || "Произошла ошибка при загрузке данных");
      }
    }
  );

  const table = tableData?.success ? tableData.table : null;

  // Мутации
  const updateTableMutation = api.tables.updateTable.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setSuccessMessage("Таблица успешно обновлена");
        setEditingTable(false);
        refetchTable();
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setError(data.message || "Не удалось обновить таблицу");
      }
    },
    onError: (error) => {
      setError(error.message || "Произошла ошибка при обновлении таблицы");
    }
  });

  const createColumnMutation = api.tables.createColumn.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setSuccessMessage("Колонка успешно создана");
        setShowAddColumn(false);
        resetNewColumnForm();
        refetchTable();
        if (data.warning) {
          setError(data.warning);
        }
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setError(data.message || "Не удалось создать колонку");
      }
    },
    onError: (error) => {
      setError(error.message || "Произошла ошибка при создании колонки");
    }
  });

  const updateColumnMutation = api.tables.updateColumn.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setSuccessMessage("Колонка успешно обновлена");
        setShowEditColumn(false);
        setColumnToEdit(null);
        refetchTable();
        if (data.warning) {
          setError(data.warning);
        }
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setError(data.message || "Не удалось обновить колонку");
      }
    },
    onError: (error) => {
      setError(error.message || "Произошла ошибка при обновлении колонки");
    }
  });

  const deleteColumnMutation = api.tables.deleteColumn.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setSuccessMessage("Колонка успешно удалена");
        setShowDeleteColumn(false);
        setColumnToDelete(null);
        refetchTable();
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setError(data.message || "Не удалось удалить колонку");
      }
    },
    onError: (error) => {
      setError(error.message || "Произошла ошибка при удалении колонки");
    }
  });

  // Сброс формы
  const resetNewColumnForm = useCallback(() => {
    setNewColumn({
      name: "",
      type: "TEXT",
      width: null,
      isRequired: false,
      isFilterable: false,
      isSummable: false,
      defaultValue: "",
      format: "",
      options: null
    });
  }, []);

  // Очистка ошибки
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Обработчики редактирования таблицы
  const handleEditTableNameChange = useCallback((e) => {
    const value = e.target.value;
    setEditedTable(prev => ({ ...prev, name: value }));
  }, []);

  const handleEditTableSectionChange = useCallback((e) => {
    const value = parseInt(e.target.value);
    setEditedTable(prev => ({ ...prev, sectionId: value }));
  }, []);

  const handleEditTableDescChange = useCallback((e) => {
    const value = e.target.value;
    setEditedTable(prev => ({ ...prev, description: value }));
  }, []);

  const handleEditTableSearchableChange = useCallback((e) => {
    const checked = e.target.checked;
    setEditedTable(prev => ({ ...prev, isSearchable: checked }));
  }, []);

  const handleEditTablePaginationChange = useCallback((e) => {
    const checked = e.target.checked;
    setEditedTable(prev => ({ ...prev, hasPagination: checked }));
  }, []);

  const handleEditTablePageSizeChange = useCallback((e) => {
    const value = parseInt(e.target.value);
    setEditedTable(prev => ({ ...prev, pageSize: value }));
  }, []);

  // Обработчик сохранения изменений таблицы
  const handleSaveTable = useCallback(() => {
    if (!editedTable.name) {
      setError("Название таблицы обязательно");
      return;
    }

    updateTableMutation.mutate({
      id: tableId,
      name: editedTable.name,
      description: editedTable.description,
      sectionId: editedTable.sectionId,
      isSearchable: editedTable.isSearchable,
      hasPagination: editedTable.hasPagination,
      pageSize: editedTable.pageSize,
      order: table?.order || 0
    });
  }, [editedTable, tableId, table?.order, updateTableMutation]);

  // Обработчики добавления новой колонки
  const handleNewColumnNameChange = useCallback((e) => {
    const value = e.target.value;
    setNewColumn(prev => ({ ...prev, name: value }));
  }, []);

  const handleNewColumnTypeChange = useCallback((e) => {
    const value = e.target.value;
    setNewColumn(prev => {
      const isSummableByName = value === "NUMBER" || value === "CURRENCY" && 
        (prev.name.toLowerCase().includes("сумма") || 
        prev.name.toLowerCase().includes("цена") || 
        prev.name.toLowerCase().includes("стоимость") || 
        prev.name.toLowerCase().includes("итог") || 
        prev.name.toLowerCase().includes("total") || 
        prev.name.toLowerCase().includes("sum") || 
        prev.name.toLowerCase().includes("price") || 
        prev.name.toLowerCase().includes("cost"));
        
      return {
        ...prev, 
        type: value,
        isSummable: isSummableByName ? true : prev.isSummable
      };
    });
  }, []);

  const handleNewColumnWidthChange = useCallback((e) => {
    const value = e.target.value;
    setNewColumn(prev => ({ ...prev, width: parseInt(value) || null }));
  }, []);

  const handleNewColumnDefaultValueChange = useCallback((e) => {
    const value = e.target.value;
    setNewColumn(prev => ({ ...prev, defaultValue: value }));
  }, []);

  const handleNewColumnRequiredChange = useCallback((e) => {
    const checked = e.target.checked;
    setNewColumn(prev => ({ ...prev, isRequired: checked }));
  }, []);

  const handleNewColumnFilterableChange = useCallback((e) => {
    const checked = e.target.checked;
    setNewColumn(prev => ({ ...prev, isFilterable: checked }));
  }, []);

  const handleNewColumnSummableChange = useCallback((e) => {
    const checked = e.target.checked;
    setNewColumn(prev => ({ ...prev, isSummable: checked }));
  }, []);

  // Обработчик добавления новой колонки
  const handleAddColumn = useCallback(() => {
    if (!newColumn.name) {
      setError("Название колонки обязательно");
      return;
    }

    createColumnMutation.mutate({
      name: newColumn.name,
      type: newColumn.type,
      tableId,
      width: newColumn.width,
      isRequired: newColumn.isRequired,
      isFilterable: newColumn.isFilterable,
      isSummable: newColumn.isSummable,
      defaultValue: newColumn.defaultValue,
      format: newColumn.format,
      order: table?.columns?.length || 0,
      options: newColumn.options
    });
  }, [newColumn, tableId, table?.columns?.length, createColumnMutation]);

  // Обработчики редактирования колонки
  const handleEditColumnNameChange = useCallback((e) => {
    const value = e.target.value;
    setColumnToEdit(prev => prev ? { ...prev, name: value } : null);
  }, []);

  const handleEditColumnTypeChange = useCallback((e) => {
    const value = e.target.value;
    setColumnToEdit(prev => {
      if (!prev) return null;
      
      const isSummableByName = value === "NUMBER" || value === "CURRENCY" && 
        (prev.name.toLowerCase().includes("сумма") || 
        prev.name.toLowerCase().includes("цена") || 
        prev.name.toLowerCase().includes("стоимость") || 
        prev.name.toLowerCase().includes("итог") || 
        prev.name.toLowerCase().includes("total") || 
        prev.name.toLowerCase().includes("sum") || 
        prev.name.toLowerCase().includes("price") || 
        prev.name.toLowerCase().includes("cost"));
        
      return {
        ...prev, 
        type: value,
        isSummable: isSummableByName ? true : prev.isSummable
      };
    });
  }, []);

  const handleEditColumnWidthChange = useCallback((e) => {
    const value = e.target.value;
    setColumnToEdit(prev => prev ? { ...prev, width: parseInt(value) || null } : null);
  }, []);

  const handleEditColumnDefaultValueChange = useCallback((e) => {
    const value = e.target.value;
    setColumnToEdit(prev => prev ? { ...prev, defaultValue: value } : null);
  }, []);

  const handleEditColumnRequiredChange = useCallback((e) => {
    const checked = e.target.checked;
    setColumnToEdit(prev => prev ? { ...prev, isRequired: checked } : null);
  }, []);

  const handleEditColumnFilterableChange = useCallback((e) => {
    const checked = e.target.checked;
    setColumnToEdit(prev => prev ? { ...prev, isFilterable: checked } : null);
  }, []);

  const handleEditColumnSummableChange = useCallback((e) => {
    const checked = e.target.checked;
    setColumnToEdit(prev => prev ? { ...prev, isSummable: checked } : null);
  }, []);

  // Обработчик редактирования колонки
  const handleEditColumn = useCallback(() => {
    if (!columnToEdit) return;

    updateColumnMutation.mutate({
      id: columnToEdit.id,
      name: columnToEdit.name,
      type: columnToEdit.type,
      width: columnToEdit.width,
      isRequired: columnToEdit.isRequired,
      isFilterable: columnToEdit.isFilterable,
      isSummable: columnToEdit.isSummable,
      defaultValue: columnToEdit.defaultValue,
      format: columnToEdit.format,
      order: columnToEdit.order,
      options: columnToEdit.options
    });
  }, [columnToEdit, updateColumnMutation]);

  // Обработчик удаления колонки
  const confirmDeleteColumn = useCallback(() => {
    if (columnToDelete) {
      deleteColumnMutation.mutate({ columnId: columnToDelete.id });
    }
  }, [columnToDelete, deleteColumnMutation]);

  // Перемещение колонки вверх/вниз
  const moveColumn = useCallback((columnId, direction) => {
    if (!table || !table.columns) return;

    const columns = [...table.columns];
    const index = columns.findIndex(col => col.id === columnId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? Math.max(0, index - 1) : Math.min(columns.length - 1, index + 1);
    if (index === newIndex) return;

    // Меняем местами колонки
    [columns[index], columns[newIndex]] = [columns[newIndex], columns[index]];
    
    // Обновляем порядок для обеих колонок
    updateColumnMutation.mutate({
      id: columns[index].id,
      name: columns[index].name,
      type: columns[index].type,
      width: columns[index].width,
      isRequired: columns[index].isRequired,
      isFilterable: columns[index].isFilterable,
      isSummable: columns[index].isSummable,
      defaultValue: columns[index].defaultValue,
      format: columns[index].format,
      order: index,
      options: columns[index].options
    });

    updateColumnMutation.mutate({
      id: columns[newIndex].id,
      name: columns[newIndex].name,
      type: columns[newIndex].type,
      width: columns[newIndex].width,
      isRequired: columns[newIndex].isRequired,
      isFilterable: columns[newIndex].isFilterable,
      isSummable: columns[newIndex].isSummable,
      defaultValue: columns[newIndex].defaultValue,
      format: columns[newIndex].format,
      order: newIndex,
      options: columns[newIndex].options
    });
  }, [table, updateColumnMutation]);

  // Компонент для настройки опций в зависимости от типа колонки
  const ColumnTypeOptions = useCallback(({ column, setColumn }) => {
    const isEditMode = !!column.id;
    const currentType = column.type;

    const handleSelectOptionsChange = (e) => {
      const values = e.target.value.split('\n').filter(v => v.trim());
      setColumn(prev => ({
        ...prev,
        options: { ...prev.options, values }
      }));
    };

    const handleSelectAllowMultipleChange = (e) => {
      const checked = e.target.checked;
      setColumn(prev => ({
        ...prev,
        options: { ...prev.options, allowMultiple: checked }
      }));
    };

    const handleCalculatedFormulaChange = (e) => {
      const value = e.target.value;
      setColumn(prev => ({
        ...prev,
        options: { ...prev.options, formula: value }
      }));
    };

    const handleCurrencyChange = (e) => {
      const value = e.target.value;
      setColumn(prev => ({
        ...prev,
        options: { ...prev.options, currency: value }
      }));
    };

    const handleFormatChange = (e) => {
      const value = e.target.value;
      setColumn(prev => ({
        ...prev,
        format: value === "default" ? "" : value
      }));
    };

    const handlePrecisionChange = (e) => {
      const value = e.target.value;
      setColumn(prev => ({
        ...prev,
        options: { ...prev.options, precision: value }
      }));
    };

    // Для типа SELECT - настройка вариантов выбора
    if (currentType === "SELECT") {
      return (
        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="mb-3 font-medium dark:text-zinc-200">Настройка вариантов выбора</h3>
          
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium dark:text-zinc-300">
              Варианты (каждый с новой строки)
            </label>
            <textarea
              value={(column.options?.values || []).join('\n')}
              onChange={handleSelectOptionsChange}
              className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
              rows={4}
              placeholder="Значение 1&#10;Значение 2&#10;Значение 3"
            />
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="allowMultiple"
              checked={!!column.options?.allowMultiple}
              onChange={handleSelectAllowMultipleChange}
              className="mr-2 h-4 w-4 accent-blue-600 dark:accent-blue-500"
            />
            <label htmlFor="allowMultiple" className="text-sm dark:text-zinc-300">
              Разрешить множественный выбор
            </label>
          </div>
        </div>
      );
    }

    // Для типа CALCULATED - настройка формулы расчета
    if (currentType === "CALCULATED") {
      return (
        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="mb-3 font-medium dark:text-zinc-200">Настройка формулы расчета</h3>
          
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium dark:text-zinc-300">
              Формула
            </label>
            <textarea
              value={column.options?.formula || ""}
              onChange={handleCalculatedFormulaChange}
              className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
              rows={3}
              placeholder="Например: [columnA] * [columnB]"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
              Используйте [columnName] для ссылки на другие колонки. Поддерживаются операторы +, -, *, /, ^, % и круглые скобки.
            </p>
          </div>
        </div>
      );
    }

    // Для типа CURRENCY - настройка валюты
    if (currentType === "CURRENCY") {
      return (
        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="mb-3 font-medium dark:text-zinc-200">Настройка валюты</h3>
          
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium dark:text-zinc-300">
              Валюта
            </label>
            <select
              value={column.options?.currency || "RUB"}
              onChange={handleCurrencyChange}
              className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
            >
              <option value="RUB">Российский рубль (₽)</option>
              <option value="USD">Доллар США ($)</option>
              <option value="EUR">Евро (€)</option>
              <option value="USDT">USDT</option>
            </select>
          </div>
          
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium dark:text-zinc-300">
              Формат отображения
            </label>
            <select
              value={column.format || "default"}
              onChange={handleFormatChange}
              className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
            >
              <option value="default">По умолчанию (1,234.56 ₽)</option>
              <option value="compact">Компактный (1.2K ₽)</option>
              <option value="noSymbol">Без символа валюты (1,234.56)</option>
              <option value="noDecimals">Без десятичных (1,235 ₽)</option>
            </select>
          </div>
        </div>
      );
    }

    // Для типа DATE или DATETIME - настройка формата
    if (currentType === "DATE" || currentType === "DATETIME") {
      return (
        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="mb-3 font-medium dark:text-zinc-200">Настройка формата {currentType === "DATE" ? "даты" : "даты и времени"}</h3>
          
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium dark:text-zinc-300">
              Формат отображения
            </label>
            <select
              value={column.format || "default"}
              onChange={handleFormatChange}
              className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
            >
              <option value="default">По умолчанию {currentType === "DATE" ? "(DD.MM.YYYY)" : "(DD.MM.YYYY HH:MM)"}</option>
              {currentType === "DATE" ? (
                <>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="DD.MM.YYYY">DD.MM.YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="DD MMMM YYYY">DD MMMM YYYY (1 января 2023)</option>
                </>
              ) : (
                <>
                  <option value="YYYY-MM-DD HH:mm">YYYY-MM-DD HH:MM</option>
                  <option value="DD.MM.YYYY HH:mm">DD.MM.YYYY HH:MM</option>
                  <option value="MM/DD/YYYY HH:mm">MM/DD/YYYY HH:MM</option>
                  <option value="HH:mm DD.MM.YYYY">HH:MM DD.MM.YYYY</option>
                </>
              )}
            </select>
          </div>
        </div>
      );
    }

    // Для типа NUMBER - настройка формата
    if (currentType === "NUMBER") {
      return (
        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="mb-3 font-medium dark:text-zinc-200">Настройка числового формата</h3>
          
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium dark:text-zinc-300">
              Формат отображения
            </label>
            <select
              value={column.format || "default"}
              onChange={handleFormatChange}
              className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
            >
              <option value="default">По умолчанию (1,234.56)</option>
              <option value="integer">Целое число (1,235)</option>
              <option value="percent">Процент (123.46%)</option>
              <option value="compact">Компактный (1.2K)</option>
            </select>
          </div>
          
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium dark:text-zinc-300">
              Точность (количество десятичных знаков)
            </label>
            <select
              value={column.options?.precision || "2"}
              onChange={handlePrecisionChange}
              className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
            >
              <option value="0">0 (целое число)</option>
              <option value="1">1 (0.1)</option>
              <option value="2">2 (0.01)</option>
              <option value="3">3 (0.001)</option>
              <option value="4">4 (0.0001)</option>
            </select>
          </div>
        </div>
      );
    }

    return null;
  }, []);

  // Модальное окно для добавления новой колонки
  const AddColumnModal = useCallback(() => {
    // Создаем refs для предотвращения потери фокуса
    const nameInputRef = useRef(null);
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div 
          className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg dark:bg-zinc-800 dark:text-zinc-100"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="mb-4 text-xl font-bold">Добавить новую колонку</h2>
          
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium dark:text-zinc-300">
              Название колонки <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={newColumn.name}
              onChange={handleNewColumnNameChange}
              className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
              placeholder="Введите название колонки"
              autoFocus
            />
          </div>
          
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium dark:text-zinc-300">
              Тип данных <span className="text-red-500">*</span>
            </label>
            <select
              value={newColumn.type}
              onChange={handleNewColumnTypeChange}
              className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
            >
              <option value="TEXT">Текст</option>
              <option value="NUMBER">Число</option>
              <option value="DATE">Дата</option>
              <option value="DATETIME">Дата и время</option>
              <option value="BOOLEAN">Логическое значение (Да/Нет)</option>
              <option value="SELECT">Выбор из списка</option>
              <option value="CALCULATED">Вычисляемое значение</option>
              <option value="CURRENCY">Валюта</option>
              <option value="LINK">Ссылка</option>
              <option value="COMMENT">Комментарий с историей</option>
            </select>
          </div>
          
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium dark:text-zinc-300">
                Ширина колонки (px)
              </label>
              <input
                type="number"
                value={newColumn.width || ""}
                onChange={handleNewColumnWidthChange}
                className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
                placeholder="Автоматически"
                min="50"
              />
            </div>
            
            <div>
              <label className="mb-2 block text-sm font-medium dark:text-zinc-300">
                Значение по умолчанию
              </label>
              <input
                type="text"
                value={newColumn.defaultValue || ""}
                onChange={handleNewColumnDefaultValueChange}
                className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
                placeholder="Оставьте пустым, если нет"
              />
            </div>
          </div>
          
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isRequired"
                checked={newColumn.isRequired}
                onChange={handleNewColumnRequiredChange}
                className="mr-2 h-4 w-4 accent-blue-600 dark:accent-blue-500"
              />
              <label htmlFor="isRequired" className="text-sm dark:text-zinc-300">
                Обязательное поле
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isFilterable"
                checked={newColumn.isFilterable}
                onChange={handleNewColumnFilterableChange}
                className="mr-2 h-4 w-4 accent-blue-600 dark:accent-blue-500"
              />
              <label htmlFor="isFilterable" className="text-sm dark:text-zinc-300">
                Возможность фильтрации
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isSummable"
                checked={newColumn.isSummable}
                onChange={handleNewColumnSummableChange}
                className="mr-2 h-4 w-4 accent-blue-600 dark:accent-blue-500"
                disabled={!["NUMBER", "CURRENCY", "CALCULATED"].includes(newColumn.type)}
              />
              <label htmlFor="isSummable" className={`text-sm ${!["NUMBER", "CURRENCY", "CALCULATED"].includes(newColumn.type) ? "text-gray-400 dark:text-zinc-500" : "dark:text-zinc-300"}`}>
                Показывать сумму в итогах
              </label>
            </div>
          </div>
          
          {/* Опции в зависимости от типа колонки */}
          <ColumnTypeOptions column={newColumn} setColumn={setNewColumn} />
          
          <div className="mt-6 flex justify-end space-x-2">
            <Button 
              onPress={() => setShowAddColumn(false)}
              variant="outline"
              className="dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Отмена
            </Button>
            <Button
              onPress={handleAddColumn}
              disabled={!newColumn.name || createColumnMutation.isLoading}
              className="dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              {createColumnMutation.isLoading ? "Создание..." : "Создать колонку"}
            </Button>
          </div>
        </div>
      </div>
    );
  }, [
    newColumn, 
    handleNewColumnNameChange, 
    handleNewColumnTypeChange, 
    handleNewColumnWidthChange, 
    handleNewColumnDefaultValueChange, 
    handleNewColumnRequiredChange,
    handleNewColumnFilterableChange,
    handleNewColumnSummableChange,
    handleAddColumn,
    createColumnMutation.isLoading,
    ColumnTypeOptions
  ]);

  // Модальное окно для редактирования колонки
  const EditColumnModal = useCallback(() => {
    if (!columnToEdit) return null;
    
    // Создаем refs для предотвращения потери фокуса
    const nameInputRef = useRef(null);
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div 
          className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg dark:bg-zinc-800 dark:text-zinc-100"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="mb-4 text-xl font-bold">Редактирование колонки</h2>
          
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium dark:text-zinc-300">
              Название колонки <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={columnToEdit.name}
              onChange={handleEditColumnNameChange}
              className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
              placeholder="Введите название колонки"
              autoFocus
            />
          </div>
          
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium dark:text-zinc-300">
              Тип данных <span className="text-red-500">*</span>
            </label>
            <select
              value={columnToEdit.type}
              onChange={handleEditColumnTypeChange}
              className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
            >
              <option value="TEXT">Текст</option>
              <option value="NUMBER">Число</option>
              <option value="DATE">Дата</option>
              <option value="DATETIME">Дата и время</option>
              <option value="BOOLEAN">Логическое значение (Да/Нет)</option>
              <option value="SELECT">Выбор из списка</option>
              <option value="CALCULATED">Вычисляемое значение</option>
              <option value="CURRENCY">Валюта</option>
              <option value="LINK">Ссылка</option>
              <option value="COMMENT">Комментарий с историей</option>
            </select>
          </div>
          
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium dark:text-zinc-300">
                Ширина колонки (px)
              </label>
              <input
                type="number"
                value={columnToEdit.width || ""}
                onChange={handleEditColumnWidthChange}
                className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
                placeholder="Автоматически"
                min="50"
              />
            </div>
            
            <div>
              <label className="mb-2 block text-sm font-medium dark:text-zinc-300">
                Значение по умолчанию
              </label>
              <input
                type="text"
                value={columnToEdit.defaultValue || ""}
                onChange={handleEditColumnDefaultValueChange}
                className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
                placeholder="Оставьте пустым, если нет"
              />
            </div>
          </div>
          
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="editIsRequired"
                checked={columnToEdit.isRequired}
                onChange={handleEditColumnRequiredChange}
                className="mr-2 h-4 w-4 accent-blue-600 dark:accent-blue-500"
              />
              <label htmlFor="editIsRequired" className="text-sm dark:text-zinc-300">
                Обязательное поле
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="editIsFilterable"
                checked={columnToEdit.isFilterable}
                onChange={handleEditColumnFilterableChange}
                className="mr-2 h-4 w-4 accent-blue-600 dark:accent-blue-500"
              />
              <label htmlFor="editIsFilterable" className="text-sm dark:text-zinc-300">
                Возможность фильтрации
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="editIsSummable"
                checked={columnToEdit.isSummable}
                onChange={handleEditColumnSummableChange}
                className="mr-2 h-4 w-4 accent-blue-600 dark:accent-blue-500"
                disabled={!["NUMBER", "CURRENCY", "CALCULATED"].includes(columnToEdit.type)}
              />
              <label htmlFor="editIsSummable" className={`text-sm ${!["NUMBER", "CURRENCY", "CALCULATED"].includes(columnToEdit.type) ? "text-gray-400 dark:text-zinc-500" : "dark:text-zinc-300"}`}>
                Показывать сумму в итогах
              </label>
            </div>
          </div>
          
          {/* Опции в зависимости от типа колонки */}
          <ColumnTypeOptions column={columnToEdit} setColumn={setColumnToEdit} />
          
          <div className="mt-6 flex justify-end space-x-2">
            <Button 
              onPress={() => setShowEditColumn(false)}
              variant="outline"
              className="dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Отмена
            </Button>
            <Button
              onPress={handleEditColumn}
              disabled={!columnToEdit.name || updateColumnMutation.isLoading}
              className="dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              {updateColumnMutation.isLoading ? "Сохранение..." : "Сохранить изменения"}
            </Button>
          </div>
        </div>
      </div>
    );
  }, [
    columnToEdit, 
    handleEditColumnNameChange, 
    handleEditColumnTypeChange, 
    handleEditColumnWidthChange, 
    handleEditColumnDefaultValueChange, 
    handleEditColumnRequiredChange,
    handleEditColumnFilterableChange,
    handleEditColumnSummableChange,
    handleEditColumn,
    updateColumnMutation.isLoading,
    ColumnTypeOptions
  ]);

  // Модальное окно подтверждения удаления колонки
  const DeleteColumnModal = useCallback(() => {
    if (!columnToDelete) return null;
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div 
          className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-zinc-800 dark:text-zinc-100"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="mb-4 text-xl font-bold text-red-600 dark:text-red-400">Удаление колонки</h2>
          
          <p className="mb-4 dark:text-zinc-300">
            Вы уверены, что хотите удалить колонку "{columnToDelete.name}"? Это действие удалит все данные этой колонки и не может быть отменено.
          </p>
          
          <div className="flex justify-end space-x-2">
            <Button 
              onPress={() => setShowDeleteColumn(false)}
              variant="outline"
              className="dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Отмена
            </Button>
            <Button
              onPress={confirmDeleteColumn}
              variant="destructive"
              disabled={deleteColumnMutation.isLoading}
              className="dark:bg-red-700 dark:hover:bg-red-600"
            >
              {deleteColumnMutation.isLoading ? "Удаление..." : "Удалить колонку"}
            </Button>
          </div>
        </div>
      </div>
    );
  }, [columnToDelete, confirmDeleteColumn, deleteColumnMutation.isLoading]);

  return (
    <div className="container mx-auto p-4 dark:bg-zinc-900 dark:text-zinc-100">
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
            {isLoadingTable ? "Загрузка..." : `Конструктор таблицы: ${table?.name || ''}`}
          </h1>
        </div>
      </div>

      {/* Сообщения об ошибках и успехе */}
      {error && (
        <Alert variant="destructive" className="mb-4 dark:bg-red-900/40 dark:text-red-100 dark:border-red-800">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
          <Button variant="ghost" size="sm" onPress={clearError} className="ml-auto h-6 w-6 p-0 dark:text-zinc-300">×</Button>
        </Alert>
      )}
      
      {successMessage && (
        <Alert variant="success" className="mb-4 dark:bg-green-900/40 dark:text-green-100 dark:border-green-800">
          <CheckCircle className="h-4 w-4" />
          <span>{successMessage}</span>
        </Alert>
      )}

      {/* Загрузка */}
      {isLoadingTable && (
        <div className="my-12 flex items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 dark:border-zinc-700 dark:bg-zinc-800/50">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 dark:border-zinc-700 dark:border-t-blue-500"></div>
          <span className="ml-3 text-lg dark:text-zinc-300">Загрузка данных таблицы...</span>
        </div>
      )}

      {!isLoadingTable && table && (
        <>
          {/* Информация о таблице */}
          <Card className="mb-6 overflow-hidden dark:border-zinc-700 dark:bg-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between bg-gray-50 dark:bg-zinc-700">
              <div className="flex items-center gap-2">
                <Layers size={20} className="text-blue-600 dark:text-blue-500" />
                <h2 className="text-lg font-semibold dark:text-white">Настройки таблицы</h2>
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
                  variant="primary"
                  size="sm"
                  className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
                  disabled={updateTableMutation.isLoading}
                >
                  <Save size={16} /> {updateTableMutation.isLoading ? "Сохранение..." : "Сохранить"}
                </Button>
              )}
            </CardHeader>
            <CardBody className="dark:text-zinc-200">
              {!editingTable ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-sm font-medium text-gray-500 dark:text-zinc-400">Название:</p>
                    <p>{table.name}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-sm font-medium text-gray-500 dark:text-zinc-400">Раздел:</p>
                    <p>{table.section.name}</p>
                  </div>
                  {table.description && (
                    <div className="col-span-1 md:col-span-2">
                      <p className="mb-1 text-sm font-medium text-gray-500 dark:text-zinc-400">Описание:</p>
                      <p>{table.description}</p>
                    </div>
                  )}
                  <div>
                    <p className="mb-1 text-sm font-medium text-gray-500 dark:text-zinc-400">Поиск:</p>
                    <p>{table.isSearchable ? "Включен" : "Отключен"}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-sm font-medium text-gray-500 dark:text-zinc-400">Пагинация:</p>
                    <p>{table.hasPagination ? `Включена (${table.pageSize} записей на странице)` : "Отключена"}</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium dark:text-zinc-300">
                      Название <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editedTable.name}
                      onChange={handleEditTableNameChange}
                      className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium dark:text-zinc-300">
                      Раздел <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={editedTable.sectionId}
                      onChange={handleEditTableSectionChange}
                      className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
                    >
                      {sections.map(section => (
                        <option key={section.id} value={section.id}>
                          {section.name}
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
                      onChange={handleEditTableDescChange}
                      className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
                      rows={3}
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isSearchable"
                      checked={editedTable.isSearchable}
                      onChange={handleEditTableSearchableChange}
                      className="mr-2 h-4 w-4 accent-blue-600 dark:accent-blue-500"
                    />
                    <label htmlFor="isSearchable" className="dark:text-zinc-300">
                      Включить поиск по таблице
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="hasPagination"
                      checked={editedTable.hasPagination}
                      onChange={handleEditTablePaginationChange}
                      className="mr-2 h-4 w-4 accent-blue-600 dark:accent-blue-500"
                    />
                    <label htmlFor="hasPagination" className="dark:text-zinc-300">
                      Включить пагинацию
                    </label>
                  </div>
                  {editedTable.hasPagination && (
                    <div>
                      <label className="mb-1 block text-sm font-medium dark:text-zinc-300">
                        Записей на странице
                      </label>
                      <select
                        value={editedTable.pageSize}
                        onChange={handleEditTablePageSizeChange}
                        className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Колонки таблицы */}
          <Card className="dark:border-zinc-700 dark:bg-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between bg-gray-50 dark:bg-zinc-700">
              <div className="flex items-center gap-2">
                <Layers size={20} className="text-indigo-600 dark:text-indigo-500" />
                <h2 className="text-lg font-semibold dark:text-white">Колонки таблицы</h2>
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
                  <p className="mb-4 text-lg text-gray-500 dark:text-zinc-400">В таблице пока нет колонок</p>
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
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-300">Порядок</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-300">Название</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-300">Тип</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-300">Обязательное</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-300">Фильтрация</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-300">Итоги</th>
                        <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-300">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white dark:divide-zinc-700 dark:bg-zinc-800">
                      {table.columns.map((column, index) => (
                        <tr key={column.id} className="h-16 hover:bg-gray-50 dark:hover:bg-zinc-700">
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-zinc-400">
                            <div className="flex items-center">
                              <span className="mr-2">{index + 1}</span>
                              <div className="flex flex-col">
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onPress={() => moveColumn(column.id, 'up')}
                                  disabled={index === 0}
                                  className="h-6 w-6 p-1 text-gray-500 dark:text-zinc-400"
                                >
                                  <MoveUp size={14} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onPress={() => moveColumn(column.id, 'down')}
                                  disabled={index === table.columns.length - 1}
                                  className="h-6 w-6 p-1 text-gray-500 dark:text-zinc-400"
                                >
                                  <MoveDown size={14} />
                                </Button>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-medium dark:text-zinc-200">{column.name}</td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-zinc-400">{getColumnTypeLabel(column.type)}</td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-zinc-400">
                            <span className={`rounded-full px-2 py-1 text-xs ${column.isRequired ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-zinc-700 dark:text-zinc-400'}`}>
                              {column.isRequired ? "Да" : "Нет"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-zinc-400">
                            <span className={`rounded-full px-2 py-1 text-xs ${column.isFilterable ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 text-gray-800 dark:bg-zinc-700 dark:text-zinc-400'}`}>
                              {column.isFilterable ? "Да" : "Нет"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-zinc-400">
                            <span className={`rounded-full px-2 py-1 text-xs ${column.isSummable ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-gray-100 text-gray-800 dark:bg-zinc-700 dark:text-zinc-400'}`}>
                              {column.isSummable ? "Да" : "Нет"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                            <div className="flex justify-end space-x-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onPress={() => {
                                  setColumnToEdit({ ...column });
                                  setShowEditColumn(true);
                                }}
                                className="h-8 w-8 p-0 dark:border-zinc-600 dark:hover:bg-zinc-700"
                              >
                                <Edit size={14} className="dark:text-zinc-300" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onPress={() => {
                                  setColumnToDelete(column);
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

      {/* Модальные окна */}
      {showAddColumn && <AddColumnModal />}
      {showEditColumn && <EditColumnModal />}
      {showDeleteColumn && <DeleteColumnModal />}
    </div>
  );
}

// Функция для получения названия типа колонки
function getColumnTypeLabel(type) {
  switch (type) {
    case "TEXT": return "Текст";
    case "NUMBER": return "Число";
    case "DATE": return "Дата";
    case "DATETIME": return "Дата и время";
    case "BOOLEAN": return "Да/Нет";
    case "SELECT": return "Выбор из списка";
    case "BUTTON": return "Кнопка";
    case "CALCULATED": return "Вычисляемое";
    case "CURRENCY": return "Валюта";
    case "LINK": return "Ссылка";
    case "COMMENT": return "Комментарий";
    default: return type;
  }
}