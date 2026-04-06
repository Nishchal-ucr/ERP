"use client";

import { AuthProvider } from "@/lib/auth-context";
import { AppDataProvider } from "@/lib/app-data-context";
import { DailyReportDraftProvider } from "@/lib/daily-report-draft-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppDataProvider>
        <DailyReportDraftProvider>{children}</DailyReportDraftProvider>
      </AppDataProvider>
    </AuthProvider>
  );
}
