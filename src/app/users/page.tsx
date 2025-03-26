"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/trpc/react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Spinner } from "@heroui/spinner";
import { UsersTable } from "@/components/dashboard/UsersTable";
import { Search, PlusIcon } from "lucide-react";

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Управление пользователями</h1>
        <Link href="/users/create">
          <Button color="primary">
            <PlusIcon className="w-4 h-4 mr-2" />
            Добавить пользователя
          </Button>
        </Link>
      </div>
      
      <div className="mb-6">
        <div className="flex gap-2">
          <div className="flex-grow">
            <Input
              placeholder="Поиск по имени или коду доступа..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              startContent={<Search className="text-gray-400 w-5 h-5" />}
              className="w-full"
            />
          </div>
          <Button
            color="primary"
            onClick={() => console.log("Поиск по:", searchQuery)}
          >
            Поиск
          </Button>
        </div>
      </div>
      
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm p-6">
        <UsersTable />
      </div>
    </div>
  );
}
