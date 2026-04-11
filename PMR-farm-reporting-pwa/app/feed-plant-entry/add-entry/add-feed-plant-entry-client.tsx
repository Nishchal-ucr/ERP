"use client";

import { AppHeader } from "@/components/custom/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useAppData } from "@/lib/app-data-context";
import { useDailyReportDraft } from "@/lib/daily-report-draft-context";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

interface AddFeedPlantEntryClientProps {
  date: string;
}

export function AddFeedPlantEntryClient({
  date,
}: AddFeedPlantEntryClientProps) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { feedItems, parties, isLoading: dataLoading } = useAppData();
  const { draft, updateFeedReceipts, markNoFeedReceipts } =
    useDailyReportDraft();

  const sellerParties = useMemo(
    () =>
      [...parties]
        .filter(
          (p) =>
            (p.type === "SUPPLIER" || p.type === "BOTH") && p.active !== false,
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [parties],
  );

  const sortedFeedItems = useMemo(
    () => [...feedItems].sort((a, b) => a.name.localeCompare(b.name)),
    [feedItems],
  );

  const [party, setParty] = useState("");
  const [feedItem, setFeedItem] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [quantity, setQuantity] = useState("");

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

  const handleAddEntry = () => {
    if (!party || !feedItem || !vehicle || !quantity) {
      alert("Please fill in all fields");
      return;
    }

    const newReceipt = {
      partyId: parseInt(party, 10),
      feedItemId: parseInt(feedItem, 10),
      vehicleNumber: vehicle,
      quantityKg: Number(quantity),
    };

    if (draft) {
      if (draft.shedDailyReports.length > 0) {
        alert("Shed data will be reset because feed data changed.");
      }
      const updatedReceipts = [...draft.feedReceipts, newReceipt];
      updateFeedReceipts(updatedReceipts);
      markNoFeedReceipts(false);
    }

    router.push(`/feed-plant-entry?date=${date}`);
  };

  return (
    <div className="flex items-center justify-center">
      <div className="w-full max-w-sm">
        <AppHeader title="Add Feed Plant Entry" onBack={() => router.back()} />
        <Card className="m-4">
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              To add sellers or feed items, use{" "}
              <span className="font-medium">Other options</span> on the home
              screen (Manage parties, Manage feed items).
            </p>

            <Field>
              <FieldLabel htmlFor="party">Party</FieldLabel>
              <Select value={party || undefined} onValueChange={setParty}>
                <SelectTrigger id="party" className="w-full">
                  <SelectValue placeholder="Select Party" />
                </SelectTrigger>
                <SelectContent>
                  {sellerParties.map((sellerParty) => (
                    <SelectItem
                      key={sellerParty.id}
                      value={sellerParty.id.toString()}
                    >
                      {sellerParty.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="feed-item">Feed Item</FieldLabel>
              <Select
                value={feedItem || undefined}
                onValueChange={setFeedItem}
              >
                <SelectTrigger id="feed-item" className="w-full">
                  <SelectValue placeholder="Select Item" />
                </SelectTrigger>
                <SelectContent>
                  {sortedFeedItems.map((item) => (
                    <SelectItem key={item.id} value={item.id.toString()}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="vehicle">Vehicle Number</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="vehicle"
                  placeholder="AP09XX11"
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                />
              </InputGroup>
            </Field>

            <Field>
              <FieldLabel htmlFor="quantity">Quantity (kg)</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="quantity"
                  type="number"
                  placeholder="20000"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </InputGroup>
            </Field>

            <Button className="w-full" size={"lg"} onClick={handleAddEntry}>
              Add Entry
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
