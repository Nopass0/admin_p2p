"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader, CardFooter } from "@heroui/card";
import { Table, TableBody, TableCell, TableHeader, TableColumn, TableRow } from "@heroui/table";
import { Input } from "@heroui/input";
import { Alert } from "@heroui/alert";
import { PlusCircle, Edit, Trash2, MoveUp, MoveDown, Save, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { use } from "react"; // Импортируем use из React

// Компонент страницы для правильного получения параметров
export default function TableConstructorPage({ params }) {
  // Используем React.use() для обработки params как Promise
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
          // Инициализируем данные редактирования при получении данных таблицы
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

  // Получаем данные таблицы из успешного ответа или null
  const table = tableData?.success ? tableData.table : null;

  // Мутации для обновления таблицы
  const updateTableMutation = api.tables.updateTable.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setSuccessMessage("Таблица успешно обновлена");
        setEditingTable(false);
        refetchTable();

        // Скрываем сообщение об успехе через 3 секунды
        setTimeout(() => {
          setSuccessMessage("");
        }, 3000);
      } else {
        setError(data.message || "Не удалось обновить таблицу");
      }
    },
    onError: (error) => {
      setError(error.message || "Произошла ошибка при обновлении таблицы");
    }
  });

  // Мутации для создания колонки
  const createColumnMutation = api.tables.createColumn.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setSuccessMessage("Колонка успешно создана");
        setShowAddColumn(false);
        resetNewColumnForm();
        refetchTable();

        // Показываем предупреждение, если есть
        if (data.warning) {
          setError(data.warning);
        }

        // Скрываем сообщение об успехе через 3 секунды
        setTimeout(() => {
          setSuccessMessage("");
        }, 3000);
      } else {
        setError(data.message || "Не удалось создать колонку");
      }
    },
    onError: (error) => {
      setError(error.message || "Произошла ошибка при создании колонки");
    }
  });

  // Мутации для обновления колонки
  const updateColumnMutation = api.tables.updateColumn.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setSuccessMessage("Колонка успешно обновлена");
        setShowEditColumn(false);
        setColumnToEdit(null);
        refetchTable();

        // Показываем предупреждение, если есть
        if (data.warning) {
          setError(data.warning);
        }

        // Скрываем сообщение об успехе через 3 секунды
        setTimeout(() => {
          setSuccessMessage("");
        }, 3000);
      } else {
        setError(data.message || "Не удалось обновить колонку");
      }
    },
    onError: (error) => {
      setError(error.message || "Произошла ошибка при обновлении колонки");
    }
  });

  // Мутации для удаления колонки
  const deleteColumnMutation = api.tables.deleteColumn.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setSuccessMessage("Колонка успешно удалена");
        setShowDeleteColumn(false);
        setColumnToDelete(null);
        refetchTable();

        // Скрываем сообщение об успехе через 3 секунды
        setTimeout(() => {
          setSuccessMessage("");
        }, 3000);
      } else {
        setError(data.message || "Не удалось удалить колонку");
      }
    },
    onError: (error) => {
      setError(error.message || "Произошла ошибка при удалении колонки");
    }
  });

  // Сброс формы новой колонки
  const resetNewColumnForm = () => {
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
  };

  // Очистка сообщения об ошибке
  const clearError = () => {
    setError(null);
  };

  // Обработчик сохранения изменений таблицы
  const handleSaveTable = () => {
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
  };

  // Обработчик добавления новой колонки
  const handleAddColumn = () => {
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
  };

  // Обработчик редактирования колонки
  const handleEditColumn = () => {
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
  };

  // Обработчик удаления колонки
  const confirmDeleteColumn = () => {
    if (columnToDelete) {
      deleteColumnMutation.mutate({ columnId: columnToDelete.id });
    }
  };

  // Перемещение колонки вверх/вниз
  const moveColumn = (columnId, direction) => {
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
  };

  // Компонент для настройки опций в зависимости от типа колонки
  const ColumnTypeOptions = ({ column, setColumn }) => {
    const isEditMode = !!column.id;
    const currentType = column.type;

    // Для типа SELECT - настройка вариантов выбора
    if (currentType === "SELECT") {
      return (
        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
          <h3 className="mb-3 font-medium">Настройка вариантов выбора</h3>
          
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium">
              Варианты (каждый с новой строки)
            </label>
            <textarea
              value={(column.options?.values || []).join('\n')}
              onChange={(e) => {
                const values = e.target.value.split('\n').filter(v => v.trim());
                setColumn({
                  ...column,
                  options: { ...column.options, values }
                });
              }}
              className="w-full rounded-md border border-gray-300 p-2"
              rows={4}
              placeholder="Значение 1&#10;Значение 2&#10;Значение 3"
            />
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="allowMultiple"
              checked={!!column.options?.allowMultiple}
              onChange={(e) => {
                setColumn({
                  ...column,
                  options: { 
                    ...column.options, 
                    allowMultiple: e.target.checked 
                  }
                });
              }}
              className="mr-2 h-4 w-4"
            />
            <label htmlFor="allowMultiple" className="text-sm">
              Разрешить множественный выбор
            </label>
          </div>
        </div>
      );
    }

    // Для типа CALCULATED - настройка формулы расчета
    if (currentType === "CALCULATED") {
      return (
        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
          <h3 className="mb-3 font-medium">Настройка формулы расчета</h3>
          
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium">
              Формула
            </label>
            <textarea
              value={column.options?.formula || ""}
              onChange={(e) => {
                setColumn({
                  ...column,
                  options: { ...column.options, formula: e.target.value }
                });
              }}
              className="w-full rounded-md border border-gray-300 p-2"
              rows={3}
              placeholder="Например: [columnA] * [columnB]"
            />
            <p className="mt-1 text-xs text-gray-500">
              Используйте [columnName] для ссылки на другие колонки. Поддерживаются операторы +, -, *, /, ^, % и круглые скобки.
            </p>
          </div>
        </div>
      );
    }

    // Для типа CURRENCY - настройка валюты
    if (currentType === "CURRENCY") {
      return (
        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
          <h3 className="mb-3 font-medium">Настройка валюты</h3>
          
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium">
              Валюта
            </label>
            <select
              value={column.options?.currency || "RUB"}
              onChange={(e) => {
                setColumn({
                  ...column,
                  options: { ...column.options, currency: e.target.value }
                });
              }}
              className="w-full rounded-md border border-gray-300 p-2"
            >
              <option value="RUB">Российский рубль (₽)</option>
              <option value="USD">Доллар США ($)</option>
              <option value="EUR">Евро (€)</option>
              <option value="USDT">USDT</option>
            </select>
          </div>
          
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium">
              Формат отображения
            </label>
            <select
              value={column.format || "default"}
              onChange={(e) => {
                setColumn({
                  ...column,
                  format: e.target.value === "default" ? "" : e.target.value
                });
              }}
              className="w-full rounded-md border border-gray-300 p-2"
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
        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
          <h3 className="mb-3 font-medium">Настройка формата {currentType === "DATE" ? "даты" : "даты и времени"}</h3>
          
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium">
              Формат отображения
            </label>
            <select
              value={column.format || "default"}
              onChange={(e) => {
                setColumn({
                  ...column,
                  format: e.target.value === "default" ? "" : e.target.value
                });
              }}
              className="w-full rounded-md border border-gray-300 p-2"
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
        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
          <h3 className="mb-3 font-medium">Настройка числового формата</h3>
          
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium">
              Формат отображения
            </label>
            <select
              value={column.format || "default"}
              onChange={(e) => {
                setColumn({
                  ...column,
                  format: e.target.value === "default" ? "" : e.target.value
                });
              }}
              className="w-full rounded-md border border-gray-300 p-2"
            >
              <option value="default">По умолчанию (1,234.56)</option>
              <option value="integer">Целое число (1,235)</option>
              <option value="percent">Процент (123.46%)</option>
              <option value="compact">Компактный (1.2K)</option>
            </select>
          </div>
          
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium">
              Точность (количество десятичных знаков)
            </label>
            <select
              value={column.options?.precision || "2"}
              onChange={(e) => {
                setColumn({
                  ...column,
                  options: { ...column.options, precision: e.target.value }
                });
              }}
              className="w-full rounded-md border border-gray-300 p-2"
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
  };

  // Модальное окно для добавления новой колонки
  const AddColumnModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-xl font-bold">Добавить новую колонку</h2>
        
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium">
            Название колонки <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={newColumn.name}
            onChange={(e) => setNewColumn({ ...newColumn, name: e.target.value })}
            className="w-full rounded-md border border-gray-300 p-2"
            placeholder="Введите название колонки"
          />
        </div>
        
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium">
            Тип данных <span className="text-red-500">*</span>
          </label>
          <select
            value={newColumn.type}
            onChange={(e) => setNewColumn({ 
              ...newColumn, 
              type: e.target.value,
              // Автоматически включаем isSummable для числовых колонок с названиями "сумма", "цена" и т.д.
              isSummable: (e.target.value === "NUMBER" || e.target.value === "CURRENCY") && 
                (newColumn.name.toLowerCase().includes("сумма") || 
                newColumn.name.toLowerCase().includes("цена") || 
                newColumn.name.toLowerCase().includes("стоимость") || 
                newColumn.name.toLowerCase().includes("итог") || 
                newColumn.name.toLowerCase().includes("total") || 
                newColumn.name.toLowerCase().includes("sum") || 
                newColumn.name.toLowerCase().includes("price") || 
                newColumn.name.toLowerCase().includes("cost"))
                ? true 
                : newColumn.isSummable
            })}
            className="w-full rounded-md border border-gray-300 p-2"
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
            <label className="mb-2 block text-sm font-medium">
              Ширина колонки (px)
            </label>
            <input
              type="number"
              value={newColumn.width || ""}
              onChange={(e) => setNewColumn({ ...newColumn, width: parseInt(e.target.value) || null })}
              className="w-full rounded-md border border-gray-300 p-2"
              placeholder="Автоматически"
              min="50"
            />
          </div>
          
          <div>
            <label className="mb-2 block text-sm font-medium">
              Значение по умолчанию
            </label>
            <input
              type="text"
              value={newColumn.defaultValue || ""}
              onChange={(e) => setNewColumn({ ...newColumn, defaultValue: e.target.value })}
              className="w-full rounded-md border border-gray-300 p-2"
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
              onChange={(e) => setNewColumn({ ...newColumn, isRequired: e.target.checked })}
              className="mr-2 h-4 w-4"
            />
            <label htmlFor="isRequired" className="text-sm">
              Обязательное поле
            </label>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isFilterable"
              checked={newColumn.isFilterable}
              onChange={(e) => setNewColumn({ ...newColumn, isFilterable: e.target.checked })}
              className="mr-2 h-4 w-4"
            />
            <label htmlFor="isFilterable" className="text-sm">
              Возможность фильтрации
            </label>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isSummable"
              checked={newColumn.isSummable}
              onChange={(e) => setNewColumn({ ...newColumn, isSummable: e.target.checked })}
              className="mr-2 h-4 w-4"
              disabled={!["NUMBER", "CURRENCY", "CALCULATED"].includes(newColumn.type)}
            />
            <label htmlFor="isSummable" className={`text-sm ${!["NUMBER", "CURRENCY", "CALCULATED"].includes(newColumn.type) ? "text-gray-400" : ""}`}>
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
          >
            Отмена
          </Button>
          <Button
            onPress={handleAddColumn}
            disabled={!newColumn.name || createColumnMutation.isLoading}
          >
            {createColumnMutation.isLoading ? "Создание..." : "Создать колонку"}
          </Button>
        </div>
      </div>
    </div>
  );

  // Модальное окно для редактирования колонки
  const EditColumnModal = () => {
    if (!columnToEdit) return null;
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-bold">Редактирование колонки</h2>
          
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium">
              Название колонки <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={columnToEdit.name}
              onChange={(e) => setColumnToEdit({ ...columnToEdit, name: e.target.value })}
              className="w-full rounded-md border border-gray-300 p-2"
              placeholder="Введите название колонки"
            />
          </div>
          
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium">
              Тип данных <span className="text-red-500">*</span>
            </label>
            <select
              value={columnToEdit.type}
              onChange={(e) => setColumnToEdit({ 
                ...columnToEdit, 
                type: e.target.value,
                isSummable: (e.target.value === "NUMBER" || e.target.value === "CURRENCY") && 
                  (columnToEdit.name.toLowerCase().includes("сумма") || 
                  columnToEdit.name.toLowerCase().includes("цена") || 
                  columnToEdit.name.toLowerCase().includes("стоимость") || 
                  columnToEdit.name.toLowerCase().includes("итог") || 
                  columnToEdit.name.toLowerCase().includes("total") || 
                  columnToEdit.name.toLowerCase().includes("sum") || 
                  columnToEdit.name.toLowerCase().includes("price") || 
                  columnToEdit.name.toLowerCase().includes("cost"))
                  ? true 
                  : columnToEdit.isSummable
              })}
              className="w-full rounded-md border border-gray-300 p-2"
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
              <label className="mb-2 block text-sm font-medium">
                Ширина колонки (px)
              </label>
              <input
                type="number"
                value={columnToEdit.width || ""}
                onChange={(e) => setColumnToEdit({ ...columnToEdit, width: parseInt(e.target.value) || null })}
                className="w-full rounded-md border border-gray-300 p-2"
                placeholder="Автоматически"
                min="50"
              />
            </div>
            
            <div>
              <label className="mb-2 block text-sm font-medium">
                Значение по умолчанию
              </label>
              <input
                type="text"
                value={columnToEdit.defaultValue || ""}
                onChange={(e) => setColumnToEdit({ ...columnToEdit, defaultValue: e.target.value })}
                className="w-full rounded-md border border-gray-300 p-2"
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
                onChange={(e) => setColumnToEdit({ ...columnToEdit, isRequired: e.target.checked })}
                className="mr-2 h-4 w-4"
              />
              <label htmlFor="editIsRequired" className="text-sm">
                Обязательное поле
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="editIsFilterable"
                checked={columnToEdit.isFilterable}
                onChange={(e) => setColumnToEdit({ ...columnToEdit, isFilterable: e.target.checked })}
                className="mr-2 h-4 w-4"
              />
              <label htmlFor="editIsFilterable" className="text-sm">
                Возможность фильтрации
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="editIsSummable"
                checked={columnToEdit.isSummable}
                onChange={(e) => setColumnToEdit({ ...columnToEdit, isSummable: e.target.checked })}
                className="mr-2 h-4 w-4"
                disabled={!["NUMBER", "CURRENCY", "CALCULATED"].includes(columnToEdit.type)}
              />
              <label htmlFor="editIsSummable" className={`text-sm ${!["NUMBER", "CURRENCY", "CALCULATED"].includes(columnToEdit.type) ? "text-gray-400" : ""}`}>
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
            >
              Отмена
            </Button>
            <Button
              onPress={handleEditColumn}
              disabled={!columnToEdit.name || updateColumnMutation.isLoading}
            >
              {updateColumnMutation.isLoading ? "Сохранение..." : "Сохранить изменения"}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // Модальное окно подтверждения удаления колонки
  const DeleteColumnModal = () => {
    if (!columnToDelete) return null;
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-bold text-red-600">Удаление колонки</h2>
          
          <p className="mb-4">
            Вы уверены, что хотите удалить колонку "{columnToDelete.name}"? Это действие удалит все данные этой колонки и не может быть отменено.
          </p>
          
          <div className="flex justify-end space-x-2">
            <Button 
              onPress={() => setShowDeleteColumn(false)}
              variant="outline"
            >
              Отмена
            </Button>
            <Button
              onPress={confirmDeleteColumn}
              variant="destructive"
              disabled={deleteColumnMutation.isLoading}
            >
              {deleteColumnMutation.isLoading ? "Удаление..." : "Удалить колонку"}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <div className="flex items-center">
          <Link href="/tables">
            <Button variant="outline" className="mr-2 flex items-center gap-1">
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
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
          <Button variant="ghost" size="sm" onPress={clearError} className="ml-auto h-6 w-6 p-0">×</Button>
        </Alert>
      )}
      
      {successMessage && (
        <Alert variant="success" className="mb-4">
          <CheckCircle className="h-4 w-4" />
          <span>{successMessage}</span>
        </Alert>
      )}

      {/* Загрузка */}
      {isLoadingTable && (
        <div className="my-8 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          <span className="ml-2">Загрузка...</span>
        </div>
      )}

      {!isLoadingTable && table && (
        <>
          {/* Информация о таблице */}
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between bg-gray-50">
              <h2 className="text-lg font-semibold">Настройки таблицы</h2>
              {!editingTable ? (
                <Button
                  onPress={() => setEditingTable(true)}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <Edit size={16} /> Редактировать
                </Button>
              ) : (
                <Button
                  onPress={handleSaveTable}
                  variant="primary"
                  size="sm"
                  className="flex items-center gap-1"
                  disabled={updateTableMutation.isLoading}
                >
                  <Save size={16} /> {updateTableMutation.isLoading ? "Сохранение..." : "Сохранить"}
                </Button>
              )}
            </CardHeader>
            <CardBody>
              {!editingTable ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-sm font-medium text-gray-500">Название:</p>
                    <p>{table.name}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-sm font-medium text-gray-500">Раздел:</p>
                    <p>{table.section.name}</p>
                  </div>
                  {table.description && (
                    <div className="col-span-1 md:col-span-2">
                      <p className="mb-1 text-sm font-medium text-gray-500">Описание:</p>
                      <p>{table.description}</p>
                    </div>
                  )}
                  <div>
                    <p className="mb-1 text-sm font-medium text-gray-500">Поиск:</p>
                    <p>{table.isSearchable ? "Включен" : "Отключен"}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-sm font-medium text-gray-500">Пагинация:</p>
                    <p>{table.hasPagination ? `Включена (${table.pageSize} записей на странице)` : "Отключена"}</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Название <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editedTable.name}
                      onChange={(e) => setEditedTable({ ...editedTable, name: e.target.value })}
                      className="w-full rounded-md border border-gray-300 p-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Раздел <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={editedTable.sectionId}
                      onChange={(e) => setEditedTable({ ...editedTable, sectionId: parseInt(e.target.value) })}
                      className="w-full rounded-md border border-gray-300 p-2"
                    >
                      {sections.map(section => (
                        <option key={section.id} value={section.id}>
                          {section.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-1 md:col-span-2">
                    <label className="mb-1 block text-sm font-medium">
                      Описание
                    </label>
                    <textarea
                      value={editedTable.description}
                      onChange={(e) => setEditedTable({ ...editedTable, description: e.target.value })}
                      className="w-full rounded-md border border-gray-300 p-2"
                      rows={3}
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isSearchable"
                      checked={editedTable.isSearchable}
                      onChange={(e) => setEditedTable({ ...editedTable, isSearchable: e.target.checked })}
                      className="mr-2 h-4 w-4"
                    />
                    <label htmlFor="isSearchable">
                      Включить поиск по таблице
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="hasPagination"
                      checked={editedTable.hasPagination}
                      onChange={(e) => setEditedTable({ ...editedTable, hasPagination: e.target.checked })}
                      className="mr-2 h-4 w-4"
                    />
                    <label htmlFor="hasPagination">
                      Включить пагинацию
                    </label>
                  </div>
                  {editedTable.hasPagination && (
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Записей на странице
                      </label>
                      <select
                        value={editedTable.pageSize}
                        onChange={(e) => setEditedTable({ ...editedTable, pageSize: parseInt(e.target.value) })}
                        className="w-full rounded-md border border-gray-300 p-2"
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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between bg-gray-50">
              <h2 className="text-lg font-semibold">Колонки таблицы</h2>
              <Button
                onPress={() => setShowAddColumn(true)}
                className="flex items-center gap-1"
              >
                <PlusCircle size={16} /> Добавить колонку
              </Button>
            </CardHeader>
            <CardBody>
              {table.columns.length === 0 ? (
                <div className="my-8 flex flex-col items-center justify-center">
                  <p className="mb-4 text-lg text-gray-500">В таблице пока нет колонок</p>
                  <Button 
                    onPress={() => setShowAddColumn(true)}
                    className="flex items-center gap-1"
                  >
                    <PlusCircle size={16} /> Добавить первую колонку
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableColumn>Порядок</TableColumn>
                    <TableColumn>Название</TableColumn>
                    <TableColumn>Тип</TableColumn>
                    <TableColumn>Обязательное</TableColumn>
                    <TableColumn>Фильтрация</TableColumn>
                    <TableColumn>Итоги</TableColumn>
                    <TableColumn>Действия</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {table.columns.map((column, index) => (
                      <TableRow key={column.id} className="h-16">
                        <TableCell className="w-20">
                          <div className="flex items-center">
                            <span className="mr-2">{index + 1}</span>
                            <div className="flex flex-col">
                              <Button
                                variant="ghost"
                                size="xs"
                                onPress={() => moveColumn(column.id, 'up')}
                                disabled={index === 0}
                                className="h-6 w-6 p-1"
                              >
                                <MoveUp size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="xs"
                                onPress={() => moveColumn(column.id, 'down')}
                                disabled={index === table.columns.length - 1}
                                className="h-6 w-6 p-1"
                              >
                                <MoveDown size={14} />
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{column.name}</TableCell>
                        <TableCell>{getColumnTypeLabel(column.type)}</TableCell>
                        <TableCell>{column.isRequired ? "Да" : "Нет"}</TableCell>
                        <TableCell>{column.isFilterable ? "Да" : "Нет"}</TableCell>
                        <TableCell>{column.isSummable ? "Да" : "Нет"}</TableCell>
                        <TableCell>
                          <div className="flex space-x-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onPress={() => {
                                setColumnToEdit({ ...column });
                                setShowEditColumn(true);
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <Edit size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onPress={() => {
                                setColumnToDelete(column);
                                setShowDeleteColumn(true);
                              }}
                              className="h-8 w-8 p-0 text-gray-500 hover:text-red-600"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Всего колонок: {table.columns.length}
                </p>
                <div className="flex space-x-2">
                  <Link href={`/tables/view/${tableId}`}>
                    <Button variant="outline" className="flex items-center gap-1">
                      Просмотр таблицы
                    </Button>
                  </Link>
                  <Button
                    onPress={() => setShowAddColumn(true)}
                    className="flex items-center gap-1"
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