"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  ReactNode,
} from "react";
import type {
  CreateSaleDto,
  CreateFeedReceiptDto,
  CreateShedDailyReportDto,
  SubmitDailyReportDto,
  DailyReportResponseDto,
  SaleResponseDto,
  SaleItemResponseDto,
  FeedReceiptResponseDto,
  ShedDailyReportResponseDto,
} from "./types";
import { getDailyReportByDate } from "./api";

export type SyncStatus = "pending_create" | "synced" | "pending_update";

export interface DailyReportDraft {
  reportDate: string;
  sales: CreateSaleDto[];
  feedReceipts: CreateFeedReceiptDto[];
  shedDailyReports: CreateShedDailyReportDto[];
  // True when submitted report was edited upstream and shed data was intentionally cleared.
  shedReentryRequired: boolean;
  noSalesConfirmed: boolean;
  noFeedReceiptsConfirmed: boolean;
  syncStatus: SyncStatus;
}

export interface OpeningBirdsResolution {
  openingBirds: number | null;
  source: "previous_day" | "manual_required";
}

export interface OpeningFeedResolution {
  openingFeed: number | null;
  source: "previous_day" | "manual_required";
}

export interface OpeningEggsResolution {
  openingEggs: number | null;
  source: "previous_day" | "manual_required";
}

interface DailyReportDraftContextType {
  draft: DailyReportDraft | null;
  updateSales: (sales: CreateSaleDto[]) => void;
  updateFeedReceipts: (feedReceipts: CreateFeedReceiptDto[]) => void;
  updateShedDailyReports: (
    shedDailyReports: CreateShedDailyReportDto[],
  ) => void;
  markNoSales: (confirmed: boolean) => void;
  markNoFeedReceipts: (confirmed: boolean) => void;
  loadDraft: (date: string) => Promise<void>;
  saveDraft: () => void;
  clearDraft: () => void;
  getDraft: (date: string) => DailyReportDraft | null;
  getSubmitDto: (submitterId: number) => SubmitDailyReportDto | null;
  getOpeningBirdsForShed: (
    date: string,
    shedId: number,
  ) => Promise<OpeningBirdsResolution>;
  getOpeningFeedForShed: (
    date: string,
    shedId: number,
  ) => Promise<OpeningFeedResolution>;
  getOpeningEggsForShed: (
    date: string,
    shedId: number,
  ) => Promise<OpeningEggsResolution>;
  setSyncStatus: (status: SyncStatus) => void;
}

const DailyReportDraftContext = createContext<
  DailyReportDraftContextType | undefined
>(undefined);

const STORAGE_KEY = "dailyReportDrafts";
// Strategy decision: keep strict reset behavior for data integrity.
// When sales/feed changes after shed entry, shed data must be re-entered.
const STRICT_SALES_FEED_INVALIDATES_SHED = true;

// Helper to get all drafts from storage
function getAllDrafts(): Record<string, DailyReportDraft> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

// Helper to save draft to storage
function saveDraftToStorage(date: string, draft: DailyReportDraft) {
  try {
    const allDrafts = getAllDrafts();
    allDrafts[date] = draft;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allDrafts));
  } catch (error) {
    console.error("Failed to save draft to storage:", error);
  }
}

// Helper to get draft from storage
function getDraftFromStorage(date: string): DailyReportDraft | null {
  try {
    const allDrafts = getAllDrafts();
    return allDrafts[date] || null;
  } catch {
    return null;
  }
}

// Helper to remove draft from storage
function removeDraftFromStorage(date: string) {
  try {
    const allDrafts = getAllDrafts();
    delete allDrafts[date];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allDrafts));
  } catch (error) {
    console.error("Failed to remove draft from storage:", error);
  }
}

function createEmptyDraft(date: string): DailyReportDraft {
  return {
    reportDate: date,
    sales: [],
    feedReceipts: [],
    shedDailyReports: [],
    shedReentryRequired: false,
    noSalesConfirmed: false,
    noFeedReceiptsConfirmed: false,
    syncStatus: "pending_create",
  };
}

function getPreviousDateString(dateString: string): string {
  const [yearRaw, monthRaw, dayRaw] = dateString.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() - 1);
  return utcDate.toISOString().slice(0, 10);
}

function convertDailyReportResponseToDraft(
  date: string,
  response: DailyReportResponseDto,
): DailyReportDraft {
  const sales: CreateSaleDto[] = (response.sales ?? []).map(
    (sale: SaleResponseDto) => ({
      partyId: sale.partyId,
      vehicleNumber: sale.vehicleNumber ?? "",
      items: (sale.items ?? []).map((item: SaleItemResponseDto) => ({
        shedId: item.shedId,
        standardEggs: item.standardEggs ?? 0,
        smallEggs: item.smallEggs ?? 0,
        bigEggs: item.bigEggs ?? 0,
        loadingDamage: item.loadingDamage ?? 0,
      })),
    }),
  );

  const feedReceipts: CreateFeedReceiptDto[] = (
    response.feedReceipts ?? []
  ).map((receipt: FeedReceiptResponseDto) => ({
    partyId: receipt.partyId,
    feedItemId: receipt.feedItemId,
    vehicleNumber: receipt.vehicleNumber ?? "",
    quantityKg: receipt.quantityKg,
  }));

  const shedDailyReports: CreateShedDailyReportDto[] = (
    response.shedDailyReports ?? []
  ).map((report: ShedDailyReportResponseDto) => ({
    shedId: report.shedId,
    openingBirds: report.openingBirds,
    birdsMortality: report.birdsMortality ?? 0,
    closingBirds: report.closingBirds ?? 0,
    openingEggs: report.openingEggs,
    damagedEggs: report.damagedEggs ?? 0,
    standardEggsClosing: report.standardEggsClosing ?? 0,
    smallEggsClosing: report.smallEggsClosing ?? 0,
    bigEggsClosing: report.bigEggsClosing ?? 0,
    feedOpening: report.feedOpening,
    feedIssued: report.feedIssued ?? report.totalFeedReceipt,
    feedClosing: report.feedClosing ?? report.closingFeed,
    feedConsumed: report.feedConsumed,
    totalEggsClosing: report.totalEggsClosing,
    eggsProduced: report.eggsProduced,
    // Legacy compatibility.
    totalFeedReceipt: report.totalFeedReceipt,
    closingFeed: report.closingFeed,
  }));

  return {
    reportDate: date,
    sales,
    feedReceipts,
    shedDailyReports,
    shedReentryRequired: false,
    noSalesConfirmed: false,
    noFeedReceiptsConfirmed: false,
    syncStatus: "synced",
  };
}

export function DailyReportDraftProvider({
  children,
}: {
  children: ReactNode;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [currentDate, setCurrentDate] = useState<string>(today);
  const [draft, setDraft] = useState<DailyReportDraft | null>(() => {
    const storedDraft = getDraftFromStorage(today);
    return storedDraft ?? createEmptyDraft(today);
  });

  const updateSales = (sales: CreateSaleDto[]) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const newStatus =
        prev.syncStatus === "synced" ? "pending_update" : prev.syncStatus;
      const shouldClearShed =
        STRICT_SALES_FEED_INVALIDATES_SHED && prev.shedDailyReports.length > 0;
      const updated = {
        ...prev,
        sales,
        // If upstream sales/feed changes after shed entry, shed must be re-entered.
        shedDailyReports: shouldClearShed ? [] : prev.shedDailyReports,
        shedReentryRequired: shouldClearShed,
        noSalesConfirmed: sales.length > 0 ? false : prev.noSalesConfirmed,
        syncStatus: newStatus,
      };
      saveDraftToStorage(currentDate, updated);
      return updated;
    });
  };

  const updateFeedReceipts = (feedReceipts: CreateFeedReceiptDto[]) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const newStatus =
        prev.syncStatus === "synced" ? "pending_update" : prev.syncStatus;
      const shouldClearShed =
        STRICT_SALES_FEED_INVALIDATES_SHED && prev.shedDailyReports.length > 0;
      const updated = {
        ...prev,
        feedReceipts,
        // If upstream sales/feed changes after shed entry, shed must be re-entered.
        shedDailyReports: shouldClearShed ? [] : prev.shedDailyReports,
        shedReentryRequired: shouldClearShed,
        noFeedReceiptsConfirmed:
          feedReceipts.length > 0 ? false : prev.noFeedReceiptsConfirmed,
        syncStatus: newStatus,
      };
      saveDraftToStorage(currentDate, updated);
      return updated;
    });
  };

  const markNoSales = (confirmed: boolean) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const newStatus =
        prev.syncStatus === "synced" ? "pending_update" : prev.syncStatus;
      const shouldClearShed =
        STRICT_SALES_FEED_INVALIDATES_SHED && prev.shedDailyReports.length > 0;
      const updated = {
        ...prev,
        sales: confirmed ? [] : prev.sales,
        shedDailyReports: shouldClearShed ? [] : prev.shedDailyReports,
        shedReentryRequired: shouldClearShed,
        noSalesConfirmed: confirmed,
        syncStatus: newStatus,
      };
      saveDraftToStorage(currentDate, updated);
      return updated;
    });
  };

  const markNoFeedReceipts = (confirmed: boolean) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const newStatus =
        prev.syncStatus === "synced" ? "pending_update" : prev.syncStatus;
      const shouldClearShed =
        STRICT_SALES_FEED_INVALIDATES_SHED && prev.shedDailyReports.length > 0;
      const updated = {
        ...prev,
        feedReceipts: confirmed ? [] : prev.feedReceipts,
        shedDailyReports: shouldClearShed ? [] : prev.shedDailyReports,
        shedReentryRequired: shouldClearShed,
        noFeedReceiptsConfirmed: confirmed,
        syncStatus: newStatus,
      };
      saveDraftToStorage(currentDate, updated);
      return updated;
    });
  };

  const updateShedDailyReports = (
    shedDailyReports: CreateShedDailyReportDto[],
  ) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const newStatus =
        prev.syncStatus === "synced" ? "pending_update" : prev.syncStatus;
      const updated = {
        ...prev,
        shedDailyReports,
        shedReentryRequired: false,
        syncStatus: newStatus,
      };
      saveDraftToStorage(currentDate, updated);
      return updated;
    });
  };

  const loadDraft = useCallback(async (date: string) => {
    setCurrentDate(date);
    const storedDraft = getDraftFromStorage(date);
    const normalizedStoredDraft = storedDraft
      ? {
          ...storedDraft,
          reportDate: date,
          shedReentryRequired: storedDraft.shedReentryRequired ?? false,
        }
      : null;

    try {
      const response = await getDailyReportByDate(date);
      const convertedDraft = convertDailyReportResponseToDraft(date, response);
      // Preserve local unsynced edits (especially pending_update) instead of
      // clobbering them with last submitted server payload on navigation/reload.
      if (
        normalizedStoredDraft &&
        normalizedStoredDraft.syncStatus !== "synced"
      ) {
        setDraft(normalizedStoredDraft);
        saveDraftToStorage(date, normalizedStoredDraft);
      } else {
        setDraft(convertedDraft);
        saveDraftToStorage(date, convertedDraft);
      }
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 404) {
        // No report on server for this date — do not trust local sync flags from before a DB reset.
        console.info("No daily report found for date:", date);
        if (normalizedStoredDraft) {
          const serverMissing =
            normalizedStoredDraft.syncStatus === "synced" ||
            normalizedStoredDraft.syncStatus === "pending_update";
          const merged: DailyReportDraft = serverMissing
            ? {
                ...normalizedStoredDraft,
                reportDate: date,
                syncStatus: "pending_create",
              }
            : {
                ...normalizedStoredDraft,
                reportDate: date,
              };
          setDraft(merged);
          saveDraftToStorage(date, merged);
        } else {
          setDraft(createEmptyDraft(date));
        }
      } else {
        console.error("Failed to load daily report:", error);
        if (normalizedStoredDraft) {
          setDraft(normalizedStoredDraft);
        } else {
          setDraft(createEmptyDraft(date));
        }
      }
    }
  }, []);

  const saveDraft = () => {
    if (draft) {
      saveDraftToStorage(currentDate, draft);
    }
  };

  const clearDraft = () => {
    removeDraftFromStorage(currentDate);
    setDraft({
      reportDate: currentDate,
      sales: [],
      feedReceipts: [],
      shedDailyReports: [],
      shedReentryRequired: false,
      noSalesConfirmed: false,
      noFeedReceiptsConfirmed: false,
      syncStatus: "pending_create",
    });
  };

  const getDraft = (date: string): DailyReportDraft | null => {
    return getDraftFromStorage(date);
  };

  const setSyncStatus = (status: SyncStatus) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, syncStatus: status };
      saveDraftToStorage(currentDate, updated);
      return updated;
    });
  };

  const getSubmitDto = (submitterId: number): SubmitDailyReportDto | null => {
    if (!draft) return null;
    return {
      reportDate: draft.reportDate,
      submitterId,
      sales: draft.sales,
      feedReceipts: draft.feedReceipts,
      shedDailyReports: draft.shedDailyReports,
    };
  };

  const getOpeningBirdsForShed = useCallback(
    async (
      date: string,
      shedId: number,
    ): Promise<OpeningBirdsResolution> => {
      const previousDate = getPreviousDateString(date);
      try {
        const previousReport = await getDailyReportByDate(previousDate);
        const previousShed = previousReport.shedDailyReports?.find(
          (entry) => entry.shedId === shedId,
        );
        if (previousShed && previousShed.closingBirds !== undefined) {
          return {
            openingBirds: previousShed.closingBirds,
            source: "previous_day",
          };
        }
        return {
          openingBirds: null,
          source: "manual_required",
        };
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (status === 404) {
          return {
            openingBirds: null,
            source: "manual_required",
          };
        }
        throw error;
      }
    },
    [],
  );

  const getOpeningFeedForShed = useCallback(
    async (date: string, shedId: number): Promise<OpeningFeedResolution> => {
      const previousDate = getPreviousDateString(date);
      try {
        const previousReport = await getDailyReportByDate(previousDate);
        const previousShed = previousReport.shedDailyReports?.find(
          (entry) => entry.shedId === shedId,
        );
        const previousFeedClosing =
          previousShed?.feedClosing ?? previousShed?.closingFeed;
        if (previousFeedClosing !== undefined && previousFeedClosing !== null) {
          return {
            openingFeed: previousFeedClosing,
            source: "previous_day",
          };
        }
        return {
          openingFeed: null,
          source: "manual_required",
        };
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (status === 404) {
          return {
            openingFeed: null,
            source: "manual_required",
          };
        }
        throw error;
      }
    },
    [],
  );

  const getOpeningEggsForShed = useCallback(
    async (date: string, shedId: number): Promise<OpeningEggsResolution> => {
      const previousDate = getPreviousDateString(date);
      try {
        const previousReport = await getDailyReportByDate(previousDate);
        const previousShed = previousReport.shedDailyReports?.find(
          (entry) => entry.shedId === shedId,
        );
        const previousTotalEggsClosing =
          previousShed?.totalEggsClosing ??
          (previousShed?.standardEggsClosing ?? 0) +
            (previousShed?.smallEggsClosing ?? 0) +
            (previousShed?.bigEggsClosing ?? 0);

        if (previousTotalEggsClosing !== undefined && previousTotalEggsClosing !== null) {
          return {
            openingEggs: previousTotalEggsClosing,
            source: "previous_day",
          };
        }
        return {
          openingEggs: null,
          source: "manual_required",
        };
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (status === 404) {
          return {
            openingEggs: null,
            source: "manual_required",
          };
        }
        throw error;
      }
    },
    [],
  );

  return (
    <DailyReportDraftContext.Provider
      value={{
        draft,
        updateSales,
        updateFeedReceipts,
        updateShedDailyReports,
        markNoSales,
        markNoFeedReceipts,
        loadDraft,
        saveDraft,
        clearDraft,
        getDraft,
        getSubmitDto,
        getOpeningBirdsForShed,
        getOpeningFeedForShed,
        getOpeningEggsForShed,
        setSyncStatus,
      }}
    >
      {children}
    </DailyReportDraftContext.Provider>
  );
}

export function useDailyReportDraft() {
  const context = useContext(DailyReportDraftContext);
  if (context === undefined) {
    throw new Error(
      "useDailyReportDraft must be used within a DailyReportDraftProvider",
    );
  }
  return context;
}
