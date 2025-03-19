"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { Menu, Sun, Moon, LogOut, User } from "lucide-react";

export function AppHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const router = useRouter();

  // Обработчик выхода из системы
  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // Обработчик смены темы
  const toggleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
    } else {
      setTheme("light");
    }
  };

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Логотип и название */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400">P2P Админ</span>
            </Link>
          </div>

          {/* Мобильное меню */}
          <div className="flex md:hidden">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>

          {/* Десктопное меню */}
          <div className="hidden md:flex items-center space-x-2">
            {/* Переключатель темы */}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={toggleTheme}
              title={theme === "light" ? "Тёмная тема" : "Светлая тема"}
            >
              {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
            
            {/* Профиль пользователя */}
            {user && (
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="ghost" className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>{user.name}</span>
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Меню пользователя">
                  <DropdownItem key="logout" startContent={<LogOut className="w-4 h-4" />} onPress={handleLogout}>
                    Выйти
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            )}
          </div>
        </div>

        {/* Мобильное меню (развернутое) */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-md">
            <div className="flex flex-col space-y-2">
              <div className="flex justify-between items-center">
                <span>Тема</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={toggleTheme}
                >
                  {theme === "light" ? "Тёмная" : "Светлая"}
                </Button>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="justify-start"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span>Выйти</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
