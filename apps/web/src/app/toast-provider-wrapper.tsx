"use client";

import { ToastProvider } from "@/components/ui/toast";

export function ToastProviderWrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
