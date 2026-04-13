"use client";

import { AppHeader } from "@/components/custom/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAppData } from "@/lib/app-data-context";
import { getAllDailyReports } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { todayIsoLocal, yyyymmddToIso } from "@/lib/date-utils";
import {
  DailyReportDraft,
  useDailyReportDraft,
} from "@/lib/daily-report-draft-context";
import type { CreateShedDailyReportDto } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ShedDataRow = {
  shedId: number;
  shedName: string;
  openingBirds?: number;
  birdsMortality?: number;
  closingBirds?: number;
  openingEggs?: number;
  damagedEggs?: number;
  standardEggsClosing?: number;
  smallEggsClosing?: number;
  bigEggsClosing?: number;
  totalEggsClosing?: number;
  feedOpening?: number;
  feedIssued?: number;
  feedClosing?: number;
  feedConsumed?: number;
};

interface ShedDataEntryClientProps {
  date: string;
}

export function ShedDataEntryClient({ date }: ShedDataEntryClientProps) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { sheds, isLoading: dataLoading } = useAppData();
  const { draft, loadDraft, updateShedDailyReports } = useDailyReportDraft();
  const [isEditableDate, setIsEditableDate] = useState(false);
  const todayDate = todayIsoLocal();

  // Initialize data when draft is loaded
  useEffect(() => {
    loadDraft(date);
  }, [date]);

  useEffect(() => {
    const loadEditability = async () => {
      try {
        const reports = await getAllDailyReports();
        if (reports.length === 0) {
          setIsEditableDate(date === todayDate);
          return;
        }
        const latest = yyyymmddToIso(Math.max(...reports.map((r) => r.reportDate)));
        setIsEditableDate(date >= latest && date <= todayDate);
      } catch {
        setIsEditableDate(date === todayDate);
      }
    };
    void loadEditability();
  }, [date, todayDate]);

  // Compute form data from sheds and draft
  const data =
    sheds && draft
      ? sheds.map((shed) => {
          const draftReport = draft.shedDailyReports.find(
            (r: CreateShedDailyReportDto) => r.shedId === shed.id,
          );

          return {
            shedId: shed.id,
            shedName: shed.name,
            openingBirds: draftReport?.openingBirds ?? undefined,
            birdsMortality: draftReport?.birdsMortality ?? undefined,
            closingBirds: draftReport?.closingBirds ?? undefined,
            openingEggs: draftReport?.openingEggs ?? undefined,
            damagedEggs: draftReport?.damagedEggs ?? undefined,
            standardEggsClosing: draftReport?.standardEggsClosing ?? undefined,
            smallEggsClosing: draftReport?.smallEggsClosing ?? undefined,
            bigEggsClosing: draftReport?.bigEggsClosing ?? undefined,
            totalEggsClosing: draftReport?.totalEggsClosing ?? undefined,
            feedOpening: draftReport?.feedOpening ?? undefined,
            feedIssued:
              draftReport?.feedIssued ?? draftReport?.totalFeedReceipt ?? undefined,
            feedClosing:
              draftReport?.feedClosing ?? draftReport?.closingFeed ?? undefined,
            feedConsumed: draftReport?.feedConsumed ?? undefined,
          };
        })
      : [];

  const isShedRowComplete = (
    row: ShedDataRow,
    draft: DailyReportDraft | null,
  ) => {
    return !!draft?.shedDailyReports?.find((s) => s.shedId == row.shedId);
  };

  const handleSubmit = () => {
    if (!isEditableDate) {
      alert("This date is read-only.");
      return;
    }
    const dtoData: CreateShedDailyReportDto[] = data.map((d) => ({
      shedId: d.shedId,
      openingBirds: d.openingBirds,
      birdsMortality: d.birdsMortality!,
      closingBirds: d.closingBirds!,
      openingEggs: d.openingEggs,
      damagedEggs: d.damagedEggs!,
      standardEggsClosing: d.standardEggsClosing!,
      smallEggsClosing: d.smallEggsClosing!,
      bigEggsClosing: d.bigEggsClosing!,
      totalEggsClosing:
        d.totalEggsClosing ??
        (d.standardEggsClosing ?? 0) +
          (d.smallEggsClosing ?? 0) +
          (d.bigEggsClosing ?? 0),
      feedOpening: d.feedOpening!,
      feedIssued: d.feedIssued!,
      feedClosing: d.feedClosing!,
      feedConsumed:
        d.feedConsumed ??
        (d.feedOpening ?? 0) - (d.feedClosing ?? 0) + (d.feedIssued ?? 0),
    }));

    updateShedDailyReports(dtoData);
    router.replace(`/?date=${date}`);
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

  if (!user) {
    return null;
  }

  return (
    <div className="flex items-center justify-center">
      <div className="w-full max-w-sm">
        {/* Mobile App Header */}
        <AppHeader
          title="Shed Data Entry"
          onBack={() => router.replace(`/?date=${date}`)}
        />

        {/* Progress Header */}
        <p className="px-4 pt-4">
          {`${draft?.shedDailyReports?.length} of ${sheds.length} sheds completed`}
        </p>
        {!isEditableDate ? (
          <p className="px-4 pt-2 text-xs text-slate-600">
            This date is read-only.
          </p>
        ) : null}

        {/* Main Content */}
        <div className="p-4">
          {/* SHED LIST */}
          {data.length > 0 ? (
            <div className="space-y-2">
              {data.map((row) => (
                <Card key={row.shedId} className="cursor-pointer">
                  <CardContent className="ph-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-medium">{row.shedName}</h3>
                      <Button
                        size="sm"
                        variant={"outline"}
                        disabled={!isEditableDate}
                        onClick={() =>
                          router.push(
                            `/shed-data-entry/add-entry?date=${date}&shedId=${row.shedId}`,
                          )
                        }
                      >
                        {isShedRowComplete(row, draft) ? "Edit" : "Add Data"}
                      </Button>
                    </div>
                    {isShedRowComplete(row, draft) ? (
                      <table className="mt-2 text-sm text-muted-foreground border border-gray-200 rounded-lg w-full">
                        <tbody>
                          <tr className="border-b">
                            <td className="px-2 py-1 font-medium">
                              Opening Birds
                            </td>
                            <td className="px-2 py-1">{row.openingBirds}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="px-2 py-1 font-medium">
                              Birds Mortality
                            </td>
                            <td className="px-2 py-1">{row.birdsMortality}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="px-2 py-1 font-medium">
                              Closing Birds
                            </td>
                            <td className="px-2 py-1">{row.closingBirds}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="px-2 py-1 font-medium">
                              Opening Eggs
                            </td>
                            <td className="px-2 py-1">{row.openingEggs}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="px-2 py-1 font-medium">
                              Damaged Eggs
                            </td>
                            <td className="px-2 py-1">{row.damagedEggs}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="px-2 py-1 font-medium">
                              Standard Eggs
                            </td>
                            <td className="px-2 py-1">
                              {row.standardEggsClosing}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="px-2 py-1 font-medium">
                              Small Eggs
                            </td>
                            <td className="px-2 py-1">
                              {row.smallEggsClosing}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-2 py-1 font-medium">
                              Big Eggs Closing
                            </td>
                            <td className="px-2 py-1">
                              {row.bigEggsClosing}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="px-2 py-1 font-medium">
                              Total Closing Eggs
                            </td>
                            <td className="px-2 py-1">
                              {row.totalEggsClosing}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="px-2 py-1 font-medium">
                              Feed Opening
                            </td>
                            <td className="px-2 py-1">
                              {row.feedOpening}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="px-2 py-1 font-medium">
                              Feed Issued
                            </td>
                            <td className="px-2 py-1">
                              {row.feedIssued}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="px-2 py-1 font-medium">
                              Feed Closing
                            </td>
                            <td className="px-2 py-1">
                              {row.feedClosing}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-2 py-1 font-medium">
                              Feed Consumed
                            </td>
                            <td className="px-2 py-1">
                              {row.feedConsumed}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    ) : null}

                    {/* {isShedRowComplete(row, draft) ? (
                      <div className="space-y-1 text-sm mt-2 text-muted-foreground">
                        <p>{`Birds Mortality: ${row.birdsMortality}`}</p>
                        <p>{`Closing Birds: ${row.closingBirds}`}</p>
                        <p>{`Damaged Eggs: ${row.damagedEggs}`}</p>
                        <p>{`Standard Eggs: ${row.standardEggsClosing}`}</p>
                        <p>{`Small Eggs: ${row.smallEggsClosing}`}</p>
                        <p>{`Total Feed: ${row.totalFeedReceipt}`}</p>
                      </div>
                    ) : null} */}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">Loading sheds...</p>
          )}
          <Button
            className="w-full mt-4"
            size={"lg"}
            onClick={handleSubmit}
            disabled={!isEditableDate || sheds.length != draft?.shedDailyReports?.length}
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
