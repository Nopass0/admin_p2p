"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Spinner } from "@heroui/spinner";
import { UsersTable } from "@/components/dashboard/UsersTable";
import { Search, PlusIcon, X } from "lucide-react";

export default function UsersPage() {
  // State for search functionality
  const [searchQuery, setSearchQuery] = useState("");

  // State for modal visibility
  const [isModalOpen, setIsModalOpen] = useState(false);

  // State for the new user's name
  const [newUserName, setNewUserName] = useState("");

  // State to show created user details
  const [createdUser, setCreatedUser] = useState(null);

  // tRPC mutation for creating a user
  const createUserMutation = api.users.createUser.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setCreatedUser(data.user);
        setNewUserName("");
      }
    },
  });

  // Function to handle form submission
  const handleCreateUser = (e) => {
    e.preventDefault();
    if (newUserName.trim()) {
      createUserMutation.mutate({ name: newUserName.trim() });
    }
  };

  // Function to close the modal and reset states
  const closeModal = () => {
    setIsModalOpen(false);
    setNewUserName("");
    setCreatedUser(null);
  };

  // Function to handle search
  const handleSearch = () => {
    // Implement search functionality here
    console.log("Поиск по:", searchQuery);
  };

  return (
    <div className="p-6">
      {/* Header with title and add button */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Управление пользователями</h1>
        <Button color="primary" onClick={() => setIsModalOpen(true)}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Добавить пользователя
        </Button>
      </div>

      {/* Users table */}
      <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-zinc-800">
        <UsersTable searchQuery={searchQuery} />
      </div>

      {/* Add User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-zinc-800">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {createdUser ? "Пользователь создан" : "Добавить пользователя"}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!createdUser ? (
              <form onSubmit={handleCreateUser}>
                <div className="mb-4">
                  <label className="mb-1 block text-sm font-medium">
                    Имя пользователя
                  </label>
                  <Input
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="Введите имя пользователя"
                    required
                    autoFocus
                    className="w-full"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" color="default" onClick={closeModal}>
                    Отмена
                  </Button>
                  <Button
                    type="submit"
                    color="primary"
                    disabled={createUserMutation.isLoading}
                  >
                    {createUserMutation.isLoading ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4" />
                        Создание...
                      </>
                    ) : (
                      "Создать пользователя"
                    )}
                  </Button>
                </div>
              </form>
            ) : (
              <div>
                <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                  <p className="mb-2 font-medium">
                    Пользователь успешно создан!
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Имя:</p>
                      <p className="font-medium">{createdUser.name}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">
                        Код доступа:
                      </p>
                      <p className="font-medium">{createdUser.passCode}</p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button color="primary" onClick={closeModal}>
                    Закрыть
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
