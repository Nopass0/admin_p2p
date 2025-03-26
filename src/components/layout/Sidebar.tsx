"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  Users, 
  LayoutDashboard, 
  Settings, 
  DollarSign, 
  Database, 
  ArrowRightLeft, 
  ChevronDown, 
  LogOut,
  Globe
} from "lucide-react";
import { Button } from "@heroui/button";

interface SidebarProps {
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ className }) => {
  const pathname = usePathname();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  const toggleMenu = (menu: string) => {
    setExpandedMenus(prev => 
      prev.includes(menu) 
        ? prev.filter(item => item !== menu) 
        : [...prev, menu]
    );
  };

  const isMenuExpanded = (menu: string) => expandedMenus.includes(menu);

  const isActiveLink = (path: string) => {
    if (path === "/") return pathname === path;
    return pathname.startsWith(path);
  };

  const menuItems = [
    {
      name: "Дашборд",
      path: "/",
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      name: "Пользователи",
      path: "/users",
      icon: <Users className="w-5 h-5" />,
    },
    {
      name: "Транзакции",
      path: "/transactions",
      icon: <DollarSign className="w-5 h-5" />,
    },
    {
      name: "IDEX Кабинеты",
      path: "/idex-cabinets",
      icon: <Globe className="w-5 h-5" />,
    },
    {
      name: "Сопоставление",
      icon: <ArrowRightLeft className="w-5 h-5" />,
      submenu: [
        {
          name: "Запустить сопоставление",
          path: "/matching/run",
        },
        {
          name: "Статистика сопоставлений",
          path: "/matching/stats",
        },
        {
          name: "Все сопоставления",
          path: "/matching/all",
        },
      ],
    },
    {
      name: "Настройки",
      path: "/settings",
      icon: <Settings className="w-5 h-5" />,
    },
  ];

  return (
    <aside className={cn(
      "flex flex-col h-screen bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 w-64 p-4",
      className
    )}>
      <div className="flex items-center gap-2 px-2 py-4">
        <Database className="w-6 h-6 text-primary" />
        <span className="text-xl font-bold text-gray-800 dark:text-white">P2P Админ</span>
      </div>
      
      <nav className="flex-1 mt-4 space-y-1">
        {menuItems.map((item, index) => (
          'submenu' in item ? (
            <div key={index} className="space-y-1">
              <button
                onClick={() => toggleMenu(item.name)}
                className={cn(
                  "flex items-center justify-between w-full px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors",
                  isActiveLink(item.submenu[0].path) && "bg-gray-100 dark:bg-zinc-800 text-primary"
                )}
              >
                <div className="flex items-center gap-2">
                  {item.icon}
                  <span>{item.name}</span>
                </div>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 transition-transform",
                    isMenuExpanded(item.name) && "transform rotate-180"
                  )}
                />
              </button>
              
              {isMenuExpanded(item.name) && (
                <div className="mt-1 pl-10 space-y-1">
                  {item.submenu.map((subItem, subIndex) => (
                    <Link
                      key={subIndex}
                      href={subItem.path}
                      className={cn(
                        "flex items-center px-3 py-2 rounded-md text-sm hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors",
                        isActiveLink(subItem.path) ? "text-primary font-medium" : "text-gray-600 dark:text-gray-400"
                      )}
                    >
                      {subItem.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Link
              key={index}
              href={item.path}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors",
                isActiveLink(item.path)
                  ? "bg-gray-100 dark:bg-zinc-800 text-primary"
                  : "text-gray-600 dark:text-gray-400"
              )}
            >
              {item.icon}
              <span>{item.name}</span>
            </Link>
          )
        ))}
      </nav>
      
      <div className="mt-auto pt-4 border-t border-gray-200 dark:border-zinc-800">
        <Button variant="flat" color="danger" className="w-full justify-start" startIcon={<LogOut className="w-4 h-4" />}>
          Выйти
        </Button>
      </div>
    </aside>
  );
};
