"use client";

import React, { ReactNode, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Menu, Bell, Moon, Sun } from "lucide-react";
import { Button } from "@heroui/button";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { cn } from "@/lib/utils";

interface LayoutWithSidebarProps {
  children: ReactNode;
}

export const LayoutWithSidebar: React.FC<LayoutWithSidebarProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className={cn(
      "flex min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100",
      isDarkMode ? "dark" : ""
    )}>
      <Sidebar className={cn(
        "fixed left-0 top-0 z-40 h-screen transition-all duration-300",
        collapsed ? "-translate-x-full" : "translate-x-0"
      )} />
      
      <div className={cn(
        "flex-1 transition-all duration-300",
        collapsed ? "ml-0" : "ml-64"
      )}>
        <header className="bg-white dark:bg-gray-800 shadow-sm z-30 sticky top-0">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-2">
              <Button 
                variant="flat" 
                size="sm" 
                isIconOnly
                onClick={toggleSidebar}
                className="lg:hidden"
              >
                <Menu className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="flex items-center gap-3">
              <Button 
                variant="flat" 
                size="sm" 
                isIconOnly
                onClick={toggleDarkMode}
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
              
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="flat" size="sm" isIconOnly>
                    <Bell className="w-5 h-5" />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Уведомления">
                  <DropdownItem key="empty">Нет новых уведомлений</DropdownItem>
                </DropdownMenu>
              </Dropdown>
              
              <div className="ml-3 relative">
                <div className="flex items-center">
                  <Dropdown>
                    <DropdownTrigger>
                      <div className="cursor-pointer rounded-full bg-gray-200 dark:bg-gray-700 p-1">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-500 text-white">
                          АП
                        </span>
                      </div>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Профиль">
                      <DropdownItem key="profile">Профиль</DropdownItem>
                      <DropdownItem key="settings">Настройки</DropdownItem>
                      <DropdownItem key="logout" className="text-danger">Выйти</DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
};
