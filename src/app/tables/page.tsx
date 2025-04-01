"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Alert } from "@heroui/alert";
import { PlusCircle, FolderPlus, Edit, Trash2, AlertCircle, CheckCircle, FileText } from "lucide-react";
import Link from "next/link";

export default function TableListPage() {
  const router = useRouter();
  const [error, setError] = useState(null);
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

  // Генерация slug из названия
  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-zа-я0-9\s]/g, "")
      .replace(/\s+/g, "-");
  };

  const handleNewSectionNameChange = (e) => {
    const name = e.target.value;
    setNewSectionName(name);
    setNewSectionSlug(generateSlug(name));
  };

  const handleCreateSection = () => {
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
  };

  const handleCreateTable = () => {
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
  };

  const handleDeleteSection = (section) => {
    setSectionToDelete(section);
    setShowDeleteSection(true);
  };

  const confirmDeleteSection = () => {
    if (sectionToDelete) {
      deleteSectionMutation.mutate({ sectionId: sectionToDelete.id });
    }
  };

  const handleDeleteTable = (table) => {
    setTableToDelete(table);
    setShowDeleteTable(true);
  };

  const confirmDeleteTable = () => {
    if (tableToDelete) {
      deleteTableMutation.mutate({ tableId: tableToDelete.id });
    }
  };

  // Очистка ошибки
  const clearError = () => {
    setError(null);
  };

  // Компонент для модального окна создания раздела
  const CreateSectionModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-xl font-bold">Создать новый раздел</h2>
        
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium">
            Название раздела <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={newSectionName}
            onChange={handleNewSectionNameChange}
            className="w-full rounded-md border border-gray-300 p-2"
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
            onChange={(e) => setNewSectionSlug(e.target.value)}
            className="w-full rounded-md border border-gray-300 p-2"
            placeholder="example-slug"
          />
          <p className="mt-1 text-xs text-gray-500">
            Используется в URL. Только латинские буквы, цифры и дефисы.
          </p>
        </div>
        
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium">
            Описание раздела
          </label>
          <textarea
            value={newSectionDesc}
            onChange={(e) => setNewSectionDesc(e.target.value)}
            className="w-full rounded-md border border-gray-300 p-2"
            placeholder="Опционально"
            rows={3}
          />
        </div>
        
        <div className="flex justify-end space-x-2">
          <Button
            onPress={() => setShowCreateSection(false)}
            variant="outline"
          >
            Отмена
          </Button>
          <Button
            onPress={handleCreateSection}
            disabled={!newSectionName || !newSectionSlug || createSectionMutation.isLoading}
          >
            {createSectionMutation.isLoading ? "Создание..." : "Создать"}
          </Button>
        </div>
      </div>
    </div>
  );

  // Компонент для модального окна создания таблицы
  const CreateTableModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-xl font-bold">Создать новую таблицу</h2>
        
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium">
            Название таблицы <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={newTableName}
            onChange={(e) => setNewTableName(e.target.value)}
            className="w-full rounded-md border border-gray-300 p-2"
            placeholder="Введите название таблицы"
          />
        </div>
        
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium">
            Раздел <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedSectionId || ""}
            onChange={(e) => setSelectedSectionId(Number(e.target.value))}
            className="w-full rounded-md border border-gray-300 p-2"
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
            onChange={(e) => setNewTableDesc(e.target.value)}
            className="w-full rounded-md border border-gray-300 p-2"
            placeholder="Опционально"
            rows={3}
          />
        </div>
        
        <div className="flex justify-end space-x-2">
          <Button 
            onPress={() => setShowCreateTable(false)}
            variant="outline"
          >
            Отмена
          </Button>
          <Button
            onPress={handleCreateTable}
            disabled={!newTableName || !selectedSectionId || createTableMutation.isLoading}
          >
            {createTableMutation.isLoading ? "Создание..." : "Создать"}
          </Button>
        </div>
      </div>
    </div>
  );

  // Модальное окно подтверждения удаления раздела
  const DeleteSectionModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-xl font-bold text-red-600">Удаление раздела</h2>
        
        <p className="mb-4">
          Вы уверены, что хотите удалить раздел "{sectionToDelete?.name}"? 
          {sectionToDelete?.tables.length > 0 ? (
            <span className="mt-2 block font-bold text-red-600">
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
            onPress={() => setShowDeleteSection(false)}
            variant="outline"
          >
            Отмена
          </Button>
          <Button
            onPress={confirmDeleteSection}
            variant="destructive"
            disabled={sectionToDelete?.tables.length > 0 || deleteSectionMutation.isLoading}
          >
            {deleteSectionMutation.isLoading ? "Удаление..." : "Удалить"}
          </Button>
        </div>
      </div>
    </div>
  );

  // Модальное окно подтверждения удаления таблицы
  const DeleteTableModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-xl font-bold text-red-600">Удаление таблицы</h2>
        
        <p className="mb-4">
          Вы уверены, что хотите удалить таблицу "{tableToDelete?.name}"? Это действие удалит все данные таблицы и не может быть отменено.
        </p>
        
        <div className="flex justify-end space-x-2">
          <Button 
            onPress={() => setShowDeleteTable(false)}
            variant="outline"
          >
            Отмена
          </Button>
          <Button
            onPress={confirmDeleteTable}
            variant="destructive"
            disabled={deleteTableMutation.isLoading}
          >
            {deleteTableMutation.isLoading ? "Удаление..." : "Удалить"}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Конструктор таблиц</h1>
        
        <div className="flex space-x-2">
          <Button 
            onPress={() => setShowCreateSection(true)}
            className="flex items-center gap-2"
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
            className="flex items-center gap-2"
            variant="outline"
          >
            <PlusCircle size={18} /> Создать таблицу
          </Button>
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
      {isLoading && (
        <div className="my-8 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          <span className="ml-2">Загрузка...</span>
        </div>
      )}

      {/* Список разделов и таблиц */}
      {!isLoading && sections.length === 0 ? (
        <div className="my-16 flex flex-col items-center justify-center">
          <p className="mb-4 text-lg text-gray-500">Нет доступных разделов</p>
          <Button 
            onPress={() => setShowCreateSection(true)}
            className="flex items-center gap-2"
          >
            <FolderPlus size={18} /> Создать первый раздел
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map(section => (
            <Card key={section.id}>
              <CardHeader className="flex flex-row items-center justify-between bg-gray-50">
                <div>
                  <h2 className="text-xl font-semibold">{section.name}</h2>
                  {section.description && (
                    <p className="text-sm text-gray-500">{section.description}</p>
                  )}
                </div>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onPress={() => {
                      setSelectedSectionId(section.id);
                      setShowCreateTable(true);
                    }}
                    className="flex items-center gap-1"
                  >
                    <PlusCircle size={16} /> Добавить таблицу
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-gray-500 hover:text-red-600"
                    onPress={() => handleDeleteSection(section)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </CardHeader>
              <CardBody>
                {section.tables.length === 0 ? (
                  <div className="my-8 flex flex-col items-center justify-center">
                    <p className="mb-2 text-gray-500">В этом разделе пока нет таблиц</p>
                    <Button 
                      onPress={() => {
                        setSelectedSectionId(section.id);
                        setShowCreateTable(true);
                      }}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1"
                    >
                      <PlusCircle size={16} /> Создать таблицу
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {section.tables.map(table => (
                      <div 
                        key={table.id} 
                        className="flex items-center justify-between rounded-md border border-gray-200 p-3 transition-colors hover:bg-gray-50"
                      >
                        <div>
                          <h3 className="font-medium">{table.name}</h3>
                          {table.description && (
                            <p className="text-sm text-gray-500">{table.description}</p>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          <Link href={`/tables/view/${table.id}`}>
                            <Button variant="outline" size="sm" className="flex items-center gap-1">
                              <FileText size={16} /> Открыть
                            </Button>
                          </Link>
                          <Link href={`/tables/constructor/${table.id}`}>
                            <Button variant="outline" size="sm" className="flex items-center gap-1">
                              <Edit size={16} /> Конструктор
                            </Button>
                          </Link>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-gray-500 hover:text-red-600"
                            onPress={() => handleDeleteTable(table)}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Модальные окна */}
      {showCreateSection && <CreateSectionModal />}
      {showCreateTable && <CreateTableModal />}
      {showDeleteSection && <DeleteSectionModal />}
      {showDeleteTable && <DeleteTableModal />}
    </div>
  );
}