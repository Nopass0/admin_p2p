"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { cn } from "@/lib/utils";
import { Button } from "@heroui/button";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { 
  LayoutDashboard, 
  Users, 
  ArrowDownUp, 
  Settings, 
  ChevronRight,
  Globe,
  ArrowRightLeft,
  Banknote,
  CreditCard,
  Sun,
  Moon,
  LogOut,
  User,
  Menu,
  ChevronDown,
  FileText,
  LockKeyhole
} from "lucide-react";

// Zustand store для состояния сайдбара
const useSidebarStore = create(
  persist(
    (set) => ({
      isCollapsed: false,
      setIsCollapsed: (value) => set({ isCollapsed: value }),
      toggleCollapsed: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
      expandedSections: ["payments", "tractor"],
      toggleSection: (section) => set((state) => ({
        expandedSections: state.expandedSections.includes(section)
          ? state.expandedSections.filter(s => s !== section)
          : [...state.expandedSections, section]
      }))
    }),
    {
      name: 'sidebar-storage',
    }
  )
);

// Разделы навигации
const navigationSections = [
  {
    id: "payments",
    title: "Выплаты",
    items: [
      {
        title: "Сопоставления",
        href: "/matches",
        icon: ArrowRightLeft,
      },
      {
        title: "Пользователи",
        href: "/users",
        icon: Users,
      },
      {
        title: "IDEX Кабинеты",
        href: "/idex-cabinets",
        icon: Globe,
      },
      {
        title: "Зарплаты",
        href: "/salary?section=PAYMENTS",
        icon: Banknote
      },
      ,
      {
        title: "Финансы",
        href: "/finances",
        icon: CreditCard
      }
    ]
  },
  {
    id: "tractor",
    title: "Трактор",
    items: [
      {
        title: "Карты",
        href: "/cards",
        icon: CreditCard
      },
      {
        title: "Зарплаты",
        href: "/salary?section=TRACTOR",
        icon: Banknote
      },
      {
        title: "Финансы",
        href: "/finances-tractor",
        icon: CreditCard
      },

    ]
  },
  {
    id: "other",
    title: "Другое",
    items: [
      {
        title: "Пароли",
        href: "/passwords",
        icon: LockKeyhole
      },
      {
        title: "Таблицы",
        href: "/tables",
        icon: FileText
      },
    ]
  }
];

export function AppSidebar() {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const router = useRouter();
  const { isCollapsed, toggleCollapsed, expandedSections, toggleSection } = useSidebarStore();

  // Определение мобильного устройства
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  // Обработчик выхода из системы
  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // Обработчик смены темы
  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  // Получить все элементы навигации для мобильного вида
  const allNavigationItems = navigationSections.flatMap(section => section.items);

  if (isMobile) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 z-50">
        <div className="flex justify-around items-center h-16">
          {allNavigationItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center w-16 py-2",
                  isActive 
                    ? "text-blue-600 dark:text-blue-400" 
                    : "text-gray-700 dark:text-gray-300"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs mt-1">{item.title.split(' ')[0]}</span>
              </Link>
            );
          })}
          <Dropdown>
            <DropdownTrigger>
              <button className="flex flex-col items-center justify-center w-16 py-2 text-gray-700 dark:text-gray-300">
                <Menu className="w-5 h-5" />
                <span className="text-xs mt-1">Ещё</span>
              </button>
            </DropdownTrigger>
            <DropdownMenu className="bg-white dark:bg-zinc-800 shadow-lg rounded-t-lg p-2">
              {allNavigationItems.slice(5).map((item) => {
                const Icon = item.icon;
                return (
                  <DropdownItem key={item.href} className="p-2">
                    <Link href={item.href} className="flex items-center text-gray-700 dark:text-gray-300">
                      <Icon className="w-5 h-5 mr-2" />
                      <span>{item.title}</span>
                    </Link>
                  </DropdownItem>
                );
              })}
              <DropdownItem className="p-2">
                <button onClick={toggleTheme} className="flex items-center w-full text-gray-700 dark:text-gray-300">
                  {theme === "light" ? <Moon className="w-5 h-5 mr-2" /> : <Sun className="w-5 h-5 mr-2" />}
                  <span>{theme === "light" ? "Тёмная тема" : "Светлая тема"}</span>
                </button>
              </DropdownItem>
              {user && (
                <DropdownItem className="p-2">
                  <button onClick={handleLogout} className="flex items-center w-full text-red-600 dark:text-red-400">
                    <LogOut className="w-5 h-5 mr-2" />
                    <span>Выйти</span>
                  </button>
                </DropdownItem>
              )}
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>
    );
  }

  return (
    <aside 
      className={cn(
        "flex flex-col h-screen bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 transition-all duration-300 sticky top-0",
        isCollapsed ? "w-[60px]" : "w-[250px]"
      )}
    >
      {/* Top section: Collapse button */}
      <div className="p-4 flex items-center h-[60px] border-b border-gray-200 dark:border-zinc-800">
        {!isCollapsed && (
          <Link href="/" className="flex items-center mr-auto">
             <span className="text-xl font-bold text-gray-900 dark:text-white">P2P Админ</span>
          </Link>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          className={cn(
            "p-2 rounded-lg transition-colors duration-200",
            "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200",
            "bg-transparent hover:bg-gray-100 dark:hover:bg-zinc-800",
            "border border-gray-200 dark:border-zinc-700",
            isCollapsed && "mx-auto"
          )}
          aria-label={isCollapsed ? "Развернуть" : "Свернуть"}
          title={isCollapsed ? "Развернуть" : "Свернуть"}
        >
          <ChevronRight className={cn(
            "h-4 w-4 transition-transform duration-300",
            isCollapsed ? "" : "rotate-180"
          )} />
        </button>
      </div>
        
      {/* Middle section: Navigation */}
      <nav className="flex-grow px-2 py-4 overflow-y-auto">
        <ul className="space-y-2">
          {navigationSections.map((section) => {
            const isSectionExpanded = expandedSections.includes(section.id);
            
            return (
              <li key={section.id} className="space-y-1">
                {!isCollapsed ? (
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="flex items-center justify-between w-full p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                  >
                    <span className="font-medium text-sm">{section.title}</span>
                    <ChevronDown className={cn(
                      "w-4 h-4 transition-transform",
                      isSectionExpanded ? "rotate-180" : ""
                    )} />
                  </button>
                ) : (
                  <div className="h-1 w-full border-t border-gray-200 dark:border-zinc-800 my-2" />
                )}
                
                {(isSectionExpanded || isCollapsed) && (
                  <ul className="space-y-1 pl-0">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'));
                      
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            title={isCollapsed ? item.title : undefined}
                            className={cn(
                              "flex items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-gray-700 dark:text-gray-300",
                              isCollapsed ? "justify-center" : "",
                              isActive 
                                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium" 
                                : "hover:text-gray-900 dark:hover:text-white"
                            )}
                          >
                            <Icon className={cn("w-5 h-5", !isCollapsed && "mr-3")} />
                            {!isCollapsed && (
                              <span className="text-sm">{item.title}</span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom section: Theme toggle and User profile */}
      <div className="mt-auto mb-1">
        <div className="flex flex-col space-y-2 px-2">
          {/* Переключатель темы */}
          <button 
            type="button"
            className={cn(
              "flex items-center transition-colors rounded-md border-none bg-transparent",
              "hover:bg-gray-100 dark:hover:bg-zinc-800",
              isCollapsed 
                ? "justify-center p-2 w-10 h-10 mx-auto" 
                : "justify-start px-3 py-2.5"
            )}
            onClick={toggleTheme}
            title={theme === "light" ? "Тёмная тема" : "Светлая тема"}
          >
            {theme === "light" ? 
              <Moon className="h-5 w-5 text-gray-700 dark:text-gray-300" /> : 
              <Sun className="h-5 w-5 text-amber-500 dark:text-amber-400" />
            }
            {!isCollapsed && (
              <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                {theme === "light" ? "Тёмная тема" : "Светлая тема"}
              </span>
            )}
          </button>
            
          {/* Профиль пользователя */}
          {user && (
            <div className="relative group">
              <button 
                type="button"
                className={cn(
                  "flex items-center transition-colors rounded-md border-none bg-transparent w-full",
                  "hover:bg-gray-100 dark:hover:bg-zinc-800",
                  isCollapsed 
                    ? "justify-center p-2 w-10 h-10 mx-auto" 
                    : "justify-start px-3 py-2.5"
                )}
              >
                <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                {!isCollapsed && (
                  <span className="ml-3 text-sm font-medium truncate text-gray-700 dark:text-gray-300">
                    {user.name}
                  </span>
                )}
              </button>
              <div className={cn(
                "absolute z-50 hidden group-hover:block bg-white dark:bg-zinc-800 shadow-md rounded-md py-1 min-w-[180px]",
                isCollapsed ? "left-full bottom-0" : "top-full left-0"
              )}>
                <button 
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-zinc-700"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Выйти
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}