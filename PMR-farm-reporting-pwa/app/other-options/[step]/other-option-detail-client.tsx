"use client";

import { AppHeader } from "@/components/custom/app-header";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { CullBirdSalesClient } from "./cull-bird-sales-client";
import { ManageFeedFormulationsClient } from "./manage-feed-formulations-client";
import { ManageFeedItemsClient } from "./manage-feed-items-client";
import { ManagePartiesClient } from "./manage-parties-client";
import { NewBatchEntryClient } from "./new-batch-entry-client";
import { OverwriteFeedClosingClient } from "./overwrite-feed-closing-client";
import { OverwriteShedClosingClient } from "./overwrite-shed-closing-client";
import { ShedTransferClient } from "./shed-transfer-client";
import { ViewFlockDataClient } from "./view-flock-data-client";

const STEP_TITLES: Record<string, string> = {
  "view-flock-data": "View flock data",
  "new-batch": "New batch entry",
  "shed-transfer": "Shed transfer",
  "cull-bird-sales": "Cull bird sales",
  "manage-parties": "Manage parties",
  "overwrite-feed-closing": "Overwrite feed closing",
  "overwrite-shed-closing": "Overwrite shed closing",
  "manage-feed-items": "Manage feed items",
  "manage-feed-formulations": "Manage feed formulations",
};

type OtherOptionDetailClientProps = {
  step: string;
};

export function OtherOptionDetailClient({ step }: OtherOptionDetailClientProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const title = STEP_TITLES[step] ?? "Other options";

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
          onBack={() => router.push("/other-options")}
        />

        {step === "view-flock-data" ? (
          <ViewFlockDataClient />
        ) : step === "new-batch" ? (
          <NewBatchEntryClient />
        ) : step === "shed-transfer" ? (
          <ShedTransferClient />
        ) : step === "cull-bird-sales" ? (
          <CullBirdSalesClient />
        ) : step === "manage-parties" ? (
          <ManagePartiesClient />
        ) : step === "overwrite-feed-closing" ? (
          <OverwriteFeedClosingClient />
        ) : step === "overwrite-shed-closing" ? (
          <OverwriteShedClosingClient />
        ) : step === "manage-feed-items" ? (
          <ManageFeedItemsClient />
        ) : step === "manage-feed-formulations" ? (
          <ManageFeedFormulationsClient />
        ) : (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            We&apos;ll define how this works next.
          </div>
        )}
      </div>
    </div>
  );
}
