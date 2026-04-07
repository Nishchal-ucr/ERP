"use client";

import { AppHeader } from "@/components/custom/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { useAppData } from "@/lib/app-data-context";
import { useDailyReportDraft } from "@/lib/daily-report-draft-context";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CreateShedDailyReportDto } from "@/lib/types";

type Nullable<T> = {
  [K in keyof T]: T[K] | null | undefined;
};

type ShedDataRow = Nullable<CreateShedDailyReportDto> & {
  shedName: string;
};

interface AddShedDataEntryClientProps {
  date: string;
  shedId: string | null;
}

export function AddShedDataEntryClient({
  date,
  shedId,
}: AddShedDataEntryClientProps) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { sheds, isLoading: dataLoading } = useAppData();
  const {
    draft,
    loadDraft,
    updateShedDailyReports,
    getOpeningBirdsForShed,
    getOpeningFeedForShed,
    getOpeningEggsForShed,
  } = useDailyReportDraft();

  const [shedData, setShedData] = useState<ShedDataRow | null>(null);
  const [openingBirds, setOpeningBirds] = useState<number | undefined>(
    undefined,
  );
  const [feedOpening, setFeedOpening] = useState<number | undefined>(undefined);
  const [openingEggs, setOpeningEggs] = useState<number | undefined>(undefined);
  const [isOpeningReadOnly, setIsOpeningReadOnly] = useState(true);
  const [isFeedOpeningReadOnly, setIsFeedOpeningReadOnly] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const openingResolved = useRef(false);
  const feedOpeningResolved = useRef(false);
  const openingEggsResolved = useRef(false);

  useEffect(() => {
    loadDraft(date);
  }, [date]);

  const resolvedShedId = shedId ? parseInt(shedId) : null;
  const shed =
    sheds && resolvedShedId
      ? sheds.find((s) => s.id === resolvedShedId)
      : undefined;
  const draftReport = shed
    ? draft?.shedDailyReports.find(
        (r: CreateShedDailyReportDto) => r.shedId === shed.id,
      )
    : undefined;

  useEffect(() => {
    if (!shed || !draft) return;

    setShedData({
      shedId: shed.id,
      shedName: shed.name,
      birdsMortality: draftReport?.birdsMortality ?? undefined,
      damagedEggs: draftReport?.damagedEggs ?? undefined,
      standardEggsClosing: draftReport?.standardEggsClosing ?? undefined,
      smallEggsClosing: draftReport?.smallEggsClosing ?? undefined,
      bigEggsClosing: draftReport?.bigEggsClosing ?? undefined,
      feedIssued:
        draftReport?.feedIssued ?? draftReport?.totalFeedReceipt ?? undefined,
      feedClosing:
        draftReport?.feedClosing ?? draftReport?.closingFeed ?? undefined,
    });
  }, [shed?.id, draft?.reportDate]);

  const resolveOpening = useCallback(async () => {
    if (!shed || openingResolved.current) return;
    openingResolved.current = true;

    const inferredOpeningBirds =
      draftReport?.openingBirds !== undefined
        ? draftReport.openingBirds
        : draftReport?.closingBirds !== undefined &&
            draftReport?.birdsMortality !== undefined
          ? draftReport.closingBirds + draftReport.birdsMortality
          : undefined;

    try {
      const resolution = await getOpeningBirdsForShed(date, shed.id);
      if (resolution.source === "previous_day") {
        setOpeningBirds(resolution.openingBirds ?? undefined);
        setIsOpeningReadOnly(true);
        return;
      }
      if (inferredOpeningBirds !== undefined) {
        setOpeningBirds(inferredOpeningBirds);
        setIsOpeningReadOnly(true);
        return;
      }
      setOpeningBirds(undefined);
      setIsOpeningReadOnly(false);
    } catch {
      setOpeningBirds(undefined);
      setIsOpeningReadOnly(false);
    }
  }, [shed?.id, date, draftReport, getOpeningBirdsForShed]);

  const resolveFeedOpening = useCallback(async () => {
    if (!shed || feedOpeningResolved.current) return;
    feedOpeningResolved.current = true;

    const inferredFeedOpening = draftReport?.feedOpening;

    try {
      const resolution = await getOpeningFeedForShed(date, shed.id);
      if (resolution.source === "previous_day") {
        setFeedOpening(resolution.openingFeed ?? undefined);
        setIsFeedOpeningReadOnly(true);
        return;
      }
      if (inferredFeedOpening !== undefined) {
        setFeedOpening(inferredFeedOpening);
        setIsFeedOpeningReadOnly(true);
        return;
      }
      setFeedOpening(undefined);
      setIsFeedOpeningReadOnly(false);
    } catch {
      setFeedOpening(undefined);
      setIsFeedOpeningReadOnly(false);
    }
  }, [shed?.id, date, draftReport, getOpeningFeedForShed]);

  const resolveOpeningEggs = useCallback(async () => {
    if (!shed || openingEggsResolved.current) return;
    openingEggsResolved.current = true;

    const inferredOpeningEggs =
      draftReport?.openingEggs ??
      draftReport?.totalEggsClosing ??
      ((draftReport?.standardEggsClosing ?? 0) +
        (draftReport?.smallEggsClosing ?? 0) +
        (draftReport?.bigEggsClosing ?? 0));

    try {
      const resolution = await getOpeningEggsForShed(date, shed.id);
      if (resolution.source === "previous_day") {
        setOpeningEggs(resolution.openingEggs ?? undefined);
        return;
      }
      if (inferredOpeningEggs !== undefined) {
        setOpeningEggs(inferredOpeningEggs);
        return;
      }
      setOpeningEggs(undefined);
    } catch {
      setOpeningEggs(undefined);
    }
  }, [shed?.id, date, draftReport, getOpeningEggsForShed]);

  useEffect(() => {
    if (shed && draft) {
      resolveOpening();
      resolveFeedOpening();
      resolveOpeningEggs();
    }
  }, [
    shed?.id,
    draft?.reportDate,
    resolveOpening,
    resolveFeedOpening,
    resolveOpeningEggs,
  ]);

  const updateField = (
    field: keyof Omit<ShedDataRow, "shedName">,
    value: string | number,
  ) => {
    if (!shedData) return;
    const numValue = value === "" ? undefined : Number(value);
    setShedData({ ...shedData, [field]: numValue });
  };

  const computedClosingBirds =
    openingBirds !== undefined && shedData?.birdsMortality !== undefined
      ? openingBirds - shedData.birdsMortality
      : undefined;
  const computedTotalEggsClosing =
    shedData?.standardEggsClosing !== undefined &&
    shedData?.smallEggsClosing !== undefined &&
    shedData?.bigEggsClosing !== undefined
      ? shedData.standardEggsClosing +
        shedData.smallEggsClosing +
        shedData.bigEggsClosing
      : undefined;
  const soldEggsForShed =
    draft?.sales?.reduce((saleSum, sale) => {
      const itemSum = (sale.items ?? [])
        .filter((item) => item.shedId === shed?.id)
        .reduce(
          (sum, item) =>
            sum +
            (item.standardEggs ?? 0) +
            (item.smallEggs ?? 0) +
            (item.bigEggs ?? 0),
          0,
        );
      return saleSum + itemSum;
    }, 0) ?? 0;
  const loadingDamageForShed =
    draft?.sales?.reduce((saleSum, sale) => {
      const itemSum = (sale.items ?? [])
        .filter((item) => item.shedId === shed?.id)
        .reduce((sum, item) => sum + (item.loadingDamage ?? 0), 0);
      return saleSum + itemSum;
    }, 0) ?? 0;
  const computedEggsProduced =
    openingEggs !== undefined && computedTotalEggsClosing !== undefined
      ? computedTotalEggsClosing -
        openingEggs +
        soldEggsForShed +
        loadingDamageForShed
      : undefined;
  const computedFeedConsumed =
    feedOpening !== undefined &&
    shedData?.feedClosing !== undefined &&
    shedData?.feedIssued !== undefined
      ? feedOpening - shedData.feedClosing + shedData.feedIssued
      : undefined;

  const handleSave = () => {
    if (!shedData || !draft) return;

    setError(null);

    // Validation: Check that all fields are defined and are numbers
    const fields: (keyof Omit<ShedDataRow, "shedName" | "shedId">)[] = [
      "birdsMortality",
      "damagedEggs",
      "standardEggsClosing",
      "smallEggsClosing",
      "bigEggsClosing",
      "feedIssued",
      "feedClosing",
    ];

    for (const field of fields) {
      const value = shedData[field];
      if (value === undefined || value === null || isNaN(value)) {
        setError(
          `${field.replace(/([A-Z])/g, " $1").toLowerCase()} must be a valid number`,
        );
        return;
      }
      if (Number(value) < 0) {
        setError(
          `${field.replace(/([A-Z])/g, " $1").toLowerCase()} cannot be negative`,
        );
        return;
      }
    }

    if (openingBirds === undefined || isNaN(openingBirds)) {
      setError("opening birds must be a valid number");
      return;
    }
    if (feedOpening === undefined || isNaN(feedOpening)) {
      setError("feed opening must be a valid number");
      return;
    }
    if (feedOpening < 0) {
      setError("feed opening cannot be negative");
      return;
    }

    if (computedClosingBirds === undefined || isNaN(computedClosingBirds)) {
      setError("closing birds could not be calculated");
      return;
    }
    if (computedTotalEggsClosing === undefined || isNaN(computedTotalEggsClosing)) {
      setError("total eggs closing could not be calculated");
      return;
    }
    if (computedEggsProduced === undefined || isNaN(computedEggsProduced)) {
      setError("eggs produced could not be calculated");
      return;
    }
    if (computedFeedConsumed === undefined || isNaN(computedFeedConsumed)) {
      setError("feed consumed could not be calculated");
      return;
    }

    if (computedClosingBirds < 0) {
      setError("closing birds cannot be negative");
      return;
    }
    if (computedEggsProduced < 0) {
      setError("eggs produced cannot be negative");
      return;
    }

    // Find all sheds in draft and update the current one
    const updatedReports: CreateShedDailyReportDto[] =
      draft.shedDailyReports.map((r: CreateShedDailyReportDto) =>
        r.shedId === shedData.shedId
          ? {
              shedId: shedData.shedId,
              openingBirds,
              birdsMortality: shedData.birdsMortality!,
              closingBirds: computedClosingBirds,
              openingEggs,
              damagedEggs: shedData.damagedEggs!,
              standardEggsClosing: shedData.standardEggsClosing!,
              smallEggsClosing: shedData.smallEggsClosing!,
              bigEggsClosing: shedData.bigEggsClosing!,
              feedOpening,
              feedIssued: shedData.feedIssued!,
              feedClosing: shedData.feedClosing!,
              feedConsumed: computedFeedConsumed,
              totalEggsClosing: computedTotalEggsClosing,
              eggsProduced: computedEggsProduced,
            }
          : r,
      );

    // If this is a new entry, add it
    if (!updatedReports.find((r) => r.shedId === shedData.shedId)) {
      updatedReports.push({
        shedId: shedData.shedId!,
        openingBirds,
        birdsMortality: shedData.birdsMortality!,
        closingBirds: computedClosingBirds,
        openingEggs,
        damagedEggs: shedData.damagedEggs!,
        standardEggsClosing: shedData.standardEggsClosing!,
        smallEggsClosing: shedData.smallEggsClosing!,
        bigEggsClosing: shedData.bigEggsClosing!,
        feedOpening,
        feedIssued: shedData.feedIssued!,
        feedClosing: shedData.feedClosing!,
        feedConsumed: computedFeedConsumed,
        totalEggsClosing: computedTotalEggsClosing,
        eggsProduced: computedEggsProduced,
      });
    }

    updateShedDailyReports(updatedReports);
    router.push(`/shed-data-entry?date=${date}`);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  if (authLoading || dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  if (!user || !shedData) {
    return null;
  }

  return (
    <div className="flex items-center justify-center overflow-x-hidden">
      <div className="w-full max-w-sm max-h-screen overflow-y-auto overflow-x-hidden">
        {/* Mobile App Header */}
        <AppHeader
          title={`Edit ${shedData.shedName}`}
          onBack={() => router.back()}
        />

        {/* Main Content */}
        <Card className="m-4">
          <CardContent className="space-y-4">
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-semibold">Birds Data</p>
              <div className="flex justify-between items-center">
                <span>Opening Birds</span>
                <Input
                  type="number"
                  className="w-40"
                  value={openingBirds ?? ""}
                  disabled={isOpeningReadOnly}
                  onChange={(e) => {
                    const value = e.target.value;
                    setOpeningBirds(value === "" ? undefined : Number(value));
                  }}
                />
              </div>

              <div className="flex justify-between items-center">
                <span>Birds Mortality</span>
                <Input
                  type="number"
                  className="w-40"
                  value={shedData.birdsMortality ?? ""}
                  onChange={(e) => updateField("birdsMortality", e.target.value)}
                />
              </div>

              <div className="flex justify-between items-center">
                <span>Closing Birds</span>
                <Input
                  type="number"
                  className="w-40"
                  value={computedClosingBirds ?? ""}
                  disabled
                />
              </div>
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-semibold">Eggs Data</p>
              <div className="flex justify-between items-center">
                <span>Opening Eggs</span>
                <Input
                  type="number"
                  className="w-40"
                  value={openingEggs ?? ""}
                  disabled
                />
              </div>

              <div className="flex justify-between items-center">
                <span>Damaged Eggs</span>
                <Input
                  type="number"
                  className="w-40"
                  value={shedData.damagedEggs ?? ""}
                  onChange={(e) => updateField("damagedEggs", e.target.value)}
                />
              </div>

              <div className="flex justify-between items-center">
                <span>Standard Eggs Closing</span>
                <Input
                  type="number"
                  className="w-40"
                  value={shedData.standardEggsClosing ?? ""}
                  onChange={(e) =>
                    updateField("standardEggsClosing", e.target.value)
                  }
                />
              </div>

              <div className="flex justify-between items-center">
                <span>Small Eggs Closing</span>
                <Input
                  type="number"
                  className="w-40"
                  value={shedData.smallEggsClosing ?? ""}
                  onChange={(e) => updateField("smallEggsClosing", e.target.value)}
                />
              </div>

              <div className="flex justify-between items-center">
                <span>Big Eggs Closing</span>
                <Input
                  type="number"
                  className="w-40"
                  value={shedData.bigEggsClosing ?? ""}
                  onChange={(e) => updateField("bigEggsClosing", e.target.value)}
                />
              </div>

              <div className="flex justify-between items-center">
                <span>Total Closing Eggs</span>
                <Input
                  type="number"
                  className="w-40"
                  value={computedTotalEggsClosing ?? ""}
                  disabled
                />
              </div>

              <div className="flex justify-between items-center">
                <span>Sold Eggs</span>
                <Input
                  type="number"
                  className="w-40"
                  value={soldEggsForShed}
                  disabled
                />
              </div>

              <div className="flex justify-between items-center">
                <span>Loading Damage</span>
                <Input
                  type="number"
                  className="w-40"
                  value={loadingDamageForShed}
                  disabled
                />
              </div>

              <div className="flex justify-between items-center">
                <span>Eggs Produced</span>
                <Input
                  type="number"
                  className="w-40"
                  value={computedEggsProduced ?? ""}
                  disabled
                />
              </div>
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-semibold">Feed Data</p>
              <div className="flex justify-between items-center">
                <span>Feed Opening</span>
                <Input
                  type="number"
                  className="w-40"
                  value={feedOpening ?? ""}
                  disabled={isFeedOpeningReadOnly}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFeedOpening(value === "" ? undefined : Number(value));
                  }}
                />
              </div>

              <div className="flex justify-between items-center">
                <span>Feed Issued</span>
                <Input
                  type="number"
                  className="w-40"
                  value={shedData.feedIssued ?? ""}
                  onChange={(e) => updateField("feedIssued", e.target.value)}
                />
              </div>

              <div className="flex justify-between items-center">
                <span>Feed Closing</span>
                <Input
                  type="number"
                  className="w-40"
                  value={shedData.feedClosing ?? ""}
                  onChange={(e) => updateField("feedClosing", e.target.value)}
                />
              </div>

              <div className="flex justify-between items-center">
                <span>Feed Consumed</span>
                <Input
                  type="number"
                  className="w-40"
                  value={computedFeedConsumed ?? ""}
                  disabled
                />
              </div>
            </div>

            {error && (
              <p className="text-destructive text-center mt-8">{error}</p>
            )}

            <Button className="w-full mt-2" size={"lg"} onClick={handleSave}>
              Save
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
