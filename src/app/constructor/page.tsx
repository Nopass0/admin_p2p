// "use client";

// import { useState, useEffect, useMemo, useCallback, useRef } from "react";
// import { useRouter } from "next/navigation";
// import { api } from "@/trpc/react";

// // UI компоненты
// import { 
//   Card, 
//   CardBody, 
//   CardHeader,
//   CardFooter
// } from "@heroui/card";
// import { Button } from "@heroui/button";
// import { Input } from "@heroui/input";
// import { 
//   Modal, 
//   ModalContent, 
//   ModalBody, 
//   ModalFooter, 
//   ModalHeader 
// } from "@heroui/modal";
// import { Select, SelectItem } from "@heroui/select";
// import { Pagination } from "@heroui/pagination";
// import { Spinner } from "@heroui/spinner";
// import { Alert } from "@heroui/alert";
// import { Textarea } from "@heroui/input";
// import { Badge } from "@heroui/badge";
// import { Divider } from "@heroui/divider";
// import { Tooltip } from "@heroui/tooltip";
// import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
// import { Checkbox } from "@heroui/checkbox";
// import { Switch } from "@heroui/switch";
// import { Breadcrumbs, BreadcrumbItem } from "@heroui/breadcrumbs";
// import { 
//   Plus, 
//   Trash, 
//   Edit, 
//   Copy, 
//   Search, 
//   Filter, 
//   Calendar, 
//   CheckCircle, 
//   AlertCircle, 
//   ChevronDown, 
//   ChevronUp, 
//   FileText, 
//   Upload, 
//   Download, 
//   X,
//   Eye,
//   Settings,
//   Save,
//   ArrowRight,
//   ArrowLeft,
//   PlusCircle,
//   RefreshCw,
//   Sliders,
//   MoreVertical,
//   ExternalLink,
//   Info
// } from "lucide-react";

// // Типы данных
// enum ColumnType {
//   TEXT = "TEXT",
//   NUMBER = "NUMBER",
//   DATE = "DATE",
//   DATETIME = "DATETIME",
//   BOOLEAN = "BOOLEAN",
//   SELECT = "SELECT",
//   BUTTON = "BUTTON",
//   CALCULATED = "CALCULATED",
//   CURRENCY = "CURRENCY",
//   LINK = "LINK",
//   COMMENT = "COMMENT"
// }

// enum FilterOperator {
//   EQUALS = "EQUALS",
//   NOT_EQUALS = "NOT_EQUALS",
//   GREATER_THAN = "GREATER_THAN",
//   LESS_THAN = "LESS_THAN",
//   GREATER_OR_EQUAL = "GREATER_OR_EQUAL",
//   LESS_OR_EQUAL = "LESS_OR_EQUAL",
//   CONTAINS = "CONTAINS",
//   NOT_CONTAINS = "NOT_CONTAINS",
//   STARTS_WITH = "STARTS_WITH",
//   ENDS_WITH = "ENDS_WITH",
//   BETWEEN = "BETWEEN",
//   IN_LIST = "IN_LIST"
// }

// // Интерфейс страницы просмотра таблицы
// export default function TablePage({ params }: { params: { id: string } }) {
//   const router = useRouter();
//   const tableId = parseInt(params.id);
  
//   // Состояние темной темы
//   const [isDarkMode, setIsDarkMode] = useState(false);
  
//   // Основные состояния
//   const [searchQuery, setSearchQuery] = useState("");
//   const [currentPage, setCurrentPage] = useState(1);
//   const [filters, setFilters] = useState<any[]>([]);
//   const [sortColumn, setSortColumn] = useState<number | null>(null);
//   const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
//   // Состояния для редактирования ячеек
//   const [editingCell, setEditingCell] = useState<{rowId: number, columnId: number, value: string} | null>(null);
//   const [newRowData, setNewRowData] = useState<Record<number, string>>({});
//   const [isAddRowModalOpen, setIsAddRowModalOpen] = useState(false);
  
//   // Состояния для фильтрации
//   const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
//   const [activeFilters, setActiveFilters] = useState<any[]>([]);
//   const [newFilter, setNewFilter] = useState<{
//     columnId: number | null;
//     operator: FilterOperator;
//     value: string;
//     secondValue: string;
//   }>({
//     columnId: null,
//     operator: FilterOperator.EQUALS,
//     value: "",
//     secondValue: ""
//   });
  
//   // Состояния для импорта/экспорта
//   const [isImportModalOpen, setIsImportModalOpen] = useState(false);
//   const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  
//   // Состояние для комментариев
//   const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
//   const [selectedCell, setSelectedCell] = useState<{rowId: number, columnId: number, cellId: number} | null>(null);
//   const [newComment, setNewComment] = useState("");
  
//   // Состояние для уведомлений
//   const [alert, setAlert] = useState({
//     isVisible: false,
//     title: "",
//     message: "",
//     type: "success" as "success" | "error" | "info" | "warning"
//   });
  
//   // TRPC запросы
//   const tableDetailsQuery = api.sections.getTableById.useQuery({ id: tableId });
  
//   const tableDataQuery = api.sections.getTableData.useQuery({
//     tableId,
//     page: currentPage,
//     pageSize: tableDetailsQuery.data?.table?.pageSize || 10,
//     searchQuery: searchQuery || undefined,
//     filters: activeFilters.length > 0 ? activeFilters : undefined,
//     sortColumn: sortColumn || undefined,
//     sortDirection
//   });
  
//   const commentsQuery = api.sections.getCellComments.useQuery(
//     { cellId: selectedCell?.cellId || 0 },
//     { enabled: !!selectedCell?.cellId }
//   );
  
//   // Мутации для CRUD операций
//   const createRowMutation = api.sections.createRow.useMutation({
//     onSuccess: () => {
//       showAlert("Успешно", "Строка успешно добавлена", "success");
//       setIsAddRowModalOpen(false);
//       setNewRowData({});
//       tableDataQuery.refetch();
//     },
//     onError: (error) => {
//       showAlert("Ошибка", `Ошибка при добавлении строки: ${error.message}`, "error");
//     }
//   });
  
//   const updateCellsMutation = api.sections.updateCells.useMutation({
//     onSuccess: () => {
//       tableDataQuery.refetch();
//     },
//     onError: (error) => {
//       showAlert("Ошибка", `Ошибка при обновлении ячейки: ${error.message}`, "error");
//     }
//   });
  
//   const deleteRowMutation = api.sections.deleteRow.useMutation({
//     onSuccess: () => {
//       showAlert("Успешно", "Строка успешно удалена", "success");
//       tableDataQuery.refetch();
//     },
//     onError: (error) => {
//       showAlert("Ошибка", `Ошибка при удалении строки: ${error.message}`, "error");
//     }
//   });
  
//   const addCommentMutation = api.sections.addComment.useMutation({
//     onSuccess: () => {
//       showAlert("Успешно", "Комментарий добавлен", "success");
//       setNewComment("");
//       if (selectedCell) {
//         commentsQuery.refetch();
//       }
//     },
//     onError: (error) => {
//       showAlert("Ошибка", `Ошибка при добавлении комментария: ${error.message}`, "error");
//     }
//   });
  
//   // Реактивные состояния
//   const sectionName = useMemo(() => {
//     return tableDetailsQuery.data?.table?.section?.name || "Раздел";
//   }, [tableDetailsQuery.data]);
  
//   const tableName = useMemo(() => {
//     return tableDetailsQuery.data?.table?.name || "Таблица";
//   }, [tableDetailsQuery.data]);
  
//   const columns = useMemo(() => {
//     return tableDetailsQuery.data?.table?.columns || [];
//   }, [tableDetailsQuery.data]);
  
//   const rows = useMemo(() => {
//     return tableDataQuery.data?.rows || [];
//   }, [tableDataQuery.data]);
  
//   // Вычисление значений для вычисляемых колонок
//   const evaluateFormula = useCallback((formula: string, rowData: any) => {
//     try {
//       // Простое вычисление формулы, замена [колонка] на значение из rowData
//       let evaluatableFormula = formula;
      
//       // Находим все ссылки на колонки в формате [название_колонки]
//       const colRefs = formula.match(/\[([^\]]+)\]/g);
      
//       if (!colRefs) return formula;
      
//       // Для каждой ссылки на колонку
//       colRefs.forEach(colRef => {
//         const colName = colRef.slice(1, -1); // Убираем скобки
//         const column = columns.find(c => c.name === colName);
        
//         if (column && rowData) {
//           const cell = rowData.cells.find((c: any) => c.columnId === column.id);
//           if (cell) {
//             // Заменяем [колонка] на значение
//             const cellValue = parseFloat(cell.value || '0');
//             evaluatableFormula = evaluatableFormula.replace(colRef, isNaN(cellValue) ? '0' : cellValue.toString());
//           } else {
//             evaluatableFormula = evaluatableFormula.replace(colRef, '0');
//           }
//         }
//       });
      
//       // Вычисляем выражение (в реальном проекте лучше использовать безопасные библиотеки)
//       // eslint-disable-next-line no-eval
//       const result = eval(evaluatableFormula);
//       return isNaN(result) ? '0' : result.toString();
//     } catch (error) {
//       console.error("Error evaluating formula:", error);
//       return "Ошибка";
//     }
//   }, [columns]);
  
//   // Функция для получения записи для добавляемой строки с учетом обязательных полей
//   const getDefaultRowRecord = useCallback(() => {
//     const defaultRowData: Record<number, string> = {};
    
//     if (columns) {
//       columns.forEach(column => {
//         // Устанавливаем значения по умолчанию или пустые строки для обязательных полей
//         defaultRowData[column.id] = column.defaultValue || '';
//       });
//     }
    
//     return defaultRowData;
//   }, [columns]);
  
//   // Управление темной темой
//   useEffect(() => {
//     const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
//     const savedTheme = localStorage.getItem('theme');
    
//     if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
//       setIsDarkMode(true);
//       document.documentElement.classList.add('dark');
//     }
    
//     const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
//     const handleChange = (e: MediaQueryListEvent) => {
//       if (!localStorage.getItem('theme')) {
//         setIsDarkMode(e.matches);
//         document.documentElement.classList.toggle('dark', e.matches);
//       }
//     };
    
//     mediaQuery.addEventListener('change', handleChange);
//     return () => mediaQuery.removeEventListener('change', handleChange);
//   }, []);
  
//   // Инициализация формы новой строки при открытии модального окна
//   useEffect(() => {
//     if (isAddRowModalOpen) {
//       setNewRowData(getDefaultRowRecord());
//     }
//   }, [isAddRowModalOpen, getDefaultRowRecord]);
  
//   // Обработчики
//   const showAlert = (title: string, message: string, type: "success" | "error" | "info" | "warning") => {
//     setAlert({
//       isVisible: true,
//       title,
//       message,
//       type
//     });
    
//     setTimeout(() => {
//       setAlert(prev => ({ ...prev, isVisible: false }));
//     }, 5000);
//   };
  
//   const toggleTheme = () => {
//     setIsDarkMode(!isDarkMode);
//     if (!isDarkMode) {
//       document.documentElement.classList.add('dark');
//       localStorage.setItem('theme', 'dark');
//     } else {
//       document.documentElement.classList.remove('dark');
//       localStorage.setItem('theme', 'light');
//     }
//   };
  
//   // Обработчики для сортировки
//   const handleSort = (columnId: number) => {
//     if (sortColumn === columnId) {
//       // Меняем направление сортировки
//       setSortDirection(prev => prev === "asc" ? "desc" : "asc");
//     } else {
//       // Устанавливаем новую колонку для сортировки
//       setSortColumn(columnId);
//       setSortDirection("asc");
//     }
//   };
  
//   // Обработчики для редактирования
//   const handleCellClick = (rowId: number, columnId: number, value: string, cellId: number) => {
//     const column = columns.find(col => col.id === columnId);
    
//     if (column) {
//       // Разные действия в зависимости от типа колонки
//       if (column.type === ColumnType.COMMENT) {
//         setSelectedCell({ rowId, columnId, cellId });
//         setIsCommentModalOpen(true);
//       } else if (column.type === ColumnType.BUTTON) {
//         // Обработка нажатия на кнопку
//         const options = typeof column.options === 'string' ? JSON.parse(column.options) : column.options;
        
//         if (options?.action === "link" && options?.url) {
//           // Открываем ссылку
//           window.open(options.url, options.newTab ? "_blank" : "_self");
//         } else {
//           // По умолчанию открываем диалог с деталями строки
//           // Можно добавить свою логику
//         }
//       } else if (column.type !== ColumnType.CALCULATED) {
//         // Для всех остальных типов, кроме вычисляемых полей
//         setEditingCell({ rowId, columnId, value });
//       }
//     }
//   };
  
//   const handleCellUpdate = async (event: React.KeyboardEvent) => {
//     if (!editingCell) return;
    
//     if (event.key === 'Enter') {
//       // Отправляем обновление на сервер
//       try {
//         await updateCellsMutation.mutateAsync({
//           rowId: editingCell.rowId,
//           cells: [
//             {
//               columnId: editingCell.columnId,
//               value: editingCell.value
//             }
//           ]
//         });
        
//         // Сбрасываем состояние редактирования
//         setEditingCell(null);
//       } catch (error) {
//         console.error("Ошибка при обновлении ячейки:", error);
//       }
//     } else if (event.key === 'Escape') {
//       setEditingCell(null);
//     }
//   };
  
//   // Обработчик для добавления строки
//   const handleAddRow = async () => {
//     if (!tableId) return;
    
//     try {
//       // Подготавливаем данные ячеек
//       const cells = Object.entries(newRowData).map(([columnId, value]) => ({
//         columnId: parseInt(columnId),
//         value
//       }));
      
//       // Создаем новую строку
//       await createRowMutation.mutateAsync({
//         tableId,
//         cells
//       });
//     } catch (error) {
//       console.error("Ошибка при добавлении строки:", error);
//     }
//   };
  
//   // Обработчик для удаления строки
//   const handleDeleteRow = async (rowId: number) => {
//     if (confirm("Вы уверены, что хотите удалить эту строку? Это действие нельзя отменить.")) {
//       try {
//         await deleteRowMutation.mutateAsync({ id: rowId });
//       } catch (error) {
//         console.error("Ошибка при удалении строки:", error);
//       }
//     }
//   };
  
//   // Обработчики для фильтров
//   const handleAddFilter = () => {
//     if (!newFilter.columnId) return;
    
//     // Добавляем новый фильтр
//     setActiveFilters([...activeFilters, { ...newFilter }]);
    
//     // Сбрасываем форму фильтра
//     setNewFilter({
//       columnId: null,
//       operator: FilterOperator.EQUALS,
//       value: "",
//       secondValue: ""
//     });
    
//     // Закрываем модальное окно
//     setIsFilterModalOpen(false);
    
//     // Возвращаемся на первую страницу
//     setCurrentPage(1);
//   };
  
//   const handleRemoveFilter = (index: number) => {
//     const updatedFilters = [...activeFilters];
//     updatedFilters.splice(index, 1);
//     setActiveFilters(updatedFilters);
    
//     // Возвращаемся на первую страницу
//     setCurrentPage(1);
//   };
  
//   // Обработчик для добавления комментария
//   const handleAddComment = async () => {
//     if (!selectedCell || !newComment) return;
    
//     try {
//       await addCommentMutation.mutateAsync({
//         cellId: selectedCell.cellId,
//         text: newComment
//       });
//     } catch (error) {
//       console.error("Ошибка при добавлении комментария:", error);
//     }
//   };
  
//   // Обработчик для экспорта таблицы
//   const handleExportTable = async (format: "csv" | "xlsx") => {
//     try {
//       // Вызов API для экспорта
//       const exportResult = await api.sections.exportData.query({
//         tableId,
//         format,
//         filters: activeFilters.length > 0 ? activeFilters : undefined
//       });
      
//       if (exportResult.success && exportResult.data) {
//         // Создаем ссылку для скачивания
//         const link = document.createElement('a');
//         const blob = format === 'csv'
//           ? new Blob([exportResult.data], { type: 'text/csv;charset=utf-8;' })
//           : base64ToBlob(exportResult.data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          
//         const url = URL.createObjectURL(blob);
//         link.href = url;
//         link.download = exportResult.filename || `export_${tableName}_${new Date().toISOString().slice(0, 10)}.${format}`;
//         document.body.appendChild(link);
//         link.click();
//         document.body.removeChild(link);
        
//         showAlert("Успешно", `Таблица экспортирована в формате ${format.toUpperCase()}`, "success");
//       } else {
//         showAlert("Ошибка", "Не удалось экспортировать таблицу", "error");
//       }
//     } catch (error) {
//       console.error("Ошибка при экспорте таблицы:", error);
//       showAlert("Ошибка", "Произошла ошибка при экспорте таблицы", "error");
//     }
//   };
  
//   // Вспомогательная функция для преобразования base64 в Blob
//   const base64ToBlob = (base64: string, mimeType: string) => {
//     const byteCharacters = atob(base64);
//     const byteArrays = [];
    
//     for (let offset = 0; offset < byteCharacters.length; offset += 512) {
//       const slice = byteCharacters.slice(offset, offset + 512);
      
//       const byteNumbers = new Array(slice.length);
//       for (let i = 0; i < slice.length; i++) {
//         byteNumbers[i] = slice.charCodeAt(i);
//       }
      
//       const byteArray = new Uint8Array(byteNumbers);
//       byteArrays.push(byteArray);
//     }
    
//     return new Blob(byteArrays, { type: mimeType });
//   };
  
//   // Переход в конструктор таблиц
//   const goToTableConstructor = () => {
//     router.push('/table-constructor');
//   };
  
//   // Получение названия оператора фильтра
//   const getFilterOperatorName = (operator: FilterOperator) => {
//     const operatorMap: Record<string, string> = {
//       [FilterOperator.EQUALS]: "Равно",
//       [FilterOperator.NOT_EQUALS]: "Не равно",
//       [FilterOperator.GREATER_THAN]: "Больше",
//       [FilterOperator.LESS_THAN]: "Меньше",
//       [FilterOperator.GREATER_OR_EQUAL]: "Больше или равно",
//       [FilterOperator.LESS_OR_EQUAL]: "Меньше или равно",
//       [FilterOperator.CONTAINS]: "Содержит",
//       [FilterOperator.NOT_CONTAINS]: "Не содержит",
//       [FilterOperator.STARTS_WITH]: "Начинается с",
//       [FilterOperator.ENDS_WITH]: "Заканчивается на",
//       [FilterOperator.BETWEEN]: "Между",
//       [FilterOperator.IN_LIST]: "В списке"
//     };
    
//     return operatorMap[operator] || operator;
//   };
  
//   // Функция для форматирования значения ячейки в зависимости от типа колонки
//   const formatCellValue = (value: string | null, column: any) => {
//     if (value === null || value === undefined) return "—";
    
//     const format = column.format;
//     const options = column.options ? (typeof column.options === 'string' ? JSON.parse(column.options) : column.options) : {};
    
//     switch (column.type) {
//       case ColumnType.DATE:
//         try {
//           const date = new Date(value);
//           if (isNaN(date.getTime())) return value;
          
//           if (format === "DD.MM.YYYY") {
//             return date.toLocaleDateString('ru-RU');
//           } else if (format === "MM/DD/YYYY") {
//             return date.toLocaleDateString('en-US');
//           } else {
//             return date.toISOString().split('T')[0];
//           }
//         } catch (error) {
//           return value;
//         }
        
//       case ColumnType.DATETIME:
//         try {
//           const date = new Date(value);
//           if (isNaN(date.getTime())) return value;
          
//           return date.toLocaleString(format?.includes("DD.MM") ? 'ru-RU' : 'en-GB');
//         } catch (error) {
//           return value;
//         }
        
//       case ColumnType.BOOLEAN:
//         return value === "true" ? "Да" : "Нет";
        
//       case ColumnType.CURRENCY:
//         try {
//           const num = parseFloat(value);
//           if (isNaN(num)) return value;
          
//           const currencyFormat = format || "RUB";
          
//           return new Intl.NumberFormat('ru-RU', { 
//             style: 'currency', 
//             currency: currencyFormat 
//           }).format(num);
//         } catch (error) {
//           return value;
//         }
        
//       default:
//         return value;
//     }
//   };
  
//   return (
//     <div className="container mx-auto py-6 px-4 dark:bg-zinc-900 min-h-screen transition-colors duration-200">
//       {/* Оповещения */}
//       {alert.isVisible && (
//         <div className="fixed top-4 right-4 z-50 w-96">
//           <Alert 
//             isVisible={alert.isVisible}
//             onVisibleChange={(isVisible) => setAlert(prev => ({ ...prev, isVisible }))}
//             variant="solid"
//             color={alert.type === "success" ? "success" : alert.type === "error" ? "danger" : alert.type}
//             title={alert.title}
//             description={alert.message}
//             isClosable={true}
//             icon={alert.type === "success" ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
//           />
//         </div>
//       )}
      
//       {/* Хедер страницы */}
//       <div className="mb-6">
//         <div className="flex justify-between items-center mb-2">
//           <div>
//             <Breadcrumbs>
//               <BreadcrumbItem href="/table-constructor">Разделы</BreadcrumbItem>
//               <BreadcrumbItem href={`/table-constructor?section=${tableDetailsQuery.data?.table?.sectionId}`}>
//                 {sectionName}
//               </BreadcrumbItem>
//               <BreadcrumbItem>{tableName}</BreadcrumbItem>
//             </Breadcrumbs>
            
//             <h1 className="text-2xl font-bold mt-2 dark:text-white">
//               {tableName}
//             </h1>
//             {tableDetailsQuery.data?.table?.description && (
//               <p className="text-gray-500 dark:text-zinc-400 mt-1">
//                 {tableDetailsQuery.data.table.description}
//               </p>
//             )}
//           </div>
          
//           <div className="flex gap-2 items-center">
//             {/* Переключатель темы */}
//             <Button 
//               variant="light" 
//               isIconOnly 
//               onClick={toggleTheme}
//               className="p-2"
//             >
//               {isDarkMode ? (
//                 <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
//                 </svg>
//               ) : (
//                 <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
//                 </svg>
//               )}
//             </Button>
            
//             <Button
//               variant="light"
//               color="default"
//               startIcon={<ArrowLeft className="w-4 h-4" />}
//               onClick={goToTableConstructor}
//             >
//               К конструктору
//             </Button>
            
//             <Button
//               color="primary"
//               startIcon={<Plus className="w-4 h-4" />}
//               onClick={() => setIsAddRowModalOpen(true)}
//             >
//               Добавить запись
//             </Button>
            
//             <Dropdown>
//               <DropdownTrigger>
//                 <Button
//                   color="default"
//                   variant="flat"
//                   endIcon={<ChevronDown className="w-4 h-4" />}
//                 >
//                   Действия
//                 </Button>
//               </DropdownTrigger>
//               <DropdownMenu aria-label="Действия с таблицей">
//                 <DropdownItem 
//                   startContent={<Filter className="w-4 h-4" />}
//                   onClick={() => setIsFilterModalOpen(true)}
//                 >
//                   Настроить фильтры
//                 </DropdownItem>
//                 <DropdownItem 
//                   startContent={<RefreshCw className="w-4 h-4" />}
//                   onClick={() => {
//                     setSearchQuery("");
//                     setActiveFilters([]);
//                     setCurrentPage(1);
//                     tableDataQuery.refetch();
//                   }}
//                 >
//                   Сбросить фильтры
//                 </DropdownItem>
//                 <DropdownItem 
//                   startContent={<Upload className="w-4 h-4" />}
//                   onClick={() => setIsImportModalOpen(true)}
//                 >
//                   Импорт данных
//                 </DropdownItem>
//                 <DropdownItem 
//                   startContent={<Download className="w-4 h-4" />}
//                   onClick={() => handleExportTable("csv")}
//                 >
//                   Экспорт в CSV
//                 </DropdownItem>
//                 <DropdownItem 
//                   startContent={<Download className="w-4 h-4" />}
//                   onClick={() => handleExportTable("xlsx")}
//                 >
//                   Экспорт в Excel
//                 </DropdownItem>
//                 <DropdownItem 
//                   startContent={<Settings className="w-4 h-4" />}
//                   onClick={() => router.push(`/table-constructor?table=${tableId}`)}
//                 >
//                   Настройки таблицы
//                 </DropdownItem>
//               </DropdownMenu>
//             </Dropdown>
//           </div>
//         </div>
        
//         {/* Панель фильтров и поиска */}
//         <div className="flex flex-wrap gap-2 mt-4 items-center">
//           <div className="flex-1 max-w-md">
//             <Input
//               placeholder="Поиск..."
//               value={searchQuery}
//               onChange={(e) => setSearchQuery(e.target.value)}
//               startContent={<Search className="w-4 h-4 text-gray-400" />}
//               endContent={
//                 searchQuery ? (
//                   <Button 
//                     size="sm" 
//                     variant="light" 
//                     isIconOnly 
//                     onClick={() => setSearchQuery("")}
//                     className="p-0"
//                   >
//                     <X className="w-4 h-4" />
//                   </Button>
//                 ) : null
//               }
//               className="dark:bg-zinc-800"
//             />
//           </div>
          
//           {/* Активные фильтры */}
//           {activeFilters.length > 0 && (
//             <div className="flex flex-wrap gap-2 items-center">
//               <span className="text-sm text-gray-500 dark:text-zinc-400">Фильтры:</span>
//               {activeFilters.map((filter, index) => {
//                 const column = columns.find(col => col.id === filter.columnId);
//                 if (!column) return null;
                
//                 return (
//                   <Badge 
//                     key={index} 
//                     color="primary" 
//                     variant="flat"
//                     className="px-2 py-1"
//                   >
//                     <div className="flex items-center gap-2">
//                       <span>{column.name}</span>
//                       <span>{getFilterOperatorName(filter.operator)}</span>
//                       <span className="font-medium">{filter.value}</span>
//                       {filter.operator === FilterOperator.BETWEEN && filter.secondValue && (
//                         <>
//                           <span>и</span>
//                           <span className="font-medium">{filter.secondValue}</span>
//                         </>
//                       )}
//                       <Button
//                         size="sm"
//                         isIconOnly
//                         variant="light"
//                         className="ml-2 p-0 min-w-0 w-4 h-4"
//                         onClick={() => handleRemoveFilter(index)}
//                       >
//                         <X className="w-3 h-3" />
//                       </Button>
//                     </div>
//                   </Badge>
//                 );
//               })}
              
//               <Button
//                 size="sm"
//                 variant="light"
//                 color="default"
//                 onClick={() => setActiveFilters([])}
//               >
//                 Сбросить все
//               </Button>
//             </div>
//           )}
          
//           {activeFilters.length === 0 && (
//             <Button
//               variant="flat"
//               color="default"
//               startIcon={<Filter className="w-4 h-4" />}
//               onClick={() => setIsFilterModalOpen(true)}
//               size="sm"
//             >
//               Фильтры
//             </Button>
//           )}
//         </div>
//       </div>
      
//       {/* Основное содержимое - таблица */}
//       <Card className="dark:bg-zinc-800 border dark:border-zinc-700">
//         <CardBody className="p-0">
//           {tableDataQuery.isLoading || tableDetailsQuery.isLoading ? (
//             <div className="flex justify-center items-center py-16">
//               <Spinner size="lg" color="primary" />
//             </div>
//           ) : (
//             <div className="overflow-x-auto">
//               <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
//                 <thead className="bg-gray-50 dark:bg-zinc-700">
//                   <tr>
//                     {columns.map((column) => (
//                       <th 
//                         key={column.id} 
//                         className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-600"
//                         style={{ width: `${column.width || 200}px` }}
//                         onClick={() => column.type !== ColumnType.BUTTON && handleSort(column.id)}
//                       >
//                         <div className="flex items-center justify-between">
//                           <div className="flex items-center gap-2">
//                             {column.type === ColumnType.NUMBER || column.type === ColumnType.CURRENCY ? (
//                               <span className="text-xs font-mono">#</span>
//                             ) : column.type === ColumnType.DATE || column.type === ColumnType.DATETIME ? (
//                               <Calendar className="w-3 h-3" />
//                             ) : null}
//                             <span>{column.name}</span>
//                           </div>
                          
//                           {sortColumn === column.id && (
//                             <div>
//                               {sortDirection === "asc" ? (
//                                 <ChevronUp className="w-4 h-4" />
//                               ) : (
//                                 <ChevronDown className="w-4 h-4" />
//                               )}
//                             </div>
//                           )}
//                         </div>
//                       </th>
//                     ))}
//                     <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-300 uppercase tracking-wider w-[100px]">
//                       Действия
//                     </th>
//                   </tr>
//                 </thead>
                
//                 <tbody className="bg-white dark:bg-zinc-800 divide-y divide-gray-200 dark:divide-zinc-700">
//                   {rows.length === 0 ? (
//                     <tr>
//                       <td colSpan={columns.length + 1} className="px-3 py-8 text-center text-gray-500 dark:text-zinc-400">
//                         <div className="flex flex-col items-center justify-center space-y-4">
//                           <FileText className="w-12 h-12 text-gray-300 dark:text-zinc-600" />
//                           <div>Нет данных для отображения</div>
//                           <Button
//                             color="primary"
//                             variant="flat"
//                             className="mt-4"
//                             startIcon={<Plus className="w-4 h-4" />}
//                             onClick={() => setIsAddRowModalOpen(true)}
//                           >
//                             Добавить запись
//                           </Button>
//                         </div>
//                       </td>
//                     </tr>
//                   ) : (
//                     rows.map((row) => (
//                       <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-zinc-700">
//                         {columns.map((column) => {
//                           const cell = row.cells.find(c => c.columnId === column.id);
                          
//                           // Если это формула, вычисляем значение
//                           if (column.type === ColumnType.CALCULATED && column.options?.formula) {
//                             const calculatedValue = evaluateFormula(column.options.formula, row);
                            
//                             return (
//                               <td key={column.id} className="px-3 py-2 text-sm dark:text-zinc-300">
//                                 <div className="font-mono text-emerald-600 dark:text-emerald-400">
//                                   {calculatedValue}
//                                 </div>
//                               </td>
//                             );
//                           }
                          
//                           // Редактируемая ячейка
//                           if (editingCell && editingCell.rowId === row.id && editingCell.columnId === column.id) {
//                             return (
//                               <td key={column.id} className="px-3 py-2 relative">
//                                 {column.type === ColumnType.BOOLEAN ? (
//                                   <Switch 
//                                     isSelected={editingCell.value === "true"} 
//                                     onValueChange={(checked) => {
//                                       setEditingCell({...editingCell, value: checked.toString()});
//                                       // Сразу вызываем обновление
//                                       updateCellsMutation.mutateAsync({
//                                         rowId: editingCell.rowId,
//                                         cells: [{ columnId: editingCell.columnId, value: checked.toString() }]
//                                       }).then(() => {
//                                         setEditingCell(null);
//                                         tableDataQuery.refetch();
//                                       });
//                                     }}
//                                   />
//                                 ) : column.type === ColumnType.SELECT && column.options?.values ? (
//                                   <Select
//                                     autoFocus
//                                     value={editingCell.value}
//                                     onChange={(e) => setEditingCell({...editingCell, value: e.target.value})}
//                                     onBlur={() => setEditingCell(null)}
//                                     className="dark:bg-zinc-700"
//                                   >
//                                     {column.options.values.split(',').map((option: string, idx: number) => (
//                                       <SelectItem key={idx} value={option.trim()}>
//                                         {option.trim()}
//                                       </SelectItem>
//                                     ))}
//                                   </Select>
//                                 ) : column.type === ColumnType.DATE ? (
//                                   <Input
//                                     type="date"
//                                     autoFocus
//                                     value={editingCell.value}
//                                     onChange={(e) => setEditingCell({...editingCell, value: e.target.value})}
//                                     onKeyDown={handleCellUpdate}
//                                     onBlur={() => setEditingCell(null)}
//                                     className="dark:bg-zinc-700"
//                                   />
//                                 ) : column.type === ColumnType.DATETIME ? (
//                                   <Input
//                                     type="datetime-local"
//                                     autoFocus
//                                     value={editingCell.value}
//                                     onChange={(e) => setEditingCell({...editingCell, value: e.target.value})}
//                                     onKeyDown={handleCellUpdate}
//                                     onBlur={() => setEditingCell(null)}
//                                     className="dark:bg-zinc-700"
//                                   />
//                                 ) : column.type === ColumnType.NUMBER || column.type === ColumnType.CURRENCY ? (
//                                   <Input
//                                     type="number"
//                                     step={column.type === ColumnType.CURRENCY ? "0.01" : "1"}
//                                     autoFocus
//                                     value={editingCell.value}
//                                     onChange={(e) => setEditingCell({...editingCell, value: e.target.value})}
//                                     onKeyDown={handleCellUpdate}
//                                     onBlur={() => setEditingCell(null)}
//                                     className="dark:bg-zinc-700"
//                                     startContent={column.type === ColumnType.CURRENCY ? (
//                                       column.format === "USD" ? "$" : 
//                                       column.format === "EUR" ? "€" : 
//                                       "₽"
//                                     ) : null}
//                                   />
//                                 ) : (
//                                   <Input
//                                     autoFocus
//                                     value={editingCell.value}
//                                     onChange={(e) => setEditingCell({...editingCell, value: e.target.value})}
//                                     onKeyDown={handleCellUpdate}
//                                     onBlur={() => setEditingCell(null)}
//                                     className="dark:bg-zinc-700"
//                                   />
//                                 )}
//                               </td>
//                             );
//                           }
                          
//                           // Для кнопки отображаем кнопку
//                           if (column.type === ColumnType.BUTTON) {
//                             const options = column.options ? (typeof column.options === 'string' ? JSON.parse(column.options) : column.options) : {};
                            
//                             return (
//                               <td key={column.id} className="px-3 py-2 text-sm">
//                                 <Button 
//                                   size="sm"
//                                   onClick={() => handleCellClick(row.id, column.id, cell?.value || '', cell?.id || 0)}
//                                 >
//                                   {options.buttonText || "Действие"}
//                                 </Button>
//                               </td>
//                             );
//                           }
                          
//                           // Для логического значения отображаем чекбокс
//                           if (column.type === ColumnType.BOOLEAN) {
//                             return (
//                               <td key={column.id} className="px-3 py-2 text-sm">
//                                 <Switch 
//                                   isSelected={cell?.value === 'true'} 
//                                   onValueChange={(checked) => {
//                                     handleCellClick(row.id, column.id, checked.toString(), cell?.id || 0);
//                                     // Сразу вызываем обновление
//                                     updateCellsMutation.mutateAsync({
//                                       rowId: row.id,
//                                       cells: [{ columnId: column.id, value: checked.toString() }]
//                                     }).then(() => tableDataQuery.refetch());
//                                   }} 
//                                 />
//                               </td>
//                             );
//                           }
                          
//                           // Для ссылки отображаем ссылку
//                           if (column.type === ColumnType.LINK && cell?.value) {
//                             return (
//                               <td key={column.id} className="px-3 py-2 text-sm">
//                                 <a 
//                                   href={cell.value}
//                                   target="_blank"
//                                   rel="noopener noreferrer"
//                                   className="text-blue-500 hover:underline flex items-center gap-1"
//                                   onClick={(e) => e.stopPropagation()}
//                                 >
//                                   {cell.value.length > 30 ? cell.value.substring(0, 30) + '...' : cell.value}
//                                   <ExternalLink className="w-3 h-3" />
//                                 </a>
//                               </td>
//                             );
//                           }
                          
//                           // Для комментария отображаем значение с иконкой комментариев
//                           if (column.type === ColumnType.COMMENT) {
//                             return (
//                               <td 
//                                 key={column.id} 
//                                 className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-600"
//                                 onClick={() => handleCellClick(row.id, column.id, cell?.value || '', cell?.id || 0)}
//                               >
//                                 <div className="flex items-center gap-2">
//                                   <span className="truncate max-w-[200px] dark:text-zinc-300">{cell?.value || "—"}</span>
//                                   {cell?.comments?.length > 0 && (
//                                     <Badge color="secondary" size="sm">
//                                       {cell.comments.length}
//                                     </Badge>
//                                   )}
//                                 </div>
//                               </td>
//                             );
//                           }
                          
//                           // Для всех остальных типов отображаем значение с возможностью редактирования
//                           return (
//                             <td 
//                               key={column.id} 
//                               className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-600 dark:text-zinc-300"
//                               onClick={() => handleCellClick(row.id, column.id, cell?.value || '', cell?.id || 0)}
//                             >
//                               {formatCellValue(cell?.value, column)}
//                             </td>
//                           );
//                         })}
                        
//                         {/* Действия со строкой */}
//                         <td className="px-3 py-2 text-sm">
//                           <div className="flex items-center gap-1">
//                             <Button 
//                               size="sm" 
//                               variant="light" 
//                               color="danger" 
//                               isIconOnly
//                               onClick={() => handleDeleteRow(row.id)}
//                             >
//                               <Trash className="w-4 h-4" />
//                             </Button>
//                           </div>
//                         </td>
//                       </tr>
//                     ))
//                   )}
//                 </tbody>
                
//                 {/* Футер с суммами для числовых колонок */}
//                 {tableDataQuery.data?.summaryData && Object.keys(tableDataQuery.data.summaryData).length > 0 && (
//                   <tfoot className="bg-gray-50 dark:bg-zinc-700 font-semibold">
//                     <tr>
//                       {columns.map((column) => {
//                         if (column.isSummable && tableDataQuery.data?.summaryData[column.id]) {
//                           return (
//                             <td key={column.id} className="px-3 py-2 text-right text-sm dark:text-white">
//                               Итого: {column.type === ColumnType.CURRENCY ? (
//                                 new Intl.NumberFormat('ru-RU', { 
//                                   style: 'currency', 
//                                   currency: column.format || "RUB" 
//                                 }).format(tableDataQuery.data.summaryData[column.id])
//                               ) : (
//                                 tableDataQuery.data.summaryData[column.id].toFixed(2)
//                               )}
//                             </td>
//                           );
//                         }
//                         return <td key={column.id}></td>;
//                       })}
//                       <td></td>
//                     </tr>
//                   </tfoot>
//                 )}
//               </table>
//             </div>
//           )}
//         </CardBody>
        
//         {/* Пагинация */}
//         {tableDetailsQuery.data?.table?.hasPagination && tableDataQuery.data?.pagination.pageCount > 1 && (
//           <CardFooter className="flex justify-between items-center p-4 dark:border-zinc-700">
//             <div className="text-sm text-gray-500 dark:text-zinc-400">
//               Показано {rows.length} из {tableDataQuery.data.pagination.total} записей
//             </div>
//             <Pagination
//               total={tableDataQuery.data.pagination.pageCount}
//               initialPage={currentPage}
//               page={currentPage}
//               onChange={setCurrentPage}
//             />
//           </CardFooter>
//         )}
//       </Card>
      
//       {/* Модальное окно для добавления новой строки */}
//       <Modal 
//         isOpen={isAddRowModalOpen} 
//         onClose={() => setIsAddRowModalOpen(false)} 
//         size="2xl"
//       >
//         <ModalContent className="dark:bg-zinc-800 dark:text-white">
//           <ModalHeader className="dark:border-zinc-700">
//             <h3 className="text-lg font-semibold">
//               Добавление новой записи
//             </h3>
//           </ModalHeader>
          
//           <ModalBody className="dark:text-zinc-300">
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//               {columns.map((column) => {
//                 // Пропускаем вычисляемые поля
//                 if (column.type === ColumnType.CALCULATED) return null;
                
//                 const options = column.options ? (typeof column.options === 'string' ? JSON.parse(column.options) : column.options) : {};
                
//                 return (
//                   <div key={column.id} className="space-y-1">
//                     <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
//                       {column.name} {column.isRequired && <span className="text-red-500">*</span>}
//                     </label>
                    
//                     {column.type === ColumnType.TEXT && (
//                       <Input
//                         value={newRowData[column.id] || ''}
//                         onChange={(e) => setNewRowData({...newRowData, [column.id]: e.target.value})}
//                         className="dark:bg-zinc-700"
//                         isRequired={column.isRequired}
//                       />
//                     )}
                    
//                     {column.type === ColumnType.NUMBER && (
//                       <Input
//                         type="number"
//                         value={newRowData[column.id] || ''}
//                         onChange={(e) => setNewRowData({...newRowData, [column.id]: e.target.value})}
//                         className="dark:bg-zinc-700"
//                         isRequired={column.isRequired}
//                       />
//                     )}
                    
//                     {column.type === ColumnType.DATE && (
//                       <Input
//                         type="date"
//                         value={newRowData[column.id] || ''}
//                         onChange={(e) => setNewRowData({...newRowData, [column.id]: e.target.value})}
//                         className="dark:bg-zinc-700"
//                         isRequired={column.isRequired}
//                       />
//                     )}
                    
//                     {column.type === ColumnType.DATETIME && (
//                       <Input
//                         type="datetime-local"
//                         value={newRowData[column.id] || ''}
//                         onChange={(e) => setNewRowData({...newRowData, [column.id]: e.target.value})}
//                         className="dark:bg-zinc-700"
//                         isRequired={column.isRequired}
//                       />
//                     )}
                    
//                     {column.type === ColumnType.BOOLEAN && (
//                       <div className="flex items-center">
//                         <Switch
//                           isSelected={newRowData[column.id] === 'true'}
//                           onValueChange={(checked) => setNewRowData({...newRowData, [column.id]: checked.toString()})}
//                         />
//                         <span className="ml-2">
//                           {newRowData[column.id] === 'true' ? 'Да' : 'Нет'}
//                         </span>
//                       </div>
//                     )}
                    
//                     {column.type === ColumnType.SELECT && options.values && (
//                       <Select
//                         value={newRowData[column.id] || ''}
//                         onChange={(e) => setNewRowData({...newRowData, [column.id]: e.target.value})}
//                         className="dark:bg-zinc-700"
//                         isRequired={column.isRequired}
//                       >
//                         <SelectItem value="">Выберите значение</SelectItem>
//                         {options.values.split(',').map((option: string, idx: number) => (
//                           <SelectItem key={idx} value={option.trim()}>
//                             {option.trim()}
//                           </SelectItem>
//                         ))}
//                       </Select>
//                     )}
                    
//                     {column.type === ColumnType.BUTTON && (
//                       <Input
//                         value={newRowData[column.id] || options.buttonText || 'Действие'}
//                         onChange={(e) => setNewRowData({...newRowData, [column.id]: e.target.value})}
//                         className="dark:bg-zinc-700"
//                         placeholder="Текст кнопки"
//                       />
//                     )}
                    
//                     {column.type === ColumnType.CURRENCY && (
//                       <Input
//                         type="number"
//                         step="0.01"
//                         value={newRowData[column.id] || ''}
//                         onChange={(e) => setNewRowData({...newRowData, [column.id]: e.target.value})}
//                         startContent={
//                           column.format === "USD" ? "$" : 
//                           column.format === "EUR" ? "€" : 
//                           "₽"
//                         }
//                         className="dark:bg-zinc-700"
//                         isRequired={column.isRequired}
//                       />
//                     )}
                    
//                     {column.type === ColumnType.LINK && (
//                       <Input
//                         type="url"
//                         value={newRowData[column.id] || ''}
//                         onChange={(e) => setNewRowData({...newRowData, [column.id]: e.target.value})}
//                         placeholder="https://example.com"
//                         className="dark:bg-zinc-700"
//                         isRequired={column.isRequired}
//                       />
//                     )}
                    
//                     {column.type === ColumnType.COMMENT && (
//                       <Textarea
//                         value={newRowData[column.id] || ''}
//                         onChange={(e) => setNewRowData({...newRowData, [column.id]: e.target.value})}
//                         className="dark:bg-zinc-700"
//                         isRequired={column.isRequired}
//                       />
//                     )}
//                   </div>
//                 );
//               })}
//             </div>
//           </ModalBody>
          
//           <ModalFooter>
//             <Button
//               variant="flat"
//               color="default"
//               onClick={() => setIsAddRowModalOpen(false)}
//             >
//               Отмена
//             </Button>
            
//             <Button
//               color="primary"
//               onClick={handleAddRow}
//               isLoading={createRowMutation.isLoading}
//             >
//               Добавить
//             </Button>
//           </ModalFooter>
//         </ModalContent>
//       </Modal>
      
//       {/* Модальное окно для фильтрации */}
//       <Modal 
//         isOpen={isFilterModalOpen} 
//         onClose={() => setIsFilterModalOpen(false)} 
//         size="lg"
//       >
//         <ModalContent className="dark:bg-zinc-800 dark:text-white">
//           <ModalHeader className="dark:border-zinc-700">
//             <h3 className="text-lg font-semibold">
//               Настройка фильтров
//             </h3>
//           </ModalHeader>
          
//           <ModalBody className="dark:text-zinc-300">
//             <div className="space-y-4">
//               {/* Активные фильтры */}
//               {activeFilters.length > 0 && (
//                 <div className="space-y-2">
//                   <h4 className="font-medium">Активные фильтры</h4>
//                   <div className="flex flex-wrap gap-2">
//                     {activeFilters.map((filter, index) => {
//                       const column = columns.find(col => col.id === filter.columnId);
//                       if (!column) return null;
                      
//                       return (
//                         <Badge 
//                           key={index} 
//                           color="primary" 
//                           variant="flat"
//                           className="px-2 py-1"
//                         >
//                           <div className="flex items-center gap-2">
//                             <span>{column.name}</span>
//                             <span>{getFilterOperatorName(filter.operator)}</span>
//                             <span className="font-medium">{filter.value}</span>
//                             {filter.operator === FilterOperator.BETWEEN && filter.secondValue && (
//                               <>
//                                 <span>и</span>
//                                 <span className="font-medium">{filter.secondValue}</span>
//                               </>
//                             )}
//                             <Button
//                               size="sm"
//                               isIconOnly
//                               variant="light"
//                               className="ml-2 p-0 min-w-0 w-4 h-4"
//                               onClick={() => handleRemoveFilter(index)}
//                             >
//                               <X className="w-3 h-3" />
//                             </Button>
//                           </div>
//                         </Badge>
//                       );
//                     })}
//                   </div>
//                   <Button
//                     size="sm"
//                     variant="flat"
//                     color="danger"
//                     onClick={() => setActiveFilters([])}
//                   >
//                     Сбросить все фильтры
//                   </Button>
//                   <Divider className="my-4" />
//                 </div>
//               )}
              
//               {/* Форма добавления фильтра */}
//               <div className="space-y-4">
//                 <h4 className="font-medium">Добавить фильтр</h4>
                
//                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//                   <div>
//                     <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
//                       Колонка
//                     </label>
//                     <Select
//                       value={newFilter.columnId?.toString() || ""}
//                       onChange={(e) => setNewFilter({ ...newFilter, columnId: parseInt(e.target.value) })}
//                       className="dark:bg-zinc-700"
//                     >
//                       <SelectItem value="">Выберите колонку</SelectItem>
//                       {columns.filter(col => col.isFilterable && col.type !== ColumnType.BUTTON).map((column) => (
//                         <SelectItem key={column.id} value={column.id.toString()}>
//                           {column.name}
//                         </SelectItem>
//                       ))}
//                     </Select>
//                   </div>
                  
//                   <div>
//                     <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
//                       Оператор
//                     </label>
//                     <Select
//                       value={newFilter.operator}
//                       onChange={(e) => setNewFilter({ ...newFilter, operator: e.target.value as FilterOperator })}
//                       className="dark:bg-zinc-700"
//                       isDisabled={!newFilter.columnId}
//                     >
//                       {Object.values(FilterOperator).map((operator) => (
//                         <SelectItem key={operator} value={operator}>
//                           {getFilterOperatorName(operator)}
//                         </SelectItem>
//                       ))}
//                     </Select>
//                   </div>
                  
//                   <div>
//                     <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
//                       Значение
//                     </label>
//                     <Input
//                       value={newFilter.value}
//                       onChange={(e) => setNewFilter({ ...newFilter, value: e.target.value })}
//                       className="dark:bg-zinc-700"
//                       isDisabled={!newFilter.columnId}
//                     />
//                   </div>
                  
//                   {newFilter.operator === FilterOperator.BETWEEN && (
//                     <div>
//                       <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
//                         Второе значение
//                       </label>
//                       <Input
//                         value={newFilter.secondValue}
//                         onChange={(e) => setNewFilter({ ...newFilter, secondValue: e.target.value })}
//                         className="dark:bg-zinc-700"
//                         isDisabled={!newFilter.columnId}
//                       />
//                     </div>
//                   )}
//                 </div>
                
//                 <div className="flex justify-end">
//                   <Button
//                     color="primary"
//                     onClick={handleAddFilter}
//                     isDisabled={!newFilter.columnId || !newFilter.value}
//                   >
//                     Добавить фильтр
//                   </Button>
//                 </div>
//               </div>
//             </div>
//           </ModalBody>
          
//           <ModalFooter>
//             <Button
//               variant="flat"
//               color="default"
//               onClick={() => setIsFilterModalOpen(false)}
//             >
//               Закрыть
//             </Button>
//           </ModalFooter>
//         </ModalContent>
//       </Modal>
      
//       {/* Модальное окно для комментариев */}
//       <Modal 
//         isOpen={isCommentModalOpen} 
//         onClose={() => setIsCommentModalOpen(false)} 
//         size="lg"
//       >
//         <ModalContent className="dark:bg-zinc-800 dark:text-white">
//           <ModalHeader className="dark:border-zinc-700">
//             <h3 className="text-lg font-semibold">
//               Комментарии
//             </h3>
//           </ModalHeader>
          
//           <ModalBody className="dark:text-zinc-300">
//             {commentsQuery.isLoading ? (
//               <div className="flex justify-center items-center py-8">
//                 <Spinner size="md" color="primary" />
//               </div>
//             ) : (
//               <div className="space-y-4">
//                 {/* Текущее значение ячейки */}
//                 {selectedCell && (
//                   <div className="bg-gray-50 dark:bg-zinc-700 p-3 rounded-lg">
//                     <p className="text-sm text-gray-500 dark:text-zinc-400">Текущее значение:</p>
//                     <p className="text-lg font-medium dark:text-white mt-1">
//                       {rows.find(r => r.id === selectedCell.rowId)?.cells.find(c => c.columnId === selectedCell.columnId)?.value || "—"}
//                     </p>
//                   </div>
//                 )}
                
//                 {/* История комментариев */}
//                 <div>
//                   <h4 className="font-medium mb-2">История комментариев</h4>
                  
//                   {commentsQuery.data?.comments.length === 0 ? (
//                     <div className="text-center py-4 text-gray-500 dark:text-zinc-400">
//                       Нет комментариев
//                     </div>
//                   ) : (
//                     <div className="space-y-3 max-h-60 overflow-y-auto">
//                       {commentsQuery.data?.comments.map((comment) => (
//                         <div key={comment.id} className="bg-gray-50 dark:bg-zinc-700 p-3 rounded-lg">
//                           <div className="flex justify-between items-start">
//                             <p className="text-sm">{comment.text}</p>
//                             <p className="text-xs text-gray-500 dark:text-zinc-400">
//                               {new Date(comment.createdAt).toLocaleString()}
//                             </p>
//                           </div>
//                           {comment.author && (
//                             <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
//                               {comment.author}
//                             </p>
//                           )}
//                         </div>
//                       ))}
//                     </div>
//                   )}
//                 </div>
                
//                 {/* Добавление нового комментария */}
//                 <div className="mt-4">
//                   <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
//                     Новый комментарий
//                   </label>
//                   <Textarea
//                     value={newComment}
//                     onChange={(e) => setNewComment(e.target.value)}
//                     placeholder="Введите комментарий"
//                     rows={3}
//                     className="dark:bg-zinc-700"
//                   />
//                 </div>
//               </div>
//             )}
//           </ModalBody>
          
//           <ModalFooter>
//             <Button
//               variant="flat"
//               color="default"
//               onClick={() => setIsCommentModalOpen(false)}
//             >
//               Закрыть
//             </Button>
            
//             <Button
//               color="primary"
//               onClick={handleAddComment}
//               isDisabled={!newComment}
//               isLoading={addCommentMutation.isLoading}
//             >
//               Добавить комментарий
//             </Button>
//           </ModalFooter>
//         </ModalContent>
//       </Modal>
      
//       {/* Модальное окно для импорта данных */}
//       <Modal 
//         isOpen={isImportModalOpen} 
//         onClose={() => setIsImportModalOpen(false)} 
//         size="lg"
//       >
//         <ModalContent className="dark:bg-zinc-800 dark:text-white">
//           <ModalHeader className="dark:border-zinc-700">
//             <h3 className="text-lg font-semibold">
//               Импорт данных
//             </h3>
//           </ModalHeader>
          
//           <ModalBody className="dark:text-zinc-300">
//             <div className="space-y-4">
//               <div className="border-2 border-dashed border-gray-300 dark:border-zinc-600 rounded-lg p-6 text-center">
//                 <input
//                   type="file"
//                   accept=".csv,.xlsx,.xls"
//                   className="hidden"
//                   id="import-file"
//                 />
//                 <label htmlFor="import-file" className="cursor-pointer">
//                   <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-zinc-500" />
//                   <p className="text-gray-600 dark:text-zinc-300">
//                     Перетащите файл CSV или Excel сюда или <span className="text-primary-500 underline">выберите файл</span>
//                   </p>
//                   <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2">
//                     Поддерживаются файлы CSV, XLS и XLSX
//                   </p>
//                 </label>
//               </div>
              
//               <div className="flex items-center gap-2">
//                 <Checkbox
//                   isSelected={false}
//                   onValueChange={() => {}}
//                 />
//                 <span className="text-sm">Очистить существующие данные перед импортом</span>
//               </div>
              
//               <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
//                 <h4 className="font-medium mb-2 flex items-center gap-2 dark:text-white">
//                   <Info className="w-5 h-5 text-blue-500" />
//                   <span>Инструкции по импорту</span>
//                 </h4>
//                 <ul className="text-sm text-gray-600 dark:text-zinc-300 list-disc pl-5 space-y-1">
//                   <li>Первая строка файла должна содержать заголовки колонок</li>
//                   <li>Колонки в файле должны соответствовать колонкам в таблице</li>
//                   <li>Даты должны быть в формате ГГГГ-ММ-ДД</li>
//                   <li>Для логических значений используйте "true" или "false"</li>
//                 </ul>
//               </div>
//             </div>
//           </ModalBody>
          
//           <ModalFooter>
//             <Button
//               variant="flat"
//               color="default"
//               onClick={() => setIsImportModalOpen(false)}
//             >
//               Отмена
//             </Button>
            
//             <Button
//               color="primary"
//               isDisabled={true}
//             >
//               Импортировать
//             </Button>
//           </ModalFooter>
//         </ModalContent>
//       </Modal>
//     </div>
//   );
// }

// // Компонент для иконки пагинации (не импортируется из Lucide)
// const PaginationIcon = ({ size, className }: { size: number, className?: string }) => {
//   return (
//     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
//       <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
//       <line x1="7" y1="8" x2="17" y2="8" />
//       <line x1="7" y1="12" x2="17" y2="12" />
//       <line x1="7" y1="16" x2="17" y2="16" />
//     </svg>
//   );
// };