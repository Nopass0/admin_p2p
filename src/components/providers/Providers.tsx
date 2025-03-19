"use client";

import { HeroUIProvider } from "@heroui/react";
import { TRPCReactProvider } from "@/trpc/react";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";

type ProvidersProps = {
  children: React.ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
      <HeroUIProvider>
        <AuthProvider>
          <TRPCReactProvider>{children}</TRPCReactProvider>
        </AuthProvider>
      </HeroUIProvider>
    </ThemeProvider>
  );
}
