"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Alert } from "@heroui/alert";
import { Input } from "@heroui/input";
import { PlusCircle, FolderPlus, Edit, Trash2, AlertCircle, CheckCircle, FileText, Search, Table2, Grid3x3 } from "lucide-react";
import Link from "next/link";

// Выносим модальные окна в отдельные компоненты вне основного компонента
const CreateSectionModal = ({ 
  onClose, 
  newSectionName, 
  setNewSectionName, 
  newSectionSlug, 
  setNewSectionSlug, 
  newSectionDesc, 
  setNewSectionDesc, 
  handleCreateSection, 
  isLoading 
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-zinc-800 dark:text-zinc-100" onClick={e => e.stopPropagation()}>
      <h2 className="mb-4 text-xl font-bold">Создать новый раздел</h2>
      
      <div className="mb-4">
        <label className="mb-2 block text-sm font-medium">
          Название раздела <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={newSectionName}
          onChange={e => setNewSectionName(e.target.value)}
          className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
          placeholder="Введите название раздела"
        />
      </div>
      
      <div className="mb-4">
        <label className="mb-2 block text-sm font-medium">
          URL-идентификатор <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={newSectionSlug}
          onChange={e => setNewSectionSlug(e.target.value)}
          className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
          placeholder="example-slug"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
          Используется в URL. Только латинские буквы, цифры и дефисы.
        </p>
      </div>
      
      <div className="mb-4">
        <label className="mb-2 block text-sm font-medium">
          Описание раздела
        </label>
        <textarea
          value={newSectionDesc}
          onChange={e => setNewSectionDesc(e.target.value)}
          className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
          placeholder="Опционально"
          rows={3}
        />
      </div>
      
      <div className="flex justify-end space-x-2">
        <Button
          onPress={onClose}
          variant="outline"
          className="dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          Отмена
        </Button>
        <Button
          onPress={handleCreateSection}
          disabled={!newSectionName || !newSectionSlug || isLoading}
          className="dark:bg-zinc-600 dark:hover:bg-zinc-500"
        >
          {isLoading ? "Создание..." : "Создать"}
        </Button>
      </div>
    </div>
  </div>
);

const CreateTableModal = ({ 
  onClose, 
  newTableName, 
  setNewTableName, 
  newTableDesc, 
  setNewTableDesc, 
  selectedSectionId, 
  setSelectedSectionId, 
  sections, 
  handleCreateTable, 
  isLoading 
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-zinc-800 dark:text-zinc-100" onClick={e => e.stopPropagation()}>
      <h2 className="mb-4 text-xl font-bold">Создать новую таблицу</h2>
      
      <div className="mb-4">
        <label className="mb-2 block text-sm font-medium">
          Название таблицы <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={newTableName}
          onChange={e => setNewTableName(e.target.value)}
          className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
          placeholder="Введите название таблицы"
        />
      </div>
      
      <div className="mb-4">
        <label className="mb-2 block text-sm font-medium">
          Раздел <span className="text-red-500">*</span>
        </label>
        <select
          value={selectedSectionId || ""}
          onChange={e => setSelectedSectionId(Number(e.target.value))}
          className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
        >
          <option value="">Выберите раздел</option>
          {sections.map(section => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </select>
      </div>
      
      <div className="mb-4">
        <label className="mb-2 block text-sm font-medium">
          Описание таблицы
        </label>
        <textarea
          value={newTableDesc}
          onChange={e => setNewTableDesc(e.target.value)}
          className="w-full rounded-md border border-gray-300 p-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
          placeholder="Опционально"
          rows={3}
        />
      </div>
      
      <div className="flex justify-end space-x-2">
        <Button 
          onPress={onClose}
          variant="outline"
          className="dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          Отмена
        </Button>
        <Button
          onPress={handleCreateTable}
          disabled={!newTableName || !selectedSectionId || isLoading}
          className="dark:bg-zinc-600 dark:hover:bg-zinc-500"
        >
          {isLoading ? "Создание..." : "Создать"}
        </Button>
      </div>
    </div>
  </div>
);

const DeleteSectionModal = ({ onClose, sectionToDelete, confirmDeleteSection, isLoading }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-zinc-800 dark:text-zinc-100" onClick={e => e.stopPropagation()}>
      <h2 className="mb-4 text-xl font-bold text-red-600 dark:text-red-400">Удаление раздела</h2>
      
      <p className="mb-4">
        Вы уверены, что хотите удалить раздел "{sectionToDelete?.name}"? 
        {sectionToDelete?.tables.length > 0 ? (
          <span className="mt-2 block font-bold text-red-600 dark:text-red-400">
            В этом разделе есть {sectionToDelete.tables.length} таблиц. Сначала необходимо удалить или переместить эти таблицы.
          </span>
        ) : (
          <span className="mt-2 block">
            Это действие нельзя отменить.
          </span>
        )}
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
          onPress={confirmDeleteSection}
          variant="destructive"
          disabled={sectionToDelete?.tables.length > 0 || isLoading}
          className="dark:bg-red-700 dark:hover:bg-red-600"
        >
          {isLoading ? "Удаление..." : "Удалить"}
        </Button>
      </div>
    </div>
  </div>
);

const DeleteTableModal = ({ onClose, tableToDelete, confirmDeleteTable, isLoading }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-zinc-800 dark:text-zinc-100" onClick={e => e.stopPropagation()}>
      <h2 className="mb-4 text-xl font-bold text-red-600 dark:text-red-400">Удаление таблицы</h2>
      
      <p className="mb-4">
        Вы уверены, что хотите удалить таблицу "{tableToDelete?.name}"? Это действие удалит все данные таблицы и не может быть отменено.
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
          onPress={confirmDeleteTable}
          variant="destructive"
          disabled={isLoading}
          className="dark:bg-red-700 dark:hover:bg-red-600"
        >
          {isLoading ? "Удаление..." : "Удалить"}
        </Button>
      </div>
    </div>
  </div>
);

// Компонент карточки таблицы
const TableCard = ({ table, section, onDeleteTable }) => (
  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-lg font-medium dark:text-zinc-100">{table.name}</h3>
      <div className="flex items-center gap-1">
        <Button 
          variant="ghost" 
          size="sm"
          className="text-gray-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
          onPress={() => onDeleteTable(table)}
        >
          <Trash2 size={16} />
        </Button>
      </div>
    </div>
    
    {table.description && (
      <p className="mb-3 text-sm text-gray-500 dark:text-zinc-400">{table.description}</p>
    )}
    
    <div className="mt-4 flex justify-between">
      <Link href={`/tables/view/${table.id}`}>
        <Button variant="outline" size="sm" className="flex items-center gap-1 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700">
          <Table2 size={16} /> Просмотр
        </Button>
      </Link>
      <Link href={`/tables/constructor/${table.id}`}>
        <Button size="sm" className="flex items-center gap-1 dark:bg-zinc-700 dark:hover:bg-zinc-600">
          <Edit size={16} /> Конструктор
        </Button>
      </Link>
    </div>
  </div>
);

export default function TableListPage() {
  const router = useRouter();
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateSection, setShowCreateSection] = useState(false);
  const [showCreateTable, setShowCreateTable] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionSlug, setNewSectionSlug] = useState("");
  const [newSectionDesc, setNewSectionDesc] = useState("");
  const [newTableName, setNewTableName] = useState("");
  const [newTableDesc, setNewTableDesc] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [showDeleteSection, setShowDeleteSection] = useState(false);
  const [showDeleteTable, setShowDeleteTable] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState(null);
  const [tableToDelete, setTableToDelete] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");

  // Запрос для получения разделов и таблиц
  const { data: sectionsData, refetch: refetchSections, isLoading } = api.tables.getAllSections.useQuery();
  
  // Получаем секции из данных API или используем пустой массив если данных нет
  const sections = sectionsData?.success ? sectionsData.sections : [];

  // Фильтруем секции на основе поискового запроса
  const filteredSections = useMemo(() => {
    if (!searchTerm.trim()) return sections;
    
    return sections.filter(section => {
      // Поиск по названию раздела
      if (section.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return true;
      }
      
      // Поиск по описанию раздела
      if (section.description?.toLowerCase().includes(searchTerm.toLowerCase())) {
        return true;
      }
      
      // Поиск по названиям таблиц в разделе
      if (section.tables.some(table => 
        table.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        table.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )) {
        return true;
      }
      
      return false;
    });
  }, [sections, searchTerm]);

  // Мутации для создания раздела
  const createSectionMutation = api.tables.createSection.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setSuccessMessage("Раздел успешно создан");
        setShowCreateSection(false);
        setNewSectionName("");
        setNewSectionSlug("");
        setNewSectionDesc("");
        refetchSections();

        // Скрываем сообщение об успехе через 3 секунды
        setTimeout(() => {
          setSuccessMessage("");
        }, 3000);
      } else {
        setError(data.message || "Не удалось создать раздел");
      }
    },
    onError: (error) => {
      setError(error.message || "Произошла ошибка при создании раздела");
    }
  });

  // Мутации для создания таблицы
  const createTableMutation = api.tables.createTable.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setSuccessMessage("Таблица успешно создана");
        setShowCreateTable(false);
        setNewTableName("");
        setNewTableDesc("");
        refetchSections();

        // Перенаправляем на страницу конструктора таблицы
        router.push(`/tables/constructor/${data.table.id}`);
      } else {
        setError(data.message || "Не удалось создать таблицу");
      }
    },
    onError: (error) => {
      setError(error.message || "Произошла ошибка при создании таблицы");
    }
  });

  // Мутации для удаления раздела
  const deleteSectionMutation = api.tables.deleteSection.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setSuccessMessage("Раздел успешно удален");
        setShowDeleteSection(false);
        setSectionToDelete(null);
        refetchSections();

        // Скрываем сообщение об успехе через 3 секунды
        setTimeout(() => {
          setSuccessMessage("");
        }, 3000);
      } else {
        setError(data.message || "Не удалось удалить раздел");
      }
    },
    onError: (error) => {
      setError(error.message || "Произошла ошибка при удалении раздела");
    }
  });

  // Мутации для удаления таблицы
  const deleteTableMutation = api.tables.deleteTable.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setSuccessMessage("Таблица успешно удалена");
        setShowDeleteTable(false);
        setTableToDelete(null);
        refetchSections();

        // Скрываем сообщение об успехе через 3 секунды
        setTimeout(() => {
          setSuccessMessage("");
        }, 3000);
      } else {
        setError(data.message || "Не удалось удалить таблицу");
      }
    },
    onError: (error) => {
      setError(error.message || "Произошла ошибка при удалении таблицы");
    }
  });

  // Генерация slug из названия - используем useCallback для оптимизации
  const generateSlug = useCallback((name) => {
    return name
      .toLowerCase()
      .replace(/[^a-zа-я0-9\s]/g, "")
      .replace(/\s+/g, "-");
  }, []);

  // Исправленная функция - принимает значение, а не событие
  const handleNewSectionNameChange = useCallback((value) => {
    setNewSectionName(value);
    
    // Обновляем slug только если пользователь не изменял его вручную
    if (newSectionSlug === generateSlug(newSectionName)) {
      setNewSectionSlug(generateSlug(value));
    }
  }, [newSectionName, newSectionSlug, generateSlug]);

  const handleCreateSection = useCallback(() => {
    if (!newSectionName || !newSectionSlug) {
      setError("Название и URL-идентификатор обязательны");
      return;
    }

    createSectionMutation.mutate({
      name: newSectionName,
      slug: newSectionSlug,
      description: newSectionDesc,
      isActive: true,
      order: sections.length
    });
  }, [newSectionName, newSectionSlug, newSectionDesc, sections.length, createSectionMutation, setError]);

  const handleCreateTable = useCallback(() => {
    if (!newTableName || !selectedSectionId) {
      setError("Название таблицы и раздел обязательны");
      return;
    }

    createTableMutation.mutate({
      name: newTableName,
      description: newTableDesc,
      sectionId: selectedSectionId,
      isSearchable: true,
      hasPagination: true,
      pageSize: 10,
      order: sections.find(s => s.id === selectedSectionId)?.tables.length || 0
    });
  }, [newTableName, newTableDesc, selectedSectionId, sections, createTableMutation, setError]);

  const handleDeleteSection = useCallback((section) => {
    setSectionToDelete(section);
    setShowDeleteSection(true);
  }, []);

  const confirmDeleteSection = useCallback(() => {
    if (sectionToDelete) {
      deleteSectionMutation.mutate({ sectionId: sectionToDelete.id });
    }
  }, [sectionToDelete, deleteSectionMutation]);

  const handleDeleteTable = useCallback((table) => {
    setTableToDelete(table);
    setShowDeleteTable(true);
  }, []);

  const confirmDeleteTable = useCallback(() => {
    if (tableToDelete) {
      deleteTableMutation.mutate({ tableId: tableToDelete.id });
    }
  }, [tableToDelete, deleteTableMutation]);

  // Очистка ошибки
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 dark:bg-zinc-900 dark:text-zinc-100">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold dark:text-white">Конструктор таблиц</h1>
        
        <div className="flex flex-wrap gap-2">
          <Button 
            onPress={() => setShowCreateSection(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600"
          >
            <FolderPlus size={18} /> Создать раздел
          </Button>
          <Button 
            onPress={() => {
              if (sections.length === 0) {
                setError("Сначала создайте раздел");
                return;
              }
              setSelectedSectionId(sections[0].id);
              setShowCreateTable(true);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
          >
            <PlusCircle size={18} /> Создать таблицу
          </Button>
        </div>
      </div>

      {/* Поиск */}
      <div className="mb-6">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-gray-400 dark:text-zinc-500" />
          </div>
          <Input
            type="text"
            placeholder="Поиск по разделам и таблицам..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-md pl-10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
          />
        </div>
      </div>

      {/* Сообщения об ошибках и успехе */}
      {error && (
        <Alert variant="destructive" className="mb-6 dark:bg-red-900/50 dark:text-red-100 dark:border-red-800">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
          <Button variant="ghost" size="sm" onPress={clearError} className="ml-auto h-6 w-6 p-0 dark:text-zinc-300">×</Button>
        </Alert>
      )}
      
      {successMessage && (
        <Alert variant="success" className="mb-6 dark:bg-green-900/50 dark:text-green-100 dark:border-green-800">
          <CheckCircle className="h-4 w-4" />
          <span>{successMessage}</span>
        </Alert>
      )}

      {/* Загрузка */}
      {isLoading && (
        <div className="my-12 flex items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 dark:border-zinc-700 dark:border-t-blue-500"></div>
          <span className="ml-3 text-lg dark:text-zinc-300">Загрузка...</span>
        </div>
      )}

      {/* Нет разделов */}
      {!isLoading && sections.length === 0 ? (
        <div className="my-16 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-12 text-center dark:border-zinc-700 dark:bg-zinc-800/50">
          <Grid3x3 className="mb-4 h-16 w-16 text-gray-400 dark:text-zinc-600" />
          <p className="mb-4 text-xl text-gray-500 dark:text-zinc-400">Нет доступных разделов</p>
          <Button 
            onPress={() => setShowCreateSection(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600"
          >
            <FolderPlus size={18} /> Создать первый раздел
          </Button>
        </div>
      ) : !isLoading && filteredSections.length === 0 ? (
        <div className="my-12 text-center">
          <p className="text-lg text-gray-500 dark:text-zinc-400">По запросу "{searchTerm}" ничего не найдено</p>
          <Button 
            variant="outline" 
            className="mt-4 dark:border-zinc-700 dark:text-zinc-300" 
            onPress={() => setSearchTerm("")}
          >
            Сбросить поиск
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {filteredSections.map(section => (
            <div key={section.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold dark:text-white">{section.name}</h2>
                  {section.description && (
                    <p className="mt-1 text-gray-500 dark:text-zinc-400">{section.description}</p>
                  )}
                </div>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    onPress={() => {
                      setSelectedSectionId(section.id);
                      setShowCreateTable(true);
                    }}
                    className="flex items-center gap-1 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    <PlusCircle size={16} /> Добавить таблицу
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="text-gray-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
                    onPress={() => handleDeleteSection(section)}
                  >
                    <Trash2 size={18} />
                  </Button>
                </div>
              </div>
              
              {section.tables.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-10 dark:border-zinc-700">
                  <p className="mb-3 text-gray-500 dark:text-zinc-400">В этом разделе пока нет таблиц</p>
                  <Button 
                    onPress={() => {
                      setSelectedSectionId(section.id);
                      setShowCreateTable(true);
                    }}
                    variant="outline"
                    className="flex items-center gap-1 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    <PlusCircle size={16} /> Создать таблицу
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {section.tables.map(table => (
                    <TableCard 
                      key={table.id} 
                      table={table} 
                      section={section}
                      onDeleteTable={handleDeleteTable}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Модальные окна как внешние компоненты с необходимыми пропсами */}
      {showCreateSection && (
        <CreateSectionModal
          onClose={() => setShowCreateSection(false)}
          newSectionName={newSectionName}
          setNewSectionName={value => handleNewSectionNameChange(value)}
          newSectionSlug={newSectionSlug}
          setNewSectionSlug={setNewSectionSlug}
          newSectionDesc={newSectionDesc}
          setNewSectionDesc={setNewSectionDesc}
          handleCreateSection={handleCreateSection}
          isLoading={createSectionMutation.isLoading}
        />
      )}
      
      {showCreateTable && (
        <CreateTableModal
          onClose={() => setShowCreateTable(false)}
          newTableName={newTableName}
          setNewTableName={setNewTableName}
          newTableDesc={newTableDesc}
          setNewTableDesc={setNewTableDesc}
          selectedSectionId={selectedSectionId}
          setSelectedSectionId={setSelectedSectionId}
          sections={sections}
          handleCreateTable={handleCreateTable}
          isLoading={createTableMutation.isLoading}
        />
      )}
      
      {showDeleteSection && (
        <DeleteSectionModal
          onClose={() => setShowDeleteSection(false)}
          sectionToDelete={sectionToDelete}
          confirmDeleteSection={confirmDeleteSection}
          isLoading={deleteSectionMutation.isLoading}
        />
      )}
      
      {showDeleteTable && (
        <DeleteTableModal
          onClose={() => setShowDeleteTable(false)}
          tableToDelete={tableToDelete}
          confirmDeleteTable={confirmDeleteTable}
          isLoading={deleteTableMutation.isLoading}
        />
      )}
    </div>
  );
}