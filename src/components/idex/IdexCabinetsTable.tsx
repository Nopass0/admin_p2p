"use client";

import React from "react";
import { 
  Table, 
  TableHeader, 
  TableColumn, 
  TableBody, 
  TableRow, 
  TableCell 
} from "@heroui/table";
import { Button } from "@heroui/button";
import { Pagination } from "@heroui/pagination";
import { Badge } from "@heroui/badge";
import { Tooltip } from "@heroui/tooltip";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { MoreVertical, Eye, RefreshCw, Trash2 } from "lucide-react";

interface Cabinet {
  id: number;
  idexId: number;
  login: string;
  password: string;
  _count?: {
    transactions: number;
  };
}

interface PaginationInfo {
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

interface IdexCabinetsTableProps {
  cabinets: Cabinet[];
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
  onDelete: (id: number) => void;
  onViewTransactions: (id: number) => void;
  onSync: (id: number) => void;
}

export const IdexCabinetsTable: React.FC<IdexCabinetsTableProps> = ({
  cabinets,
  pagination,
  onPageChange,
  onDelete,
  onViewTransactions,
  onSync
}) => {
  return (
    <div>
      <div className="overflow-x-auto">
        <Table aria-label="IDEX кабинеты">
          <TableHeader>
            <TableColumn>ID</TableColumn>
            <TableColumn>IDEX ID</TableColumn>
            <TableColumn>Логин</TableColumn>
            <TableColumn>Пароль</TableColumn>
            <TableColumn>Транзакции {cabinets.reduce((acc, cabinet) => acc + (cabinet._count?.transactions || 0), 0)}</TableColumn>
            <TableColumn>Действия</TableColumn>
          </TableHeader>
          <TableBody>
            {cabinets.map((cabinet) => (
              <TableRow key={cabinet.id}>
                <TableCell>{cabinet.id}</TableCell>
                <TableCell>{cabinet.idexId}</TableCell>
                <TableCell>{cabinet.login}</TableCell>
                <TableCell>
                  <span className="text-gray-500">**********</span>
                  <Tooltip content={cabinet.password}>
                    <Button variant="flat" size="sm" isIconOnly className="ml-2">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Badge color="primary">
                    {cabinet._count?.transactions || 0}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Dropdown>
                    <DropdownTrigger>
                      <Button variant="flat" size="sm" isIconOnly>
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Действия">
                      <DropdownItem 
                        key="view"
                        onPress={() => onViewTransactions(cabinet.id)}
                      >
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4" />
                          <span>Просмотр транзакций</span>
                        </div>
                      </DropdownItem>
                      <DropdownItem 
                        key="sync"
                        onPress={() => onSync(cabinet.id)}
                      >
                        <div className="flex items-center gap-2">
                          <RefreshCw className="w-4 h-4" />
                          <span>Синхронизировать</span>
                        </div>
                      </DropdownItem>
                      <DropdownItem 
                        key="delete"
                        className="text-danger"
                        onPress={() => onDelete(cabinet.id)}
                      >
                        <div className="flex items-center gap-2">
                          <Trash2 className="w-4 h-4" />
                          <span>Удалить</span>
                        </div>
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {/* Пагинация */}
      <div className="flex justify-between items-center mt-4">
        <div className="text-sm text-gray-500">
          Всего: {pagination.totalCount} кабинетов
        </div>
        <Pagination
          total={pagination.totalPages}
          initialPage={pagination.currentPage}
          onChange={onPageChange}
        />
      </div>
    </div>
  );
};
