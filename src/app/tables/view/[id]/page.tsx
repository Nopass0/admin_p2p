"use client";

import { useState, useEffect, useMemo } from "react";
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
  // Base state
  const [id, setId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [table, setTable] = useState(null);
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ totalRows: 0, totalPages: 0, currentPage: 1, pageSize: 10 });
  const [summaries, setSummaries] = useState({});
  
  // Filters, sorting and search
  const [filters, setFilters] = useState([]);
  const [activeFilters, setActiveFilters] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  const [searchText, setSearchText] = useState("");
  
  // Modal states
  const [showAddRow, setShowAddRow] = useState(false);
  const [showEditRow, setShowEditRow] = useState(false);
  const [showDeleteRow, setShowDeleteRow] = useState(false);
  const [rowToEdit, setRowToEdit] = useState(null);
  const [rowToDelete, setRowToDelete] = useState(null);
  const [newRowData, setNewRowData] = useState({});

  // Extract table ID from URL and initialize
  useEffect(() => {
    const path = window.location.pathname;
    const tableId = path.split('/').pop();
    
    if (tableId && !isNaN(tableId)) {
      setId(parseInt(tableId));
    } else {
      setError("Некорректный ID таблицы");
      setIsLoading(false);
    }
  }, []);

  // Initialize form data when columns change
  useEffect(() => {
    if (columns?.length > 0) {
      const initialData = {};
      columns.forEach(col => initialData[col.id] = col.defaultValue || "");
      setNewRowData(initialData);
    }
  }, [columns]);

  // Clear error message after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Fetch table metadata
  const { 
    isLoading: isLoadingTable, 
    error: tableError 
  } = api.tables.getTableById.useQuery(
    { tableId: id },
    {
      enabled: !!id,
      onSuccess: (data) => {
        if (data?.success) {
          setTable(data.table);
          setColumns(data.table.columns || []);
          setFilters(data.table.filters || []);
          setPagination(prev => ({ ...prev, pageSize: data.table.pageSize || 10 }));
        } else {
          setError(data?.message || "Не удалось загрузить информацию о таблице");
        }
      },
      onError: (error) => setError(error?.message)
    }
  );

  // Fetch table data with filtering, sorting and pagination
  const { 
    refetch: refetchTableData,
    isLoading: isLoadingTableData,
    error: tableDataError
  } = api.tables.getTableData.useQuery(
    { 
      tableId: id,
      page: pagination.currentPage,
      pageSize: pagination.pageSize,
      sortColumn,
      sortDirection,
      filters: activeFilters,
      searchText: searchText.trim() || undefined
    },
    {
      enabled: !!id && !!table,
      onSuccess: (data) => {
        if (data?.success) {
          setRows(data.data.rows || []);
          setPagination(prev => ({
            ...prev,
            totalRows: data.data.pagination.totalRows || 0,
            totalPages: data.data.pagination.totalPages || 0,
            currentPage: data.data.pagination.currentPage || 1,
          }));
          setSummaries(data.data.summaries || {});
        } else {
          setError(data?.message || "Не удалось загрузить данные таблицы");
        }
      },
      onError: (error) => setError(error?.message)
    }
  );

  // Update global loading state
  useEffect(() => {
    setIsLoading(isLoadingTable || isLoadingTableData);
  }, [isLoadingTable, isLoadingTableData]);

  // Handle errors from queries
  useEffect(() => {
    if (tableError) setError(tableError.message);
    if (tableDataError) setError(tableDataError.message);
  }, [tableError, tableDataError]);

  // Mutations for CRUD operations
  const createRowMutation = api.tables.createRow.useMutation({
    onMutate: () => setIsLoading(true),
    onSuccess: handleMutationSuccess("Строка успешно добавлена", () => {
      setShowAddRow(false);
      resetForm();
    }),
    onError: (error) => handleMutationError(error.message)
  });

  const updateRowMutation = api.tables.updateRow.useMutation({
    onMutate: () => setIsLoading(true),
    onSuccess: handleMutationSuccess("Строка успешно обновлена", () => {
      setShowEditRow(false);
      setRowToEdit(null);
    }),
    onError: (error) => handleMutationError(error.message)
  });

  const deleteRowMutation = api.tables.deleteRow.useMutation({
    onMutate: () => setIsLoading(true),
    onSuccess: handleMutationSuccess("Строка успешно удалена", () => {
      setShowDeleteRow(false);
      setRowToDelete(null);
    }),
    onError: (error) => handleMutationError(error.message)
  });

  // Helper functions for mutations
  function handleMutationSuccess(message, callback) {
    return (data) => {
      if (data.success) {
        setSuccessMessage(message);
        callback();
        refetchTableData();
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setError(data.message || "Не удалось выполнить операцию");
      }
      setIsLoading(false);
    };
  }

  function handleMutationError(message) {
    setError(message || "Произошла ошибка");
    setIsLoading(false);
  }

  function resetForm() {
    const initialData = {};
    columns.forEach(col => initialData[col.id] = col.defaultValue || "");
    setNewRowData(initialData);
  }

  // Format rows data for display
  const formattedRows = useMemo(() => {
    if (!rows?.length || !columns?.length) return [];
    
    return rows.map(row => {
      const rowData = {};
      columns.forEach(column => {
        const cell = row.cells?.[column.id];
        rowData[column.id] = cell ? (cell.displayValue || cell.value || "") : (column.defaultValue || "");
      });
      return { id: row.id, data: rowData };
    });
  }, [rows, columns]);

  // Event handlers
  function validateRequiredFields(data) {
    const requiredColumns = columns.filter(col => col.isRequired);
    for (const col of requiredColumns) {
      if (!data[col.id] || String(data[col.id]).trim() === '') {
        setError(`Поле "${col.name}" обязательно для заполнения`);
        return false;
      }
    }
    return true;
  }

  function prepareCellData(data) {
    return columns
      .filter(col => data[col.id] !== undefined)
      .map(col => ({ columnId: col.id, value: String(data[col.id]) }));
  }

  function handleAddRow() {
    if (!validateRequiredFields(newRowData)) return;
    createRowMutation.mutate({
      tableId: id,
      cells: prepareCellData(newRowData)
    });
  }

  function handleUpdateRow() {
    if (!rowToEdit || !validateRequiredFields(rowToEdit.data)) return;
    updateRowMutation.mutate({
      rowId: rowToEdit.id,
      cells: prepareCellData(rowToEdit.data)
    });
  }

  function handleDeleteRow() {
    if (!rowToDelete) return;
    deleteRowMutation.mutate({ rowId: rowToDelete.id });
  }

  function handlePageChange(page) {
    setPagination(prev => ({ ...prev, currentPage: page }));
  }

  function handleSort(columnId) {
    if (sortColumn === columnId) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(columnId);
      setSortDirection("asc");
    }
  }

  function handleAddFilter(filter) {
    if (!activeFilters.some(f => f.id === filter.id)) {
      setActiveFilters(prev => [...prev, filter]);
    }
    setShowFilters(false);
  }

  function handleRemoveFilter(index) {
    setActiveFilters(prev => prev.filter((_, i) => i !== index));
  }

  function handleClearFilters() {
    setActiveFilters([]);
    setSearchText("");
  }

  // Render UI components
  const renderModals = () => (
    <>
{/* Add Row Modal */}
{showAddRow && (
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
                {renderInputForColumnType(
                  column, 
                  newRowData[column.id], 
                  (value) => setNewRowData(prev => ({ ...prev, [column.id]: value }))
                )}
              </div>
            ))}
          </div>
          
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setShowAddRow(false)}>Отмена</Button>
            <Button onClick={handleAddRow} disabled={createRowMutation.isLoading}>
              {createRowMutation.isLoading ? "Добавление..." : "Добавить строку"}
            </Button>
          </div>
        </>
      ) : (
        <p className="text-center text-gray-500 my-4">Загрузка полей формы...</p>
      )}
    </div>
  </div>
)}

      {showEditRow && rowToEdit && (
        <Modal title="Редактирование строки" onClose={() => setShowEditRow(false)}>
          <FormFields 
            columns={columns} 
            data={rowToEdit.data} 
            onChange={(id, value) => setRowToEdit(prev => ({
              ...prev, 
              data: { ...prev.data, [id]: value }
            }))} 
          />
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setShowEditRow(false)}>Отмена</Button>
            <Button onClick={handleUpdateRow} disabled={updateRowMutation.isLoading}>
              {updateRowMutation.isLoading ? "Сохранение..." : "Сохранить изменения"}
            </Button>
          </div>
        </Modal>
      )}

      {showDeleteRow && rowToDelete && (
        <Modal title="Удаление строки" onClose={() => setShowDeleteRow(false)}>
          <p className="mb-4">Вы уверены, что хотите удалить эту строку? Это действие не может быть отменено.</p>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowDeleteRow(false)}>Отмена</Button>
            <Button variant="destructive" onClick={handleDeleteRow} disabled={deleteRowMutation.isLoading}>
              {deleteRowMutation.isLoading ? "Удаление..." : "Удалить"}
            </Button>
          </div>
        </Modal>
      )}

      {showFilters && (
        <Modal title="Фильтры" onClose={() => setShowFilters(false)}>
          <div className="mb-6 space-y-4">
            {filters.length === 0 ? (
              <p className="text-center text-gray-500">Для этой таблицы не настроены фильтры</p>
            ) : (
              filters.map(filter => (
                <div key={filter.id} className="flex items-center justify-between rounded-md border border-gray-200 p-3">
                  <div>
                    <p className="font-medium">{filter.name}</p>
                    <p className="text-sm text-gray-500">
                      {filter.column?.name} {getOperatorLabel(filter.operator)} {filter.value} 
                      {filter.operator === "BETWEEN" && filter.secondValue ? ` и ${filter.secondValue}` : ""}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddFilter(filter)}
                    disabled={activeFilters.some(f => f.id === filter.id)}
                  >
                    {activeFilters.some(f => f.id === filter.id) ? "Активен" : "Применить"}
                  </Button>
                </div>
              ))
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setShowFilters(false)}>Закрыть</Button>
          </div>
        </Modal>
      )}
    </>
  );

  return (
    <div className="container mx-auto p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center">
          <Link href="/tables">
            <Button variant="outline" className="mr-2 flex items-center gap-1">
              <ArrowLeft size={16} /> Назад к списку
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">
            {isLoading ? "Загрузка..." : table?.name || "Таблица не найдена"}
          </h1>
        </div>
        {table?.description && (
          <p className="mt-2 text-gray-500">{table.description}</p>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </Alert>
      )}
      
      {successMessage && (
        <Alert variant="success" className="mb-4">
          <CheckCircle className="h-4 w-4" />
          <span>{successMessage}</span>
        </Alert>
      )}

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setShowAddRow(true)}
            className="flex items-center gap-1"
            disabled={isLoading}
          >
            <PlusCircle size={16} /> Добавить строку
          </Button>
          
          <Button
            variant="outline"
            className="flex items-center gap-1"
            onClick={() => setShowFilters(true)}
            disabled={isLoading || filters.length === 0}
          >
            <Filter size={16} /> Фильтры
            {activeFilters.length > 0 && (
              <span className="ml-1 rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white">
                {activeFilters.length}
              </span>
            )}
          </Button>
          
          <Link href={`/tables/constructor/${id}`}>
            <Button
              variant="outline"
              className="flex items-center gap-1"
              disabled={isLoading}
            >
              <Edit size={16} /> Конструктор
            </Button>
          </Link>
        </div>
        
        <div className="flex w-full max-w-xs items-center">
          <Input
            placeholder="Поиск..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="rounded-r-none border-r-0"
            disabled={isLoading || !table?.isSearchable}
          />
          <Button
            variant="outline"
            className="rounded-l-none"
            onClick={() => refetchTableData()}
            disabled={isLoading}
          >
            <Search size={16} />
          </Button>
        </div>
      </div>

      {/* Active filters */}
      {activeFilters.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Активные фильтры:</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:text-red-600"
              onClick={handleClearFilters}
            >
              Очистить все
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {activeFilters.map((filter, index) => (
              <div key={index} className="flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm">
                <span>
                  {filter.name}: {filter.column?.name} {getOperatorLabel(filter.operator)} {filter.value}
                  {filter.operator === "BETWEEN" && filter.secondValue ? ` и ${filter.secondValue}` : ""}
                </span>
                <button 
                  className="ml-2 text-gray-500 hover:text-red-600"
                  onClick={() => handleRemoveFilter(index)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="my-8 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          <span className="ml-2">Загрузка данных...</span>
        </div>
      )}

      {/* Data table */}
      {!isLoading && table && (
        <Card>
          <CardBody className="p-0">
            {formattedRows.length === 0 ? (
              <div className="my-16 flex flex-col items-center justify-center">
                <p className="mb-4 text-lg text-gray-500">В таблице пока нет данных</p>
                <Button onClick={() => setShowAddRow(true)} className="flex items-center gap-1">
                  <PlusCircle size={16} /> Добавить первую строку
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map(column => (
                        <TableColumn 
                          key={column.id} 
                          className={column.isSummable ? "font-bold" : ""}
                          style={{ width: column.width ? `${column.width}px` : 'auto' }}
                        >
                          <div 
                            className={`flex items-center ${column.isFilterable ? 'cursor-pointer' : ''}`}
                            onClick={() => column.isFilterable && handleSort(column.id)}
                          >
                            {column.name}
                            {sortColumn === column.id && (
                              <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
                            )}
                          </div>
                        </TableColumn>
                      ))}
                      <TableColumn className="w-24">Действия</TableColumn>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formattedRows.map(row => (
                      <TableRow key={row.id} className="hover:bg-gray-50">
                        {columns.map(column => (
                          <TableCell key={`${row.id}-${column.id}`}>
                            {formatCellValue(column.type, row.data[column.id])}
                          </TableCell>
                        ))}
                        <TableCell>
                          <div className="flex space-x-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setRowToEdit(row);
                                setShowEditRow(true);
                              }}
                            >
                              <Edit size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-gray-500 hover:text-red-600"
                              onClick={() => {
                                setRowToDelete(row);
                                setShowDeleteRow(true);
                              }}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {/* Summary row for summable columns */}
                    {Object.keys(summaries).length > 0 && (
                      <TableRow className="bg-gray-100 font-bold">
                        {columns.map((column, index) => (
                          <TableCell key={`summary-${column.id}`}>
                            {index === 0 ? (
                              "Итого:"
                            ) : column.isSummable ? (
                              formatCellValue(column.type, summaries[column.id] || 0)
                            ) : (
                              ""
                            )}
                          </TableCell>
                        ))}
                        <TableCell></TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardBody>
          
          {/* Pagination */}
          {table.hasPagination && pagination.totalPages > 1 && (
            <CardFooter className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Показано {(pagination.currentPage - 1) * pagination.pageSize + 1} - {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalRows)} из {pagination.totalRows}
              </div>
              <div className="flex items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(1)}
                  disabled={pagination.currentPage === 1}
                >
                  <ChevronLeft size={14} />
                  <ChevronLeft size={14} className="-ml-2" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                  disabled={pagination.currentPage === 1}
                  className="ml-2"
                >
                  <ChevronLeft size={14} />
                </Button>
                
                <span className="mx-4">
                  Страница {pagination.currentPage} из {pagination.totalPages}
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                  disabled={pagination.currentPage === pagination.totalPages}
                >
                  <ChevronRight size={14} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.totalPages)}
                  disabled={pagination.currentPage === pagination.totalPages}
                  className="ml-2"
                >
                  <ChevronRight size={14} />
                  <ChevronRight size={14} className="-ml-2" />
                </Button>
              </div>
            </CardFooter>
          )}
        </Card>
      )}

      {renderModals()}
    </div>
  );
}

// Reusable Modal component
function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-lg overflow-y-auto max-h-[90vh]">
        <h2 className="mb-4 text-xl font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

// Form fields component
function FormFields({ columns, data, onChange }) {
  return (
    <div className="mb-6 space-y-4">
      {columns.map(column => (
        <div key={column.id} className="mb-4">
          <label className="mb-2 block text-sm font-medium">
            {column.name} {column.isRequired && <span className="text-red-500">*</span>}
          </label>
          {renderInputForColumnType(
            column, 
            data[column.id] !== undefined ? data[column.id] : column.defaultValue || "", 
            (value) => onChange(column.id, value)
          )}
        </div>
      ))}
    </div>
  );
}

// Input rendering based on column type
function renderInputForColumnType(column, value, onChange) {
  switch (column.type) {
    case "TEXT":
    case "LINK":
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 p-2"
          placeholder={`Введите ${column.name.toLowerCase()}`}
        />
      );
    
    case "NUMBER":
    case "CURRENCY":
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 p-2"
          placeholder={`Введите ${column.name.toLowerCase()}`}
          step="any"
        />
      );
    
    case "DATE":
      return (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 p-2"
        />
      );
    
    case "DATETIME":
      return (
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 p-2"
        />
      );
    
    case "BOOLEAN":
      return (
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={value === true || value === "true"}
            onChange={(e) => onChange(e.target.checked.toString())}
            className="mr-2 h-5 w-5"
            id={`checkbox-${column.id}`}
          />
          <label htmlFor={`checkbox-${column.id}`}>Да/Нет</label>
        </div>
      );
    
    case "SELECT":
      return (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 p-2"
        >
          <option value="">Выберите значение</option>
          {column.options?.values?.map((option, index) => (
            <option key={index} value={option}>{option}</option>
          ))}
        </select>
      );
    
    case "COMMENT":
      return (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 p-2"
          rows={3}
          placeholder="Введите комментарий"
        />
      );
    
    default:
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 p-2"
          placeholder={`Введите ${column.name.toLowerCase()}`}
        />
      );
  }
}

// Get filter operator text
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

// Format cell value based on type
function formatCellValue(type, value) {
  if (value === null || value === undefined || value === "") return "-";

  switch (type) {
    case "BOOLEAN":
      return value === "true" || value === true ? "Да" : "Нет";
    
    case "LINK":
      try {
        return (
          <a 
            href={value.startsWith("http") ? value : `https://${value}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {value}
          </a>
        );
      } catch (e) {
        return value;
      }
    
    case "DATE":
    case "DATETIME":
      try {
        const date = new Date(value);
        return type === "DATE" 
          ? date.toLocaleDateString() 
          : date.toLocaleString();
      } catch (e) {
        return value;
      }
    
    default:
      return value;
  }
}