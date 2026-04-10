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
import { useAuth } from "@/lib/auth-context";
import { useDailyReportDraft } from "@/lib/daily-report-draft-context";
import type { CreateFeedReceiptDto } from "@/lib/types";
import { PlusIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface FeedPlantEntryClientProps {
  date: string;
}

export function FeedPlantEntryClient({ date }: FeedPlantEntryClientProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { draft, loadDraft, updateFeedReceipts, markNoFeedReceipts } =
    useDailyReportDraft();
  const { parties, feedItems } = useAppData();

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

  const getFeedItemName = (itemId: number) => {
    return feedItems.find((i) => i.id === itemId)?.name || `Item ${itemId}`;
  };

  const handleDeleteEntry = (index: number) => {
    if (draft && draft.feedReceipts) {
      const newReceipts = draft.feedReceipts.filter((_, i) => i !== index);
      updateFeedReceipts(newReceipts);
    }
  };

  const handleNoFeedReceipts = () => {
    const confirmed = window.confirm(
      "Confirm no feed receipts for this date? You can edit feed data later, but shed data will be reset.",
    );
    if (!confirmed) return;
    markNoFeedReceipts(true);
    alert("Marked as No Feed Receipts. If shed data existed, it has been reset.");
  };

  return (
    <div className="flex items-center justify-center">
      <div className="w-full max-w-sm">
        {/* Mobile App Header */}
        <AppHeader
          title="Feed Plant Entry"
          onBack={() => router.replace(`/?date=${date}`)}
        />

        {/* Main Content */}

        {/* Entries Table */}
        <Card className="m-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Entries ({draft?.feedReceipts.length || 0})</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="lg" onClick={handleNoFeedReceipts}>
                No Feed Receipts
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() =>
                  router.push(`/feed-plant-entry/add-entry?date=${date}`)
                }
              >
                <PlusIcon className="size-4 mr-1" />
                Add
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {draft && draft.feedReceipts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="p-4 pl-0 text-center">
                      Action
                    </TableHead>
                    <TableHead className="p-4 pl-0">Party</TableHead>
                    <TableHead className="p-4 pl-0">Item</TableHead>
                    <TableHead className="p-4 pl-0">Vehicle</TableHead>
                    <TableHead className="p-4 pl-0 text-right">
                      Qty (kg)
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {draft.feedReceipts.map(
                    (entry: CreateFeedReceiptDto, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="p-4 pl-0 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteEntry(index)}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </TableCell>
                        <TableCell className="p-4 pl-0">
                          {getPartyName(entry.partyId)}
                        </TableCell>
                        <TableCell className="p-4 pl-0">
                          {getFeedItemName(entry.feedItemId)}
                        </TableCell>
                        <TableCell className="p-4 pl-0">
                          {entry.vehicleNumber}
                        </TableCell>
                        <TableCell className="p-4 pl-0 text-right">
                          {entry.quantityKg}
                        </TableCell>
                      </TableRow>
                    ),
                  )}
                </TableBody>
              </Table>
            ) : (
              <p className="text-gray-500 text-center py-4">
                {draft?.noFeedReceiptsConfirmed
                  ? "No Feed Receipts confirmed for this date"
                  : "No entries yet"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
