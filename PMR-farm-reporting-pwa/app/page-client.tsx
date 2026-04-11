"use client";

import { ReportItem } from "@/components/custom/report-item";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { getAllDailyReports, submitDailyReport, updateDailyReport } from "@/lib/api";
import { useAppData } from "@/lib/app-data-context";
import { useAuth } from "@/lib/auth-context";
import { useDailyReportDraft } from "@/lib/daily-report-draft-context";
import {
  clampIsoDate,
  todayIsoLocal,
  yyyymmddToIso,
} from "@/lib/date-utils";
import { isReportDateBoundsRelaxed } from "@/lib/report-date-bounds-config";
import { ApiError } from "@/lib/types";
import { CalendarIcon, LogOutIcon, MoreHorizontal } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type PageClientProps = {
  initialDate: string;
};

const isValidDate = (value: string) => {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
};

export default function PageClient({ initialDate }: PageClientProps) {
  const relaxedBounds = isReportDateBoundsRelaxed();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitWarning, setSubmitWarning] = useState<string | null>(null);
  const [dateBounds, setDateBounds] = useState<{ min: string } | null>(() =>
    isReportDateBoundsRelaxed() ? { min: "1970-01-01" } : null,
  );

  const dateParam = searchParams?.get("date");
  const maxSelectable = todayIsoLocal();
  const rawDate =
    dateParam && isValidDate(dateParam) ? dateParam : initialDate;
  const date = relaxedBounds
    ? isValidDate(rawDate)
      ? rawDate
      : maxSelectable
    : dateBounds != null
      ? clampIsoDate(
          isValidDate(rawDate) ? rawDate : maxSelectable,
          dateBounds.min,
          maxSelectable,
        )
      : rawDate;

  const { user, logout, isLoading } = useAuth();
  const { draft, loadDraft, clearDraft, setSyncStatus } = useDailyReportDraft();
  const { sheds } = useAppData();

  const refreshDateBounds = useCallback(async () => {
    if (isReportDateBoundsRelaxed()) return;
    try {
      const reports = await getAllDailyReports();
      if (reports.length === 0) {
        setDateBounds({ min: todayIsoLocal() });
      } else {
        const maxYyyymmdd = Math.max(...reports.map((r) => r.reportDate));
        setDateBounds({ min: yyyymmddToIso(maxYyyymmdd) });
      }
    } catch {
      setDateBounds({ min: todayIsoLocal() });
    }
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user || isLoading) return;
    if (isReportDateBoundsRelaxed()) return;
    void refreshDateBounds();
  }, [user, isLoading, refreshDateBounds]);

  useEffect(() => {
    if (!user || isLoading) return;

    if (isReportDateBoundsRelaxed()) {
      const paramRaw = searchParams?.get("date") ?? null;
      if (!paramRaw || !isValidDate(paramRaw)) {
        const fallback = isValidDate(initialDate) ? initialDate : todayIsoLocal();
        router.replace(`/?date=${fallback}`);
        return;
      }
      loadDraft(paramRaw);
      return;
    }

    if (!dateBounds) return;

    const maxSel = todayIsoLocal();
    const minSelectable = dateBounds.min;
    const paramRaw = searchParams?.get("date") ?? null;
    const base =
      paramRaw && isValidDate(paramRaw) ? paramRaw : initialDate;
    const validBase = isValidDate(base) ? base : maxSel;
    const clamped = clampIsoDate(validBase, minSelectable, maxSel);

    if (clamped !== paramRaw) {
      router.replace(`/?date=${clamped}`);
      return;
    }

    loadDraft(clamped);
  }, [
    user,
    isLoading,
    dateBounds,
    searchParams,
    router,
    initialDate,
    loadDraft,
  ]);

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
        try {
          result = await updateDailyReport(submitDto);
        } catch (updateErr) {
          const msg = String((updateErr as ApiError)?.message ?? "");
          const st = (updateErr as { status?: number })?.status;
          if (
            st === 404 ||
            msg.toLowerCase().includes("no report exists")
          ) {
            result = await submitDailyReport(submitDto);
          } else {
            throw updateErr;
          }
        }
      }

      setSyncStatus("synced");
      const warningMessage =
        (result as { emailWarning?: string })?.emailWarning || null;
      if (warningMessage) {
        setSubmitWarning(warningMessage);
      }
      alert("Report submitted successfully!");
      if (!isReportDateBoundsRelaxed()) {
        await refreshDateBounds();
      }
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

  if (!relaxedBounds && !dateBounds) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center">
      <div className="w-full max-w-sm">
        <header className="sticky top-0 z-50 bg-background border-b">
          <div className="flex items-center justify-between p-4">
            <div className="relative w-16 h-8">
              <Image src="/images/pmr-farm-logo-img.png" alt="PMR Farms" fill />
            </div>
            <div className="flex items-center gap-2">
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
              <Button variant="outline" size="icon" title="Other options" asChild>
                <Link href="/other-options" aria-label="Other options">
                  <MoreHorizontal className="h-4 w-4" />
                </Link>
              </Button>
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
                  {...(relaxedBounds
                    ? {}
                    : {
                        min: dateBounds!.min,
                        max: maxSelectable,
                      })}
                  value={date}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    if (!isValidDate(newDate)) return;
                    if (relaxedBounds) {
                      router.replace(`/?date=${newDate}`);
                      return;
                    }
                    const clamped = clampIsoDate(
                      newDate,
                      dateBounds!.min,
                      maxSelectable,
                    );
                    router.replace(`/?date=${clamped}`);
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
