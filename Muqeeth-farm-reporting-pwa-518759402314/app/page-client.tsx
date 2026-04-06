"use client";

import { ReportItem } from "@/components/custom/report-item";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { submitDailyReport, updateDailyReport } from "@/lib/api";
import { useAppData } from "@/lib/app-data-context";
import { useAuth } from "@/lib/auth-context";
import { useDailyReportDraft } from "@/lib/daily-report-draft-context";
import { ApiError } from "@/lib/types";
import { CalendarIcon, LogOutIcon } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type PageClientProps = {
  initialDate: string;
};

const isValidDate = (value: string) => {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
};

export default function PageClient({ initialDate }: PageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitWarning, setSubmitWarning] = useState<string | null>(null);

  const dateParam = searchParams?.get("date");
  const date = dateParam && isValidDate(dateParam) ? dateParam : initialDate;

  const { user, logout, isLoading } = useAuth();
  const { draft, loadDraft, clearDraft, setSyncStatus } = useDailyReportDraft();
  const { sheds } = useAppData();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    const paramDate = searchParams?.get("date");

    if (!paramDate || !isValidDate(paramDate)) {
      router.replace(`/?date=${initialDate}`);
      loadDraft(initialDate);
      return;
    }

    loadDraft(paramDate);
  }, [searchParams, router, initialDate]);

  const hasSalesData = !!(
    draft &&
    (draft.sales.length > 0 || draft.noSalesConfirmed)
  );
  const hasFeedData = !!(
    draft &&
    (draft.feedReceipts.length > 0 || draft.noFeedReceiptsConfirmed)
  );
  const hasShedData = !!(
    draft &&
    sheds &&
    draft.shedDailyReports.length == sheds.length
  );
  const canOpenFeed = hasSalesData;
  const canOpenShed = hasSalesData && hasFeedData;
  const canSubmit = hasSalesData && hasFeedData && hasShedData;
  const syncStatus = draft?.syncStatus ?? "pending_create";
  const submitButtonText =
    syncStatus === "pending_update" ? "Update Report" : "Submit Report";

  const handleLogout = () => {
    logout();
    clearDraft();
    router.replace("/login");
  };

  const handleSubmit = async () => {
    if (!draft || !user || !canSubmit) return;

    setIsSubmitting(true);
    setSubmitWarning(null);
    try {
      const submitDto = {
        reportDate: draft.reportDate,
        submitterId: parseInt(user.id),
        sales: draft.sales,
        feedReceipts: draft.feedReceipts,
        shedDailyReports: draft.shedDailyReports,
      };

      let result;
      if (draft.syncStatus === "pending_create") {
        result = await submitDailyReport(submitDto);
      } else {
        result = await updateDailyReport(submitDto);
      }

      setSyncStatus("synced");
      const warningMessage =
        (result as { emailWarning?: string })?.emailWarning || null;
      if (warningMessage) {
        setSubmitWarning(warningMessage);
      }
      alert("Report submitted successfully!");
      router.replace(`/?date=${date}`);
    } catch (error) {
      console.error("Failed to submit report:", error);
      alert(
        (error as ApiError)?.message ||
          "Failed to submit report. Data has been saved locally.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex items-center justify-center">
      <div className="w-full max-w-sm">
        <header className="sticky top-0 z-50 bg-background border-b">
          <div className="flex items-center justify-between p-4">
            <div className="relative w-16 h-8">
              <Image src="/images/flygoog-logo-img.png" alt="Eggs" fill />
            </div>
            <div className="flex items-center space-x-2 rounded-full border border-primary/30 bg-primary/5 px-2 py-1">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                {user.name?.charAt(0).toUpperCase() || "U"}
              </span>
              <div className="text-right">
                <div className="text-xs font-medium text-primary">
                  {user.name}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {user.phone}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="destructive"
                onClick={handleLogout}
                title="Log out"
              >
                <LogOutIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <div className="flex flex-col items-center justify-center px-4 py-4">
          <div className="w-full p-4 rounded-xl shadow">
            <h2 className="text-xl font-bold text-center">
              PMR Farms – Daily Report
            </h2>

            <div className="flex justify-center mt-4">
              <InputGroup className="w-50 text-center">
                <InputGroupInput
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    if (!isValidDate(newDate)) return;
                    router.replace(`/?date=${newDate}`);
                  }}
                />
                <InputGroupAddon align="inline-end">
                  <CalendarIcon />
                </InputGroupAddon>
              </InputGroup>
            </div>

            <ReportItem
              title={`Sales Entry${
                draft?.noSalesConfirmed
                  ? " (No Sales)"
                  : (draft?.sales?.length ?? 0) > 0
                    ? ` (${draft?.sales.length})`
                    : ""
              }`}
              href={`/sales-entry?date=${date}`}
              completed={hasSalesData}
              onClick={() => {}}
              className="mt-8"
            />
            <ReportItem
              title={`Feed Plant Entry${
                draft?.noFeedReceiptsConfirmed
                  ? " (No Feed Receipts)"
                  : (draft?.feedReceipts?.length ?? 0) > 0
                    ? ` (${draft?.feedReceipts.length})`
                    : ""
              }`}
              href={`/feed-plant-entry?date=${date}`}
              completed={hasFeedData}
              onClick={(e) => {
                if (!canOpenFeed) {
                  e.preventDefault();
                  alert("Complete Sales Entry first.");
                }
              }}
              className="mt-4"
            />
            <ReportItem
              title={`Shed Data Entry${
                (draft?.shedDailyReports?.length || 0) > 0
                  ? ` (${draft?.shedDailyReports?.length}/${sheds?.length})`
                  : ""
              }`}
              href={`/shed-data-entry?date=${date}`}
              completed={hasShedData}
              onClick={(e) => {
                if (!canOpenShed) {
                  e.preventDefault();
                  alert("Complete Sales Entry and Feed Plant Entry first.");
                }
              }}
              className="mt-4"
            />

            {syncStatus === "synced" ? (
              <>
                <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-center text-sm font-medium text-emerald-600">
                  Report has been submitted successfully.
                </div>
                {submitWarning ? (
                  <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-center text-xs text-amber-700">
                    {submitWarning}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <Button
                  className="w-full mt-4"
                  size="lg"
                  disabled={!canSubmit || isSubmitting}
                  onClick={handleSubmit}
                >
                  {isSubmitting ? "Submitting..." : submitButtonText}
                </Button>
                {!canSubmit ? (
                  <div className="mt-4 text-xs text-gray-500 text-center">
                    Complete in order: Sales (or No Sales), Feed Plant (or No Feed Receipts), then Shed Data.
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
