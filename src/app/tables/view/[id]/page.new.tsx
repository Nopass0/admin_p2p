"use client";

import { useState, useEffect } from "react";
import { api } from "@/trpc/react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardFooter } from "@heroui/card";
import { Table, TableBody, TableCell, TableHeader, TableColumn, TableRow } from "@heroui/table";
import { Input } from "@heroui/input";
import { Alert } from "@heroui/alert";
import { 
  PlusCircle, Edit, Trash2, ArrowLeft, CheckCircle, AlertCircle, 
  Filter, Search, ChevronLeft, ChevronRight
} from "lucide-react";
import Link from "next/link";

export default function TableViewPage() {
  // Состояния
  const [tableId, setTableId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState("");
  const [table, setTable] = useState(null);
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 10,
    totalPages: 0,
    totalRows: 0
  });
  
  // Состояния для фильтрации и сортировки
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  const [searchText, setSearchText] = useState("");
  const [filters, setFilters] = useState([]);
  const [activeFilters, setActiveFilters] = useState([]);
  
  // Состояния для модальных окон
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentRow, setCurrentRow] = useState(null);
  const [formData, setFormData] = useState({});
  
  // Извлечение ID таблицы из URL при инициализации
  useEffect(() => {
    const path = window.location.pathname;
    const id = parseInt(path.split('/').pop());
    
    if (!isNaN(id)) {
      setTableId(id);
    } else {
      setError("Некорректный ID таблицы");
      setLoading(false);
    }
  }, []);
  
  // Загрузка данных таблицы при изменении ID
  useEffect(() => {
    if (!tableId) return;
    loadTableData();
  }, [tableId]);
  
  // Функция загрузки данных таблицы
  const loadTableData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Получение метаданных таблицы
      const tableResult = await api.tables.getTableById.query({ tableId });
      
      if (!tableResult.success) {
        setError(tableResult.message || "Не удалось загрузить таблицу");
        setLoading(false);
        return;
      }
      
      // Сохранение данных таблицы
      setTable(tableResult.table);
      setColumns(tableResult.table.columns || []);
      
      // Настройка пагинации
      setPagination(prev => ({ 
        ...prev, 
        pageSize: tableResult.table.pageSize || 10 
      }));
      
      // Загрузка строк таблицы
      await loadRows();
    } catch (err) {
      setError(err.message || "Произошла ошибка при загрузке данных");
    } finally {
      setLoading(false);
    }
  };
  
  // Функция загрузки строк таблицы
  const loadRows = async () => {
    if (!tableId || !table) return;
    
    try {
      const result = await api.tables.getTableData.query({
        tableId,
        page: pagination.currentPage,
        pageSize: pagination.pageSize,
        sortColumn,
        sortDirection,
        filters: activeFilters,
        searchText: searchText.trim() || undefined
      });
      
      if (result.success) {
        setRows(result.data.rows || []);
        setPagination(prev => ({
          ...prev,
          totalRows: result.data.pagination.totalRows || 0,
          totalPages: result.data.pagination.totalPages || 0,
          currentPage: result.data.pagination.currentPage || 1
        }));
      } else {
        setError(result.message || "Не удалось загрузить данные таблицы");
      }
    } catch (err) {
      setError(err.message || "Ошибка при загрузке строк таблицы");
    }
  };

  // Обработчики действий
  const handleSearch = () => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    loadRows();
  };

  const handleSort = (columnId) => {
    if (sortColumn === columnId) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(columnId);
      setSortDirection("asc");
    }
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setTimeout(loadRows, 0);
  };

  const handlePageChange = (page) => {
    setPagination(prev => ({ ...prev, currentPage: page }));
    setTimeout(loadRows, 0);
  };

  const handleAddFilter = (filter) => {
    setActiveFilters(prev => [...prev, filter]);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setTimeout(loadRows, 0);
  };

  const handleRemoveFilter = (index) => {
    setActiveFilters(prev => prev.filter((_, i) => i !== index));
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setTimeout(loadRows, 0);
  };

  const handleClearFilters = () => {
    setActiveFilters([]);
    setSearchText("");
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setTimeout(loadRows, 0);
  };

  // Форматирование данных для отображения
  const formatCellValue = (type, value) => {
    if (value === null || value === undefined) return "";
    
    switch (type) {
      case "NUMBER":
        return !isNaN(Number(value)) ? Number(value).toLocaleString() : value;
      case "CURRENCY":
        return !isNaN(Number(value)) ? `${Number(value).toLocaleString()} ₽` : value;
      case "BOOLEAN":
        return value === "true" || value === true ? "Да" : "Нет";
      case "DATE":
        try {
          const date = new Date(value);
          return date.toLocaleDateString();
        } catch (e) {
          return value;
        }
      case "DATETIME":
        try {
          const date = new Date(value);
          return date.toLocaleString();
        } catch (e) {
          return value;
        }
      default:
        return String(value);
    }
  };

  // Генерация чисел для пагинации
  const generatePaginationNumbers = (current, total) => {
    if (total <= 5) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    
    if (current <= 3) {
      return [1, 2, 3, 4, 5];
    }
    
    if (current >= total - 2) {
      return [total - 4, total - 3, total - 2, total - 1, total];
    }
    
    return [current - 2, current - 1, current, current + 1, current + 2];
  };

  // Функции для работы с формами
  const handleOpenAddForm = () => {
    const initialData = {};
    columns.forEach(col => {
      initialData[col.id] = col.defaultValue || "";
    });
    setFormData(initialData);
    setShowAddForm(true);
  };

  const handleOpenEditForm = (row) => {
    setCurrentRow(row);
    setFormData(row.data || {});
    setShowEditForm(true);
  };

  const handleOpenDeleteConfirm = (row) => {
    setCurrentRow(row);
    setShowDeleteConfirm(true);
  };

  const handleInputChange = (columnId, value) => {
    setFormData(prev => ({ ...prev, [columnId]: value }));
  };

  // Мутации для операций CRUD
  const createRow = async () => {
    if (!tableId) return;
    
    // Проверка обязательных полей
    const requiredColumns = columns.filter(col => col.isRequired);
    const missingFields = requiredColumns.filter(col => !formData[col.id]);
    
    if (missingFields.length > 0) {
      setError(`Необходимо заполнить обязательные поля: ${missingFields.map(col => col.name).join(', ')}`);
      return;
    }
    
    setLoading(true);
    
    try {
      const cells = columns.map(col => ({
        columnId: col.id,
        value: formData[col.id] || ""
      }));
      
      const result = await api.tables.createRow.mutate({
        tableId,
        cells
      });
      
      if (result.success) {
        setSuccess("Строка успешно добавлена");
        setShowAddForm(false);
        loadRows();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(result.message || "Не удалось добавить строку");
      }
    } catch (err) {
      setError(err.message || "Ошибка при добавлении строки");
    } finally {
      setLoading(false);
    }
  };

  const updateRow = async () => {
    if (!currentRow) return;
    
    // Проверка обязательных полей
    const requiredColumns = columns.filter(col => col.isRequired);
    const missingFields = requiredColumns.filter(col => !formData[col.id]);
    
    if (missingFields.length > 0) {
      setError(`Необходимо заполнить обязательные поля: ${missingFields.map(col => col.name).join(', ')}`);
      return;
    }
    
    setLoading(true);
    
    try {
      const cells = columns.map(col => ({
        columnId: col.id,
        value: formData[col.id] || ""
      }));
      
      const result = await api.tables.updateRow.mutate({
        rowId: currentRow.id,
        cells
      });
      
      if (result.success) {
        setSuccess("Строка успешно обновлена");
        setShowEditForm(false);
        setCurrentRow(null);
        loadRows();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(result.message || "Не удалось обновить строку");
      }
    } catch (err) {
      setError(err.message || "Ошибка при обновлении строки");
    } finally {
      setLoading(false);
    }
  };

  const deleteRow = async () => {
    if (!currentRow) return;
    
    setLoading(true);
    
    try {
      const result = await api.tables.deleteRow.mutate({
        rowId: currentRow.id
      });
      
      if (result.success) {
        setSuccess("Строка успешно удалена");
        setShowDeleteConfirm(false);
        setCurrentRow(null);
        loadRows();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(result.message || "Не удалось удалить строку");
      }
    } catch (err) {
      setError(err.message || "Ошибка при удалении строки");
    } finally {
      setLoading(false);
    }
  };

  // Отображение значения для выбранного типа ввода
  const renderInput = (column, value, onChange) => {
    const inputValue = value === null || value === undefined ? "" : value;
    
    switch (column.type) {
      case "NUMBER":
      case "CURRENCY":
        return (
          <Input
            type="number"
            value={inputValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Введите ${column.type === "NUMBER" ? "число" : "сумму"}`}
          />
        );
      case "TEXT":
        return (
          <Input
            type="text"
            value={inputValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Введите текст"
          />
        );
      case "DATE":
        return (
          <Input
            type="date"
            value={inputValue}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case "DATETIME":
        return (
          <Input
            type="datetime-local"
            value={inputValue}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case "BOOLEAN":
        return (
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            value={inputValue}
            onChange={(e) => onChange(e.target.value)}
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
            onChange={(e) => onChange(e.target.value)}
            placeholder="Введите значение"
          />
        );
    }
  };

  // Рендер основного интерфейса
  return (
    <div className="container mx-auto px-4 py-6">
      {/* Шапка */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/tables" className="mb-2 inline-flex items-center text-blue-600 hover:underline">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Назад к списку таблиц
          </Link>
          <h1 className="text-2xl font-bold">
            {loading ? "Загрузка..." : (table ? table.name : "Таблица не найдена")}
          </h1>
        </div>
        {table?.description && (
          <p className="mt-2 text-gray-500">{table.description}</p>
        )}
      </div>

      {/* Уведомления */}
      {error && (
        <Alert variant="error" className="mb-4">
          <AlertCircle className="mr-2 h-4 w-4" />
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert variant="success" className="mb-4">
          <CheckCircle className="mr-2 h-4 w-4" />
          {success}
        </Alert>
      )}

      {/* Панель действий */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant="primary" 
            onClick={handleOpenAddForm} 
            disabled={loading || !columns?.length}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Добавить запись
          </Button>
          
          {activeFilters.length > 0 && (
            <Button 
              variant="outline" 
              onClick={handleClearFilters} 
              disabled={loading}
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
            className="rounded-r-none border-r-0"
            disabled={loading || !table?.isSearchable}
          />
          <Button
            variant="outline"
            className="rounded-l-none"
            onClick={handleSearch}
            disabled={loading || !table?.isSearchable}
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Активные фильтры */}
      {activeFilters.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {activeFilters.map((filter, index) => {
            const column = columns.find(c => c.id === filter.columnId);
            return (
              <div key={index} className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700">
                {column?.name}: {filter.value}
                <button
                  onClick={() => handleRemoveFilter(index)}
                  className="ml-2 rounded-full p-1 hover:bg-blue-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Таблица данных */}
      {!loading && table && (
        <Card>
          <CardBody className="p-0">
            {rows.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                Нет данных для отображения
              </div>
            ) : (
              <Table aria-label="Данные таблицы">
                <TableHeader>
                  {columns.map(column => (
                    <TableColumn 
                      key={column.id}
                      style={{ width: column.width ? `${column.width}px` : 'auto' }}
                      className={sortColumn === column.id ? "bg-blue-50" : ""}
                    >
                      <div 
                        className="flex items-center cursor-pointer"
                        onClick={() => handleSort(column.id)}
                      >
                        {column.name}
                        {sortColumn === column.id && (
                          <span className="ml-1">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </TableColumn>
                  ))}
                  <TableColumn className="w-24 text-right">Действия</TableColumn>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      {columns.map(column => (
                        <TableCell key={`${row.id}-${column.id}`}>
                          {formatCellValue(column.type, row.data?.[column.id])}
                        </TableCell>
                      ))}
                      <TableCell className="flex justify-end space-x-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleOpenEditForm(row)}
                          title="Редактировать"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleOpenDeleteConfirm(row)}
                          title="Удалить"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardBody>
          
          {/* Пагинация */}
          {table?.hasPagination && pagination.totalPages > 1 && (
            <CardFooter className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Показано {(pagination.currentPage - 1) * pagination.pageSize + 1} - {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalRows)} из {pagination.totalRows}
              </div>
              <div className="flex items-center space-x-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handlePageChange(1)}
                  disabled={pagination.currentPage === 1}
                >
                  Первая
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                  disabled={pagination.currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                {generatePaginationNumbers(pagination.currentPage, pagination.totalPages).map(page => (
                  <Button 
                    key={page} 
                    variant={pagination.currentPage === page ? "primary" : "outline"} 
                    size="sm" 
                    onClick={() => handlePageChange(page)}
                    disabled={pagination.currentPage === page}
                  >
                    {page}
                  </Button>
                ))}
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                  disabled={pagination.currentPage === pagination.totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handlePageChange(pagination.totalPages)}
                  disabled={pagination.currentPage === pagination.totalPages}
                >
                  Последняя
                </Button>
              </div>
            </CardFooter>
          )}
        </Card>
      )}

      {/* Модальные окна */}
      {/* Добавление строки */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-lg overflow-y-auto max-h-[90vh]">
            <h2 className="mb-4 text-xl font-bold">Добавить новую строку</h2>
            
            {columns.length > 0 ? (
              <>
                <div className="mb-6 space-y-4">
                  {columns.map(column => (
                    <div key={column.id} className="mb-4">
                      <label className="mb-2 block text-sm font-medium">
                        {column.name} {column.isRequired && <span className="text-red-500">*</span>}
                      </label>
                      {renderInput(
                        column, 
                        formData[column.id], 
                        (value) => handleInputChange(column.id, value)
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="flex justify-end space-x-2 mt-4">
                  <Button variant="outline" onClick={() => setShowAddForm(false)}>Отмена</Button>
                  <Button onClick={createRow} disabled={loading}>
                    {loading ? "Добавление..." : "Добавить строку"}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-center text-gray-500 my-4">Загрузка полей формы...</p>
            )}
          </div>
        </div>
      )}

      {/* Редактирование строки */}
      {showEditForm && currentRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-lg overflow-y-auto max-h-[90vh]">
            <h2 className="mb-4 text-xl font-bold">Редактирование строки</h2>
            
            <div className="mb-6 space-y-4">
              {columns.map(column => (
                <div key={column.id} className="mb-4">
                  <label className="mb-2 block text-sm font-medium">
                    {column.name} {column.isRequired && <span className="text-red-500">*</span>}
                  </label>
                  {renderInput(
                    column, 
                    formData[column.id], 
                    (value) => handleInputChange(column.id, value)
                  )}
                </div>
              ))}
            </div>
            
            <div className="flex justify-end space-x-2 mt-4">
              <Button variant="outline" onClick={() => setShowEditForm(false)}>Отмена</Button>
              <Button onClick={updateRow} disabled={loading}>
                {loading ? "Сохранение..." : "Сохранить изменения"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Удаление строки */}
      {showDeleteConfirm && currentRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-xl font-bold">Удаление строки</h2>
            <p className="mb-4">Вы уверены, что хотите удалить эту строку? Это действие не может быть отменено.</p>
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Отмена</Button>
              <Button variant="destructive" onClick={deleteRow} disabled={loading}>
                {loading ? "Удаление..." : "Удалить"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
