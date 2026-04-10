"use client";

import { AppHeader } from "@/components/custom/app-header";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { CullBirdSalesClient } from "./cull-bird-sales-client";
import { NewBatchEntryClient } from "./new-batch-entry-client";
import { ShedTransferClient } from "./shed-transfer-client";
import { ViewFlockDataClient } from "./view-flock-data-client";

const STEP_TITLES: Record<string, string> = {
  "view-flock-data": "View flock data",
  "new-batch": "New batch entry",
  "shed-transfer": "Shed transfer",
  "cull-bird-sales": "Cull bird sales",
};

type FlockOptionDetailClientProps = {
  step: string;
};

export function FlockOptionDetailClient({ step }: FlockOptionDetailClientProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const title = STEP_TITLES[step] ?? "Flock management";

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen justify-center">
      <div className="w-full max-w-sm">
        <AppHeader
          title={title}
          onBack={() => router.push("/flock-management")}
        />

        {step === "view-flock-data" ? (
          <ViewFlockDataClient />
        ) : step === "new-batch" ? (
          <NewBatchEntryClient />
        ) : step === "shed-transfer" ? (
          <ShedTransferClient />
        ) : step === "cull-bird-sales" ? (
          <CullBirdSalesClient />
        ) : (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            We&apos;ll define how this works next.
          </div>
        )}
      </div>
    </div>
  );
}
