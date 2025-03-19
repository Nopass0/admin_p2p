"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Users, 
  ArrowDownUp, 
  BarChart3, 
  Settings, 
  ChevronRight
} from "lucide-react";

// Элементы навигации
const navigationItems = [
  {
    title: "Панель управления",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Пользователи",
    href: "/users",
    icon: Users,
  },
  {
    title: "Транзакции",
    href: "/transactions",
    icon: ArrowDownUp,
  },
  {
    title: "Статистика",
    href: "/stats",
    icon: BarChart3,
  },
  {
    title: "Настройки",
    href: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside 
      className={cn(
        "min-h-screen bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 transition-all duration-300",
        isCollapsed ? "w-[60px]" : "w-[250px]"
      )}
    >
      <div className="sticky top-0">
        <div className="p-4 flex justify-end">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            <ChevronRight className={cn(
              "h-5 w-5 text-gray-500 dark:text-gray-400 transition-all",
              isCollapsed ? "" : "rotate-180"
            )} />
          </button>
        </div>
        
        <nav className="px-2 py-4">
          <ul className="space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors",
                      isActive && "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {!isCollapsed && (
                      <span className="ml-3">{item.title}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
