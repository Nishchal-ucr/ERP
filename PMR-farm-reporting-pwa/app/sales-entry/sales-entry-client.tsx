"use client";

import { AppHeader } from "@/components/custom/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppData } from "@/lib/app-data-context";
import { getAllDailyReports } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { todayIsoLocal, yyyymmddToIso } from "@/lib/date-utils";
import { useDailyReportDraft } from "@/lib/daily-report-draft-context";
import type { CreateSaleDto } from "@/lib/types";
import { PlusIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface SalesEntryClientProps {
  date: string;
}

export function SalesEntryClient({ date }: SalesEntryClientProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { draft, loadDraft, updateSales, markNoSales } = useDailyReportDraft();
  const { sheds, parties } = useAppData();
  const [isEditableDate, setIsEditableDate] = useState(false);
  const todayDate = todayIsoLocal();

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

  useEffect(() => {
    loadDraft(date);
  }, [date]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

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

  const getPartyName = (partyId: number) => {
    return parties.find((p) => p.id === partyId)?.name || `Party ${partyId}`;
  };

  const handleDeleteEntry = (index: number) => {
    if (!isEditableDate) {
      alert("This date is read-only.");
      return;
    }
    if (draft && draft.sales) {
      const newSales = draft.sales.filter((_, i) => i !== index);
      updateSales(newSales);
    }
  };

  const handleNoSales = () => {
    if (!isEditableDate) {
      alert("This date is read-only.");
      return;
    }
    const confirmed = window.confirm(
      "Confirm no sales for this date? You can edit sales later, but shed data will be reset.",
    );
    if (!confirmed) return;
    markNoSales(true);
    alert("Marked as No Sales. If shed data existed, it has been reset.");
  };

  return (
    <div className="flex items-center justify-center">
      <div className="w-full max-w-sm">
        {/* Mobile App Header */}
        <AppHeader
          title="Sales Entry"
          onBack={() => router.replace(`/?date=${date}`)}
        />

        {/* Main Content */}

        {/* Entries Table */}
        <Card className="m-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Entries ({draft?.sales.length || 0})</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="lg"
                onClick={handleNoSales}
                disabled={!isEditableDate}
              >
                No Sales
              </Button>
              <Button
                variant="outline"
                size="lg"
                disabled={!isEditableDate}
                onClick={() => router.push(`/sales-entry/add-entry?date=${date}`)}
              >
                <PlusIcon className="size-4 mr-1" />
                Add
              </Button>
            </div>
          </CardHeader>
          {!isEditableDate ? (
            <p className="px-6 pb-2 text-xs text-slate-600">
              This date is read-only.
            </p>
          ) : null}

          <CardContent>
            {draft && draft.sales.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="p-4 pl-0">Party</TableHead>
                    <TableHead className="p-4 pl-0">Vehicle</TableHead>
                    <TableHead className="p-4 pl-0 text-right">
                      Std Eggs
                    </TableHead>
                    <TableHead className="p-4 pl-0 text-right">
                      Sm Eggs
                    </TableHead>
                    <TableHead className="p-4 pl-0 text-right">
                      Big Eggs
                    </TableHead>
                    <TableHead className="p-4 pl-0 text-right">
                      Loading Damage
                    </TableHead>
                    <TableHead className="p-4 pl-0 text-center">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {draft.sales.map((entry: CreateSaleDto, index: number) => (
                    <TableRow key={index}>
                      <TableCell className="p-4 pl-0">
                        {getPartyName(entry.partyId)}
                      </TableCell>
                      <TableCell className="p-4 pl-0">
                        {entry.vehicleNumber}
                      </TableCell>
                      <TableCell className="p-4 pl-0 text-right">
                        {entry.items?.reduce(
                          (sum, item) => sum + (item.standardEggs || 0),
                          0,
                        ) || 0}
                      </TableCell>
                      <TableCell className="p-4 pl-0 text-right">
                        {entry.items?.reduce(
                          (sum, item) => sum + (item.smallEggs || 0),
                          0,
                        ) || 0}
                      </TableCell>
                      <TableCell className="p-4 pl-0 text-right">
                        {entry.items?.reduce(
                          (sum, item) => sum + (item.bigEggs || 0),
                          0,
                        ) || 0}
                      </TableCell>
                      <TableCell className="p-4 pl-0 text-right">
                        {entry.items?.reduce(
                          (sum, item) => sum + (item.loadingDamage || 0),
                          0,
                        ) || 0}
                      </TableCell>
                      <TableCell className="p-4 pl-0 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!isEditableDate}
                          onClick={() => handleDeleteEntry(index)}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-gray-500 text-center py-4">
                {draft?.noSalesConfirmed
                  ? "No Sales confirmed for this date"
                  : "No entries yet"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
