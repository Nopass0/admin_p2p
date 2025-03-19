"use client";

import { ReactNode } from "react";
import { Card } from "@heroui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  description?: string;
  color?: string;
}

export function StatCard({ 
  title, 
  value, 
  icon, 
  description = "", 
  color = "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300" 
}: StatCardProps) {
  return (
    <Card>
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {title}
            </p>
            <h3 className="mt-1 text-2xl font-semibold">
              {value}
            </h3>
            {description && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {description}
              </p>
            )}
          </div>
          <div className={cn("p-3 rounded-full", color)}>
            {icon}
          </div>
        </div>
      </div>
    </Card>
  );
}
