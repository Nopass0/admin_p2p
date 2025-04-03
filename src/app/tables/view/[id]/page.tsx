"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "@/trpc/react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardFooter } from "@heroui/card";
import { Input } from "@heroui/input";
import { Alert } from "@heroui/alert";
import { PlusCircle, Edit, Trash2, ArrowLeft, CheckCircle, AlertCircle, Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

// Компонент модального окна для фильтров
const FiltersModal = ({ filters, activeFilters, onAddFilter, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div 
      className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg max-h-[90vh] overflow-auto dark:bg-zinc-800 dark:text-zinc-100"
      onClick={e => e.stopPropagation()}
    >
      <h2 className="mb-4 text-xl font-bold dark:text-white">Фильтры</h2>
      <div className="mb-6 space-y-4">
        {filters.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-zinc-400">Для этой таблицы не настроены фильтры</p>
        ) : (
          filters.map(filter => (
            <div key={filter.id} className="flex items-center justify-between rounded-md border border-gray-200 p-3 dark:border-zinc-700 dark:bg-zinc-700/50">
              <div>
                <p className="font-medium dark:text-zinc-100">{filter.name}</p>
                <p className="text-sm text-gray-500 dark:text-zinc-400">
                  {filter.column?.name} {getOperatorLabel(filter.operator)} {filter.value} 
                  {filter.operator === "BETWEEN" && filter.secondValue ? ` и ${filter.secondValue}` : ""}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAddFilter(filter)}
                disabled={activeFilters.some(f => f.id === filter.id)}
                className="dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                {activeFilters.some(f => f.id === filter.id) ? "Активен" : "Применить"}
              </Button>
            </div>
          ))
        )}
      </div>
      <div className="flex justify-end">
        <Button 
          onClick={onClose}
          className="dark:bg-zinc-700 dark:hover:bg-zinc-600"
        >
          Закрыть
        </Button>
      </div>
    </div>
  </div>
);

// Компонент модального окна добавления
const AddRowModal = ({ columns, formData, setFormData, isLoading, onClose, onSubmit, renderInput }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div 
      className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-lg max-h-[90vh] overflow-auto dark:bg-zinc-800 dark:text-zinc-100"
      onClick={e => e.stopPropagation()}
    >
      <h2 className="mb-4 text-xl font-bold dark:text-white">Добавить строку</h2>
      <div className="space-y-4 mb-4">
        {columns.map(col => (
          <div key={col.id} className="mb-3">
            <label className="block text-sm font-medium mb-1 dark:text-zinc-300">
              {col.name} {col.isRequired && <span className="text-red-500">*</span>}
            </label>
            {renderInput(col, formData[col.id])}
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button 
          variant="outline" 
          onClick={onClose}
          className="dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          Отмена
        </Button>
        <Button 
          onClick={onSubmit} 
          disabled={isLoading}
          className="dark:bg-zinc-700 dark:hover:bg-zinc-600"
        >
          {isLoading ? "Добавление..." : "Добавить"}
        </Button>
      </div>
    </div>
  </div>
);

// Компонент модального окна редактирования
const EditRowModal = ({ columns, formData, setFormData, isLoading, onClose, onSubmit, renderInput }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div 
      className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-lg max-h-[90vh] overflow-auto dark:bg-zinc-800 dark:text-zinc-100"
      onClick={e => e.stopPropagation()}
    >
      <h2 className="mb-4 text-xl font-bold dark:text-white">Редактировать строку</h2>
      <div className="space-y-4 mb-4">
        {columns.map(col => (
          <div key={col.id} className="mb-3">
            <label className="block text-sm font-medium mb-1 dark:text-zinc-300">
              {col.name} {col.isRequired && <span className="text-red-500">*</span>}
            </label>
            {renderInput(col, formData[col.id])}
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button 
          variant="outline" 
          onClick={onClose}
          className="dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          Отмена
        </Button>
        <Button 
          onClick={onSubmit} 
          disabled={isLoading}
          className="dark:bg-zinc-700 dark:hover:bg-zinc-600"
        >
          {isLoading ? "Сохранение..." : "Сохранить"}
        </Button>
      </div>
    </div>
  </div>
);

// Компонент модального окна удаления
const DeleteRowModal = ({ isLoading, onClose, onSubmit }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div 
      className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg dark:bg-zinc-800 dark:text-zinc-100"
      onClick={e => e.stopPropagation()}
    >
      <h2 className="mb-4 text-xl font-bold dark:text-white">Удалить строку</h2>
      <p className="mb-4 dark:text-zinc-300">Вы уверены, что хотите удалить эту строку? Это действие нельзя отменить.</p>
      <div className="flex justify-end gap-2">
        <Button 
          variant="outline" 
          onClick={onClose}
          className="dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          Отмена
        </Button>
        <Button 
          variant="destructive" 
          onClick={onSubmit} 
          disabled={isLoading}
          className="dark:bg-red-700 dark:hover:bg-red-600"
        >
          {isLoading ? "Удаление..." : "Удалить"}
        </Button>
      </div>
    </div>
  </div>
);

// Вспомогательная функция для получения метки оператора
function getOperatorLabel(operator) {
  const operators = {
    "EQUALS": "равно",
    "NOT_EQUALS": "не равно",
    "GREATER_THAN": "больше",
    "LESS_THAN": "меньше",
    "GREATER_OR_EQUAL": "больше или равно",
    "LESS_OR_EQUAL": "меньше или равно",
    "CONTAINS": "содержит",
    "NOT_CONTAINS": "не содержит",
    "STARTS_WITH": "начинается с",
    "ENDS_WITH": "заканчивается на",
    "BETWEEN": "между",
    "IN_LIST": "в списке"
  };
  return operators[operator] || operator;
}

export default function TableViewPage() {
  // Основные состояния
  const [id, setId] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [searchText, setSearchText] = useState("");
  const [filters, setFilters] = useState([]);
  const [activeFilters, setActiveFilters] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [sortColumn, setSortColumn] = useState(undefined);
  const [sortDirection, setSortDirection] = useState("asc");
  const [pagination, setPagination] = useState({ currentPage: 1, pageSize: 10 });
  const [debouncedSearchText, setDebouncedSearchText] = useState(""); // Для debounce поиска
  
  // Модальные окна
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentRow, setCurrentRow] = useState(null);
  const [formData, setFormData] = useState({});

  // Извлечение ID из URL
  useEffect(() => {
    const path = window.location.pathname;
    const tableId = path.split('/').pop();
    if (tableId && !isNaN(tableId)) setId(parseInt(tableId));
    else setError("Некорректный ID таблицы");
  }, []);

  // Debounce для поискового запроса
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchText]);

  // Запрос данных таблицы
  const { 
    data: tableData,
    isLoading: tableLoading
  } = api.tables.getTableById.useQuery(
    { tableId: id },
    {
      enabled: !!id,
      onSuccess: (data) => {
        if (!data?.success) setError(data?.message || "Не удалось загрузить таблицу");
      },
      onError: (err) => setError(err?.message || "Ошибка загрузки таблицы")
    }
  );

  const table = tableData?.success ? tableData.table : null;
  const columns = table?.columns || [];

  // Запрос фильтров
  const { data: filtersData } = api.tables.getTableFilters.useQuery(
    { tableId: id },
    { 
      enabled: !!id,
      onSuccess: (data) => {
        if (data?.success) {
          setFilters(data.filters || []);
        }
      }
    }
  );

  // Инициализация формы при загрузке колонок
  useEffect(() => {
    if (columns.length > 0) {
      const initialData = {};
      columns.forEach(col => initialData[col.id] = col.defaultValue || "");
      setFormData(initialData);
    }
  }, [columns]);

  // Запрос данных строк с пагинацией, сортировкой и поиском
  const { 
    data: rowsData,
    isLoading: rowsLoading,
    refetch: refetchRows
  } = api.tables.getTableData.useQuery(
    { 
      tableId: id,
      page: pagination.currentPage,
      pageSize: pagination.pageSize,
      sortColumn,
      sortDirection,
      filters: activeFilters,
      searchText: debouncedSearchText.trim() || undefined
    },
    {
      enabled: !!id && !!table,
      onSuccess: (data) => {
        if (!data?.success) setError(data?.message || "Не удалось загрузить данные");
      },
      onError: (err) => setError(err?.message || "Ошибка загрузки данных")
    }
  );

  const rows = rowsData?.success ? rowsData.data.rows || [] : [];
  const isLoading = tableLoading || rowsLoading;
  
  // Мемоизируем колонки для предотвращения ненужных ререндеров
  const memoizedColumns = useMemo(() => columns, [columns]);

  // Мутации
  const createRowMutation = api.tables.createRow.useMutation({
    onSuccess: handleMutationSuccess("Строка добавлена", () => setShowAddModal(false)),
    onError: (err) => setError(err?.message || "Ошибка при добавлении")
  });

  const updateRowMutation = api.tables.updateRow.useMutation({
    onSuccess: handleMutationSuccess("Строка обновлена", () => setShowEditModal(false)),
    onError: (err) => setError(err?.message || "Ошибка при обновлении")
  });

  const deleteRowMutation = api.tables.deleteRow.useMutation({
    onSuccess: handleMutationSuccess("Строка удалена", () => setShowDeleteModal(false)),
    onError: (err) => setError(err?.message || "Ошибка при удалении")
  });

  function handleMutationSuccess(message, callback) {
    return (data) => {
      if (data.success) {
        setSuccessMsg(message);
        callback();
        refetchRows();
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        setError(data.message || "Не удалось выполнить операцию");
      }
    };
  }

  // Функция валидации формы - определяем до использования в других функциях
  const validateForm = useCallback(() => {
    const requiredColumns = columns.filter(col => col.isRequired);
    const missingFields = requiredColumns.filter(col => !formData[col.id]);
    
    if (missingFields.length > 0) {
      setError(`Заполните обязательные поля: ${missingFields.map(col => col.name).join(', ')}`);
      return false;
    }
    return true;
  }, [columns, formData, setError]);

  // Обработчики событий с useCallback
  const handleSort = useCallback((colId) => {
    setSortDirection(prev => sortColumn === colId ? (prev === "asc" ? "desc" : "asc") : "asc");
    setSortColumn(colId);
  }, [sortColumn]);

  const handlePageChange = useCallback((page) => {
    setPagination(prev => ({ ...prev, currentPage: page }));
  }, []);

  const handleOpenEditModal = useCallback((row) => {
    setCurrentRow(row);
    
    // Правильно извлекаем данные ячеек
    const rowData = {};
    Object.keys(row.cells || {}).forEach(colId => {
      rowData[colId] = row.cells[colId]?.value || "";
    });
    
    setFormData(rowData);
    setShowEditModal(true);
  }, []);

  const handleAddRow = useCallback(() => {
    if (!validateForm()) return;
    
    createRowMutation.mutate({
      tableId: id,
      cells: columns.map(col => ({ columnId: col.id, value: formData[col.id] || "" }))
    });
  }, [formData, columns, id, validateForm, createRowMutation]);

  const handleUpdateRow = useCallback(() => {
    if (!validateForm()) return;
    
    updateRowMutation.mutate({
      rowId: currentRow.id,
      cells: columns.map(col => ({ columnId: col.id, value: formData[col.id] || "" }))
    });
  }, [formData, columns, currentRow, validateForm, updateRowMutation]);

  const handleDeleteRow = useCallback(() => {
    deleteRowMutation.mutate({ rowId: currentRow.id });
  }, [currentRow, deleteRowMutation]);

  const handleAddFilter = useCallback((filter) => {
    if (!activeFilters.some(f => f.id === filter.id)) {
      setActiveFilters(prev => [...prev, filter]);
    }
    setShowFilters(false);
  }, [activeFilters]);

  const handleRemoveFilter = useCallback((index) => {
    setActiveFilters(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveFilters([]);
    setSearchText("");
  }, []);

  const handleSearch = useCallback(() => {
    // Сбрасываем на первую страницу при поиске
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  }, []);

  // Форматирование значений
  const formatValue = useCallback((type, value) => {
    if (value === null || value === undefined || value === "") return "-";
    switch (type) {
      case "BOOLEAN": return value === true || value === "true" ? "Да" : "Нет";
      case "DATE": try { return new Date(value).toLocaleDateString(); } catch(e) { return value; }
      case "DATETIME": try { return new Date(value).toLocaleString(); } catch(e) { return value; }
      case "CURRENCY": try { return `${parseFloat(value).toLocaleString()} ₽`; } catch(e) { return value; }
      default: return value;
    }
  }, []);

  // Компоненты ввода для форм
  const renderInput = useCallback((column, value) => {
    const inputValue = value ?? "";
    const handleChange = (val) => setFormData(prev => ({ ...prev, [column.id]: val }));
    
    switch (column.type) {
      case "NUMBER":
      case "CURRENCY":
        return (
          <Input 
            type="number" 
            value={inputValue} 
            onChange={e => handleChange(e.target.value)} 
            className="dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
          />
        );
      case "DATE":
        return (
          <Input 
            type="date" 
            value={inputValue} 
            onChange={e => handleChange(e.target.value)} 
            className="dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
          />
        );
      case "DATETIME":
        return (
          <Input 
            type="datetime-local" 
            value={inputValue} 
            onChange={e => handleChange(e.target.value)} 
            className="dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
          />
        );
      case "BOOLEAN":
        return (
          <select 
            className="w-full rounded-md border p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white" 
            value={inputValue} 
            onChange={e => handleChange(e.target.value)}
          >
            <option value="true">Да</option>
            <option value="false">Нет</option>
          </select>
        );
      default:
        return (
          <Input 
            type="text" 
            value={inputValue} 
            onChange={e => handleChange(e.target.value)} 
            className="dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
          />
        );
    }
  }, [setFormData]);

  const paginationInfo = rowsData?.success ? rowsData.data.pagination : { totalPages: 1 };

  // Очистка ошибки
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <div className="container mx-auto p-4 dark:bg-zinc-900 dark:text-zinc-100">
      {/* Шапка */}
      <div className="mb-6 flex items-center">
        <Link href="/tables">
          <Button variant="outline" className="mr-2 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700">
            <ArrowLeft size={16} /> Назад
          </Button>
        </Link>
        <h1 className="text-2xl font-bold dark:text-white">
          {isLoading ? "Загрузка..." : (table?.name || "Таблица не найдена")}
        </h1>
      </div>

      {/* Алерты */}
      {error && (
        <Alert variant="destructive" className="mb-4 dark:bg-red-900/50 dark:text-red-100 dark:border-red-800">
          <AlertCircle size={16} />
          <span>{error}</span>
          <Button variant="ghost" size="sm" onPress={clearError} className="ml-auto h-6 w-6 p-0 dark:text-zinc-300">×</Button>
        </Alert>
      )}
      
      {successMsg && (
        <Alert variant="success" className="mb-4 dark:bg-green-900/50 dark:text-green-100 dark:border-green-800">
          <CheckCircle size={16} /> {successMsg}
        </Alert>
      )}

      {/* Панель инструментов */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            onClick={() => setShowAddModal(true)} 
            disabled={isLoading}
            className="dark:bg-zinc-700 dark:hover:bg-zinc-600"
          >
            <PlusCircle size={16} className="mr-1" /> Добавить строку
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(true)}
            disabled={isLoading || filters.length === 0}
            className="flex items-center gap-1 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            <Filter size={16} /> Фильтры
            {activeFilters.length > 0 && (
              <span className="ml-1 rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white">
                {activeFilters.length}
              </span>
            )}
          </Button>
          
          {activeFilters.length > 0 && (
            <Button 
              variant="ghost" 
              onClick={handleClearFilters} 
              disabled={isLoading}
              className="dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Сбросить фильтры
            </Button>
          )}
        </div>
        
        <div className="flex items-center">
          <Input
            placeholder="Поиск..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            disabled={isLoading || !table?.isSearchable}
            className="rounded-r-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
          />
          <Button
            variant="outline"
            className="rounded-l-none dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
            onClick={handleSearch}
            disabled={isLoading || !table?.isSearchable}
          >
            <Search size={16} />
          </Button>
        </div>
      </div>

      {/* Активные фильтры */}
      {activeFilters.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {activeFilters.map((filter, index) => {
            const column = columns.find(c => c.id === filter.columnId);
            return (
              <div 
                key={index} 
                className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              >
                {column?.name}: {filter.value}
                <button
                  onClick={() => handleRemoveFilter(index)}
                  className="ml-2 rounded-full p-1 hover:bg-blue-100 dark:hover:bg-blue-800"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Таблица */}
      {!isLoading && table && (
        <Card className="dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700">
          <CardBody className="p-0 overflow-auto">
            {rows.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-zinc-400">Нет данных для отображения</div>
            ) : (
              <div className="w-full">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
                  <thead className="bg-gray-50 dark:bg-zinc-700">
                    <tr>
                      {memoizedColumns.map(col => (
                        <th 
                          key={col.id} 
                          scope="col" 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer dark:text-zinc-300"
                          onClick={() => handleSort(col.id)}
                        >
                          {col.name} {sortColumn === col.id && (sortDirection === "asc" ? "↑" : "↓")}
                        </th>
                      ))}
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-zinc-300">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 dark:bg-zinc-800 dark:divide-zinc-700">
                    {rows.map(row => (
                      <tr key={row.id} className="dark:hover:bg-zinc-700">
                        {memoizedColumns.map(col => {
                          // Безопасно извлекаем значение ячейки
                          const cellValue = row.cells && row.cells[col.id] 
                            ? (row.cells[col.id].displayValue || row.cells[col.id].value) 
                            : "";
                            
                          return (
                            <td key={`${row.id}-${col.id}`} className="px-6 py-4 whitespace-nowrap dark:text-zinc-300">
                              {formatValue(col.type, cellValue)}
                            </td>
                          );
                        })}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex gap-1">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleOpenEditModal(row)}
                              className="dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                            >
                              <Edit size={14} />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="text-red-500 dark:text-red-400 dark:hover:bg-zinc-700" 
                              onClick={() => {
                                setCurrentRow(row);
                                setShowDeleteModal(true);
                              }}
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
          </CardBody>
          
          {/* Пагинация */}
          {table.hasPagination && paginationInfo.totalPages > 1 && (
            <CardFooter className="flex justify-between items-center dark:border-t dark:border-zinc-700">
              <span className="text-sm text-gray-500 dark:text-zinc-400">
                Страница {pagination.currentPage} из {paginationInfo.totalPages}
              </span>
              <div className="flex gap-1">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => handlePageChange(1)} 
                  disabled={pagination.currentPage === 1}
                  className="dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  <ChevronLeft size={14} /><ChevronLeft size={14} className="-ml-1" />
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => handlePageChange(pagination.currentPage - 1)} 
                  disabled={pagination.currentPage === 1}
                  className="dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  <ChevronLeft size={14} />
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => handlePageChange(pagination.currentPage + 1)} 
                  disabled={pagination.currentPage === paginationInfo.totalPages}
                  className="dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  <ChevronRight size={14} />
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => handlePageChange(paginationInfo.totalPages)} 
                  disabled={pagination.currentPage === paginationInfo.totalPages}
                  className="dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  <ChevronRight size={14} /><ChevronRight size={14} className="-ml-1" />
                </Button>
              </div>
            </CardFooter>
          )}
        </Card>
      )}

      {/* Модальные окна как внешние компоненты с правильно переданными пропсами */}
      {showFilters && (
        <FiltersModal 
          filters={filters} 
          activeFilters={activeFilters} 
          onAddFilter={handleAddFilter} 
          onClose={() => setShowFilters(false)} 
        />
      )}

      {showAddModal && (
        <AddRowModal 
          columns={memoizedColumns}
          formData={formData}
          setFormData={setFormData}
          isLoading={createRowMutation.isLoading}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddRow}
          renderInput={renderInput}
        />
      )}

      {showEditModal && (
        <EditRowModal 
          columns={memoizedColumns}
          formData={formData}
          setFormData={setFormData}
          isLoading={updateRowMutation.isLoading}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleUpdateRow}
          renderInput={renderInput}
        />
      )}

      {showDeleteModal && (
        <DeleteRowModal 
          isLoading={deleteRowMutation.isLoading}
          onClose={() => setShowDeleteModal(false)}
          onSubmit={handleDeleteRow}
        />
      )}
    </div>
  );
}