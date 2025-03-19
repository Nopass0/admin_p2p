"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@heroui/button";
import { Card } from "@heroui/card";
import { Badge } from "@heroui/badge";
import { Input } from "@heroui/input";
import { AlertTriangle, Trash, UserPlus } from "lucide-react";
import { TelegramAccount } from "@prisma/client";

interface UserTelegramAccountsTabProps {
  userId: number;
  accounts: TelegramAccount[];
  onUpdate: () => void;
}

export function UserTelegramAccountsTab({ userId, accounts, onUpdate }: UserTelegramAccountsTabProps) {
  const [newTelegramId, setNewTelegramId] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  
  // Мутация для добавления телеграм аккаунта
  const addTelegramAccount = api.users.addTelegramAccount.useMutation({
    onSuccess: () => {
      setNewTelegramId("");
      setNewUsername("");
      setNewFirstName("");
      setNewLastName("");
      onUpdate();
    }
  });
  
  // Мутация для удаления телеграм аккаунта
  const removeTelegramAccount = api.users.removeTelegramAccount.useMutation({
    onSuccess: () => {
      onUpdate();
    }
  });
  
  const handleAddAccount = () => {
    if (!newTelegramId) return;
    
    addTelegramAccount.mutate({
      userId,
      telegramId: newTelegramId,
      username: newUsername || null,
      firstName: newFirstName || null,
      lastName: newLastName || null
    });
  };
  
  const handleRemoveAccount = (accountId: number) => {
    removeTelegramAccount.mutate({ accountId });
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Телеграм аккаунты</h3>
        <Badge variant="flat" color="primary">{accounts.length} аккаунтов</Badge>
      </div>
      
      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <AlertTriangle className="w-10 h-10 text-gray-400 mb-2" />
          <p className="text-center text-gray-500">У пользователя нет привязанных Телеграм аккаунтов</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <Card key={account.id} className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium">
                    {account.username ? `@${account.username}` : "Без имени пользователя"}
                  </div>
                  <div className="text-sm text-gray-500">
                    {account.firstName || ""} {account.lastName || ""}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    ID: {account.telegramId}
                  </div>
                </div>
                <Button 
                  variant="flat"
                  color="danger"
                  size="sm"
                  onClick={() => handleRemoveAccount(account.id)}
                  isLoading={removeTelegramAccount.isPending}
                >
                  <Trash className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      
      <div className="mt-6 pt-4 border-t">
        <h4 className="text-md font-medium mb-3">Добавить новый аккаунт</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Telegram ID <span className="text-red-500">*</span></label>
            <Input
              value={newTelegramId}
              onChange={(e) => setNewTelegramId(e.target.value)}
              placeholder="Например: 123456789"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Имя пользователя</label>
            <Input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Без @, например: username"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Имя</label>
              <Input
                value={newFirstName}
                onChange={(e) => setNewFirstName(e.target.value)}
                placeholder="Имя"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Фамилия</label>
              <Input
                value={newLastName}
                onChange={(e) => setNewLastName(e.target.value)}
                placeholder="Фамилия"
              />
            </div>
          </div>
          <Button
            color="primary"
            onClick={handleAddAccount}
            isLoading={addTelegramAccount.isPending}
            disabled={!newTelegramId}
            className="w-full mt-2"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Добавить аккаунт
          </Button>
        </div>
      </div>
    </div>
  );
}
