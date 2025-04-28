"use client";

import { useState, useEffect } from "react";
import { api } from "@/trpc/react";
import { 
  Card, 
  CardBody, 
  CardHeader,
  CardFooter
} from "@heroui/card";
import { 
  Table, 
  TableHeader, 
  TableColumn, 
  TableBody, 
  TableRow, 
  TableCell 
} from "@heroui/table";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Textarea } from "@heroui/input";
import { 
  Modal, 
  ModalContent, 
  ModalBody, 
  ModalFooter, 
  ModalHeader 
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Pagination } from "@heroui/pagination";
import { Spinner } from "@heroui/spinner";
import { Alert } from "@heroui/alert";
import { Tooltip } from "@heroui/tooltip";
import { 
  Search, 
  Plus, 
  Edit, 
  Trash, 
  Eye, 
  EyeOff, 
  RefreshCw,
  SortAsc,
  SortDesc,
  Copy,
  Moon,
  Sun,
  ChevronDown,
  ChevronUp,
  CheckCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function PasswordsPage() {
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Check system theme preference on load
  useEffect(() => {
    const darkModePreference = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModePreference.matches);
    document.documentElement.classList.toggle('dark', darkModePreference.matches);
    
    // Listen for changes in the color scheme
    const handleChange = (e) => {
      setIsDarkMode(e.matches);
      document.documentElement.classList.toggle('dark', e.matches);
    };
    
    darkModePreference.addEventListener('change', handleChange);
    return () => {
      darkModePreference.removeEventListener('change', handleChange);
    };
  }, []);
  
  // States for pagination and sorting
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [orderBy, setOrderBy] = useState("createdAt");
  const [orderDirection, setOrderDirection] = useState("desc");
  
  // States for modal windows
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    id: 0,
    name: "",
    login: "",
    password: "",
    comment: ""
  });
  
  // Selected password for operations
  const [selectedPassword, setSelectedPassword] = useState(null);
  
  // Alert state
  const [alert, setAlert] = useState({
    show: false,
    message: "",
    type: "info"
  });
  
  // State for password visibility
  const [visiblePasswords, setVisiblePasswords] = useState({});
  
  // State for expanded comments
  const [expandedComments, setExpandedComments] = useState({});
  
  // State for copy feedback
  const [copyFeedback, setCopyFeedback] = useState({});
  
  // Query data
  const passwordsQuery = api.passwords.getAll.useQuery({
    searchQuery,
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: orderBy,
    orderDirection: orderDirection,
  });
  
  // Mutations
  const createPasswordMutation = api.passwords.create.useMutation({
    onSuccess: () => {
      showAlert("Пароль успешно создан", "success");
      setIsCreateModalOpen(false);
      resetForm();
      passwordsQuery.refetch();
    },
    onError: (error) => {
      showAlert(`Ошибка: ${error.message}`, "error");
    }
  });
  
  const updatePasswordMutation = api.passwords.update.useMutation({
    onSuccess: () => {
      showAlert("Пароль успешно обновлен", "success");
      setIsEditModalOpen(false);
      resetForm();
      passwordsQuery.refetch();
    },
    onError: (error) => {
      showAlert(`Ошибка: ${error.message}`, "error");
    }
  });
  
  const deletePasswordMutation = api.passwords.delete.useMutation({
    onSuccess: () => {
      showAlert("Пароль успешно удален", "success");
      setIsDeleteModalOpen(false);
      passwordsQuery.refetch();
    },
    onError: (error) => {
      showAlert(`Ошибка: ${error.message}`, "error");
    }
  });
  
  // Helpers
  const resetForm = () => {
    setFormData({
      id: 0,
      name: "",
      login: "",
      password: "",
      comment: ""
    });
  };
  
  const showAlert = (message, type = "info") => {
    setAlert({
      show: true,
      message,
      type
    });
    
    // Auto-hide alert after 3 seconds
    setTimeout(() => {
      setAlert(prev => ({...prev, show: false}));
    }, 3000);
  };
  
  const handleCreatePassword = () => {
    createPasswordMutation.mutate({
      name: formData.name,
      login: formData.login,
      password: formData.password,
      comment: formData.comment
    });
  };
  
  const handleUpdatePassword = () => {
    updatePasswordMutation.mutate({
      id: formData.id,
      name: formData.name,
      login: formData.login,
      password: formData.password,
      comment: formData.comment
    });
  };
  
  const handleDeletePassword = () => {
    deletePasswordMutation.mutate({ id: formData.id });
  };
  
  const openEditModal = (password) => {
    setFormData({
      id: password.id,
      name: password.name,
      login: password.login || "",
      password: password.password,
      comment: password.comment || ""
    });
    setSelectedPassword(password);
    setIsEditModalOpen(true);
  };
  
  const openDeleteModal = (password) => {
    setFormData({
      id: password.id,
      name: password.name,
      login: password.login || "",
      password: password.password,
      comment: password.comment || ""
    });
    setSelectedPassword(password);
    setIsDeleteModalOpen(true);
  };
  
  const togglePasswordVisibility = (id) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  
  const toggleCommentExpansion = (id) => {
    setExpandedComments(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  
  const copyToClipboard = (text, id, type = "text") => {
    navigator.clipboard.writeText(text);
    
    // Show feedback for this specific item
    setCopyFeedback(prev => ({
      ...prev,
      [id + type]: true
    }));
    
    // Clear feedback after 1.5 seconds
    setTimeout(() => {
      setCopyFeedback(prev => ({
        ...prev,
        [id + type]: false
      }));
    }, 1500);
  };
  
  const toggleSort = (field) => {
    if (orderBy === field) {
      setOrderDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setOrderBy(field);
      setOrderDirection("asc");
    }
  };
  
  const toggleTheme = () => {
    // Toggle dark mode class on the document
    document.documentElement.classList.toggle('dark');
    setIsDarkMode(!isDarkMode);
  };
  
  // Is comment long enough to truncate?
  const isCommentLong = (comment) => {
    return comment && comment.length > 100;
  };
  
  // Format the comment for display
  const formatComment = (comment, id) => {
    if (!comment) return '';
    if (!isCommentLong(comment)) return comment;
    
    return expandedComments[id] ? comment : comment.slice(0, 100) + '...';
  };
  
  // Calculate total pages
  const totalPages = passwordsQuery.data
    ? Math.ceil(passwordsQuery.data.totalCount / pageSize)
    : 0;
  
  return (
    <div className="container mx-auto py-6 px-4 min-h-screen">
      {/* Alert notification */}
      <AnimatePresence>
        {alert.show && (
          <motion.div 
            className="fixed top-4 right-4 z-50 w-full max-w-sm"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Alert variant={alert.type} onClose={() => setAlert(prev => ({...prev, show: false}))}>
              {alert.message}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>
      
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="shadow-lg">
          <CardHeader className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b dark:border-b-zinc-700">
            <div className="flex justify-between w-full items-center">
              <h1 className="text-xl md:text-2xl font-bold">Управление паролями</h1>
              <Button
                size="sm"
                variant="light"
                onClick={toggleTheme}
                startIcon={isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                className="md:hidden"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button 
                color="primary" 
                startIcon={<Plus />}
                onClick={() => setIsCreateModalOpen(true)}
                className="w-full sm:w-auto"
              >
                Добавить пароль
              </Button>

            </div>
          </CardHeader>
          
          <CardBody>
            {/* Filters and Search */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1">
                <Input
                  placeholder="Поиск по названию, логину или комментарию"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  startIcon={<Search />}
                  clearable
                  className="h-10"
                />
              </div>
              
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <Select 
                  value={orderBy}
                  onChange={(e) => setOrderBy(e.target.value)}
                  label="Сортировать по"
                  className="min-w-[160px]"
                >
                  <SelectItem value="name">Названию</SelectItem>
                  <SelectItem value="login">Логину</SelectItem>
                  <SelectItem value="createdAt">Дате создания</SelectItem>
                  <SelectItem value="updatedAt">Дате обновления</SelectItem>
                </Select>
                
                <Tooltip content={orderDirection === "asc" ? "По возрастанию" : "По убыванию"}>
                  <Button
                    color="default"
                    onClick={() => setOrderDirection(prev => prev === "asc" ? "desc" : "asc")}
                    className="h-10 w-10"
                  >
                    {orderDirection === "asc" ? <SortAsc /> : <SortDesc />}
                  </Button>
                </Tooltip>
                
                <Tooltip content="Обновить">
                  <Button
                    color="default"
                    onClick={() => passwordsQuery.refetch()}
                    isLoading={passwordsQuery.isLoading}
                    className="h-10 w-10"
                  >
                    {<RefreshCw />}
                  </Button>
                </Tooltip>
              </div>
            </div>
            
            {/* Table */}
            {passwordsQuery.isLoading ? (
              <div className="flex justify-center items-center h-64">
                <Spinner size="lg" />
              </div>
            ) : passwordsQuery.data?.passwords.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">Нет доступных паролей</p>
                <p className="mt-2">Создайте новый пароль, нажав кнопку "Добавить пароль"</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 px-4">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableColumn className="cursor-pointer" onClick={() => toggleSort("name")}>
                      <div className="flex items-center gap-1">
                        Название
                        {orderBy === "name" && (
                          orderDirection === "asc" ? <SortAsc size={16} /> : <SortDesc size={16} />
                        )}
                      </div>
                    </TableColumn>
                    <TableColumn className="cursor-pointer hidden md:table-cell" onClick={() => toggleSort("login")}>
                      <div className="flex items-center gap-1">
                        Логин
                        {orderBy === "login" && (
                          orderDirection === "asc" ? <SortAsc size={16} /> : <SortDesc size={16} />
                        )}
                      </div>
                    </TableColumn>
                    <TableColumn className="hidden md:table-cell">Пароль</TableColumn>
                    <TableColumn className="hidden lg:table-cell">Комментарий</TableColumn>
                    <TableColumn className="cursor-pointer hidden lg:table-cell" onClick={() => toggleSort("updatedAt")}>
                      <div className="flex items-center gap-1">
                        Обновлено
                        {orderBy === "updatedAt" && (
                          orderDirection === "asc" ? <SortAsc size={16} /> : <SortDesc size={16} />
                        )}
                      </div>
                    </TableColumn>
                    <TableColumn>Действия</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {passwordsQuery.data?.passwords.map((password) => (
                      <TableRow key={password.id}>
                        <TableCell className="font-semibold">{password.name}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          {password.login && (
                            <div className="flex items-center gap-2">
                              <span>{password.login}</span>
                              <Tooltip content={copyFeedback[password.id + 'login'] ? "Скопировано!" : "Копировать логин"}>
                                <Button 
                                  size="sm" 
                                  onClick={() => copyToClipboard(password.login, password.id, 'login')}
                                >
                                  {copyFeedback[password.id + 'login'] ? <CheckCircle size={14} className="text-green-500" /> : <Copy size={14} />}
                                </Button>
                              </Tooltip>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {visiblePasswords[password.id] 
                                ? password.password 
                                : "••••••••••"}
                            </span>
                            <Tooltip content={visiblePasswords[password.id] ? "Скрыть пароль" : "Показать пароль"}>
                              <Button 
                                size="sm" 
                                variant="text" 
                                onClick={() => togglePasswordVisibility(password.id)}
                              >
                                {visiblePasswords[password.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                              </Button>
                            </Tooltip>
                            <Tooltip content={copyFeedback[password.id + 'password'] ? "Скопировано!" : "Копировать пароль"}>
                              <Button 
                                size="sm" 
                                variant="text" 
                                onClick={() => copyToClipboard(password.password, password.id, 'password')}
                              >
                                {copyFeedback[password.id + 'password'] ? <CheckCircle size={14} className="text-green-500" /> : <Copy size={14} />}
                              </Button>
                            </Tooltip>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {password.comment && (
                            <div>
                              <p>{formatComment(password.comment, password.id)}</p>
                              {isCommentLong(password.comment) && (
                                <Button 
                                  size="xs" 
                                  variant="text" 
                                  onClick={() => toggleCommentExpansion(password.id)}
                                  className="mt-1"
                                >
                                  {expandedComments[password.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                  {expandedComments[password.id] ? "Скрыть" : "Читать полностью"}
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {new Date(password.updatedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Tooltip content="Редактировать">
                              <Button 
                                size="sm" 
                                color="primary" 
                                variant="light" 
                                onClick={() => openEditModal(password)}
                              >
                                <Edit size={16} />
                              </Button>
                            </Tooltip>
                            <Tooltip content="Удалить">
                              <Button 
                                size="sm" 
                                color="danger" 
                                variant="light" 
                                onClick={() => openDeleteModal(password)}
                              >
                                <Trash size={16} />
                              </Button>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            
            {/* Mobile View Card Layout for small screens */}
            <div className="md:hidden space-y-4 mt-4">
              {!passwordsQuery.isLoading && passwordsQuery.data?.passwords.map((password) => (
                <Card key={password.id} className="shadow-md">
                  <CardBody className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold text-lg">{password.name}</h3>
                      <div className="flex gap-1">
                        <Button 
                          size="xs" 
                          color="primary" 
                          variant="light" 
                          startIcon={<Edit size={14} />}
                          onClick={() => openEditModal(password)}
                        />
                        <Button 
                          size="xs" 
                          color="danger" 
                          variant="light" 
                          startIcon={<Trash size={14} />}
                          onClick={() => openDeleteModal(password)}
                        />
                      </div>
                    </div>
                    
                    {/* Login section */}
                    {password.login && (
                      <div className="flex justify-between items-center text-sm mb-2 border-b pb-2">
                        <span className="font-medium">Логин:</span>
                        <div className="flex items-center">
                          <span>{password.login}</span>
                          <Button 
                            size="xs" 
                            variant="text" 
                            onClick={() => copyToClipboard(password.login, password.id, 'login')}
                            startIcon={copyFeedback[password.id + 'login'] ? <CheckCircle size={12} className="text-green-500" /> : <Copy size={12} />}
                            className="ml-1"
                          />
                        </div>
                      </div>
                    )}
                    
                    {/* Password section */}
                    <div className="flex justify-between items-center text-sm mb-2 border-b pb-2">
                      <span className="font-medium">Пароль:</span>
                      <div className="flex items-center">
                        <span>
                          {visiblePasswords[password.id] 
                            ? password.password 
                            : "••••••••••"}
                        </span>
                        <Button 
                          size="xs" 
                          variant="text" 
                          onClick={() => togglePasswordVisibility(password.id)}
                          startIcon={visiblePasswords[password.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                          className="ml-1"
                        />
                        <Button 
                          size="xs" 
                          variant="text" 
                          onClick={() => copyToClipboard(password.password, password.id, 'password')}
                          startIcon={copyFeedback[password.id + 'password'] ? <CheckCircle size={12} className="text-green-500" /> : <Copy size={12} />}
                          className="ml-1"
                        />
                      </div>
                    </div>
                    
                    {/* Comment section */}
                    {password.comment && (
                      <div className="mt-3">
                        <span className="font-medium text-sm">Комментарий:</span>
                        <p className="mt-1 text-sm">{formatComment(password.comment, password.id)}</p>
                        {isCommentLong(password.comment) && (
                          <Button 
                            size="xs" 
                            variant="text" 
                            onClick={() => toggleCommentExpansion(password.id)}
                            endIcon={expandedComments[password.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            className="mt-1"
                          >
                            {expandedComments[password.id] ? "Скрыть" : "Читать полностью"}
                          </Button>
                        )}
                      </div>
                    )}
                    
                    {/* Updated date */}
                    <div className="text-xs text-gray-500 mt-3">
                      Обновлено: {new Date(password.updatedAt).toLocaleDateString()}
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex justify-center">
                <Pagination
                  total={totalPages}
                  initialPage={page}
                  onChange={(newPage) => setPage(newPage)}
                />
              </div>
            )}
          </CardBody>
        </Card>
      </motion.div>
      
      {/* Create Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}>
        <ModalContent>
          <ModalHeader>Добавить новый пароль</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input
                label="Название"
                placeholder="Введите название"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
              <Input
                label="Логин"
                placeholder="Введите логин"
                value={formData.login}
                onChange={(e) => setFormData({...formData, login: e.target.value})}
              />
              <Input
                label="Пароль"
                placeholder="Введите пароль"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                type={"text"}
                endIcon={
                  <Button 
                    variant="text" 
                    onClick={() => togglePasswordVisibility(-1)}
                    startIcon={visiblePasswords[-1] ? <EyeOff size={16} /> : <Eye size={16} />}
                  />
                }
                required
              />
              <Textarea
                label="Комментарий"
                placeholder="Введите комментарий"
                value={formData.comment}
                onChange={(e) => setFormData({...formData, comment: e.target.value})}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button 
              color="default" 
              onClick={() => setIsCreateModalOpen(false)}
            >
              Отмена
            </Button>
            <Button 
              color="primary" 
              onClick={handleCreatePassword}
              isLoading={createPasswordMutation.isLoading}
            >
              Создать
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Edit Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)}>
        <ModalContent>
          <ModalHeader>Редактировать пароль</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input
                label="Название"
                placeholder="Введите название"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
              <Input
                label="Логин"
                placeholder="Введите логин"
                value={formData.login}
                onChange={(e) => setFormData({...formData, login: e.target.value})}
              />
              <Input
                label="Пароль"
                placeholder="Введите пароль"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                type={"text"}
                endIcon={
                  <Button 
                    variant="text" 
                    onClick={() => togglePasswordVisibility(-2)}
                    startIcon={visiblePasswords[-2] ? <EyeOff size={16} /> : <Eye size={16} />}
                  />
                }
                required
              />
              <Textarea
                label="Комментарий"
                placeholder="Введите комментарий"
                value={formData.comment}
                onChange={(e) => setFormData({...formData, comment: e.target.value})}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button 
              color="default" 
              onClick={() => setIsEditModalOpen(false)}
            >
              Отмена
            </Button>
            <Button 
              color="primary" 
              onClick={handleUpdatePassword}
              isLoading={updatePasswordMutation.isLoading}
            >
              Сохранить
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Delete Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)}>
        <ModalContent>
          <ModalHeader>Удалить пароль</ModalHeader>
          <ModalBody>
            <p>Вы уверены, что хотите удалить пароль "{selectedPassword?.name}"?</p>
            <p className="text-red-500 mt-2">Это действие нельзя отменить.</p>
          </ModalBody>
          <ModalFooter>
            <Button 
              color="default" 
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Отмена
            </Button>
            <Button 
              color="danger" 
              onClick={handleDeletePassword}
              isLoading={deletePasswordMutation.isLoading}
            >
              Удалить
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}