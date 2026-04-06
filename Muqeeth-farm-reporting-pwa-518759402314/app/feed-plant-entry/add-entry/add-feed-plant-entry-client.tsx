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
import { useEffect, useState } from "react";

interface AddFeedPlantEntryClientProps {
  date: string;
}

export function AddFeedPlantEntryClient({
  date,
}: AddFeedPlantEntryClientProps) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { parties, feedItems, isLoading: dataLoading } = useAppData();
  const { draft, updateFeedReceipts, markNoFeedReceipts } =
    useDailyReportDraft();

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
    // Validate inputs
    if (!party || !feedItem || !vehicle || !quantity) {
      alert("Please fill in all fields");
      return;
    }

    // Create feed receipt object
    const newReceipt = {
      partyId: parseInt(party),
      feedItemId: parseInt(feedItem),
      vehicleNumber: vehicle,
      quantityKg: Number(quantity),
    };

    // Update draft with new receipt
    if (draft) {
      if (draft.shedDailyReports.length > 0) {
        alert("Shed data will be reset because feed data changed.");
      }
      const updatedReceipts = [...draft.feedReceipts, newReceipt];
      updateFeedReceipts(updatedReceipts);
      markNoFeedReceipts(false);
    }

    // Return to parent page
    router.push(`/feed-plant-entry?date=${date}`);
  };

  return (
    <div className="flex items-center justify-center">
      <div className="w-full max-w-sm">
        {/* Mobile App Header */}
        <AppHeader title="Add Feed Plant Entry" onBack={() => router.back()} />
        {/* Main Content */}
        <Card className="m-4">
          <CardContent className="space-y-4">
            <Field>
              <FieldLabel htmlFor="party">Party</FieldLabel>
              <Select value={party} onValueChange={setParty}>
                <SelectTrigger id="party" className="w-full">
                  <SelectValue placeholder="Select Party" />
                </SelectTrigger>
                <SelectContent>
                  {parties.map((party) => (
                    <SelectItem key={party.id} value={party.id.toString()}>
                      {party.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="feed-item">Feed Item</FieldLabel>
              <Select value={feedItem} onValueChange={setFeedItem}>
                <SelectTrigger id="feed-item" className="w-full">
                  <SelectValue placeholder="Select Item" />
                </SelectTrigger>
                <SelectContent>
                  {feedItems.map((item) => (
                    <SelectItem key={item.id} value={item.id.toString()}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {/* Vehicle Number */}
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

            {/* Quantity */}
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
