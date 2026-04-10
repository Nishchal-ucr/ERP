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
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import {
  createFeedItem,
  createPartyForRole,
  type FeedItemCategory,
} from "@/lib/api";
import { useAppData } from "@/lib/app-data-context";
import { useDailyReportDraft } from "@/lib/daily-report-draft-context";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const ADD_PARTY = "__new_party__";
const ADD_FEED = "__new_feed__";

interface AddFeedPlantEntryClientProps {
  date: string;
}

export function AddFeedPlantEntryClient({
  date,
}: AddFeedPlantEntryClientProps) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { feedItems, parties, refreshData, isLoading: dataLoading } =
    useAppData();
  const { draft, updateFeedReceipts, markNoFeedReceipts } =
    useDailyReportDraft();

  const sellerParties = useMemo(
    () =>
      [...parties]
        .filter((p) => p.type === "SUPPLIER" || p.type === "BOTH")
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

  const [partySheetOpen, setPartySheetOpen] = useState(false);
  const [feedSheetOpen, setFeedSheetOpen] = useState(false);
  const [newPartyName, setNewPartyName] = useState("");
  const [newFeedName, setNewFeedName] = useState("");
  const [newFeedCategory, setNewFeedCategory] =
    useState<FeedItemCategory>("INGREDIENT");
  const [savingParty, setSavingParty] = useState(false);
  const [savingFeed, setSavingFeed] = useState(false);

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

  const handlePartySelect = (value: string) => {
    if (value === ADD_PARTY) {
      setPartySheetOpen(true);
      return;
    }
    setParty(value);
  };

  const handleFeedSelect = (value: string) => {
    if (value === ADD_FEED) {
      setFeedSheetOpen(true);
      return;
    }
    setFeedItem(value);
  };

  const saveNewParty = async () => {
    const name = newPartyName.trim();
    if (!name) {
      alert("Please enter a party name");
      return;
    }
    setSavingParty(true);
    try {
      const created = await createPartyForRole(name, "seller");
      await refreshData();
      setParty(String(created.id));
      setNewPartyName("");
      setPartySheetOpen(false);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Failed to add party";
      alert(msg);
    } finally {
      setSavingParty(false);
    }
  };

  const saveNewFeedItem = async () => {
    const name = newFeedName.trim();
    if (!name) {
      alert("Please enter a feed item name");
      return;
    }
    setSavingFeed(true);
    try {
      const qtyParsed = parseFloat(quantity);
      const closingKg = Number.isFinite(qtyParsed) ? qtyParsed : 0;
      const created = await createFeedItem(name, newFeedCategory, closingKg);
      await refreshData();
      setFeedItem(String(created.id));
      setNewFeedName("");
      setNewFeedCategory("INGREDIENT");
      setFeedSheetOpen(false);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Failed to add feed item";
      alert(msg);
    } finally {
      setSavingFeed(false);
    }
  };

  return (
    <div className="flex items-center justify-center">
      <div className="w-full max-w-sm">
        <AppHeader title="Add Feed Plant Entry" onBack={() => router.back()} />
        <Card className="m-4">
          <CardContent className="space-y-4">
            <Field>
              <FieldLabel htmlFor="party">Party</FieldLabel>
              <Select value={party || undefined} onValueChange={handlePartySelect}>
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
                  <SelectItem value={ADD_PARTY} className="text-primary">
                    + Add new party…
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="feed-item">Feed Item</FieldLabel>
              <Select
                value={feedItem || undefined}
                onValueChange={handleFeedSelect}
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
                  <SelectItem value={ADD_FEED} className="text-primary">
                    + Add new feed item…
                  </SelectItem>
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

      <Sheet open={partySheetOpen} onOpenChange={setPartySheetOpen}>
        <SheetContent side="bottom" className="max-w-sm mx-auto w-full">
          <SheetHeader>
            <SheetTitle>New party</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-2">
            <Field>
              <FieldLabel htmlFor="new-party-name">Name</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="new-party-name"
                  placeholder="Supplier name"
                  value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                  disabled={savingParty}
                />
              </InputGroup>
            </Field>
          </div>
          <SheetFooter>
            <Button
              className="w-full"
              onClick={saveNewParty}
              disabled={savingParty}
            >
              {savingParty ? "Saving…" : "Save and select"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={feedSheetOpen} onOpenChange={setFeedSheetOpen}>
        <SheetContent side="bottom" className="max-w-sm mx-auto w-full">
          <SheetHeader>
            <SheetTitle>New feed item</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-2 space-y-4">
            <Field>
              <FieldLabel htmlFor="new-feed-name">Name</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="new-feed-name"
                  placeholder="Item name"
                  value={newFeedName}
                  onChange={(e) => setNewFeedName(e.target.value)}
                  disabled={savingFeed}
                />
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="new-feed-category">Category</FieldLabel>
              <Select
                value={newFeedCategory}
                onValueChange={(v) =>
                  setNewFeedCategory(v as FeedItemCategory)
                }
                disabled={savingFeed}
              >
                <SelectTrigger id="new-feed-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INGREDIENT">Ingredient</SelectItem>
                  <SelectItem value="MEDICINE">Medicine</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <SheetFooter>
            <Button
              className="w-full"
              onClick={saveNewFeedItem}
              disabled={savingFeed}
            >
              {savingFeed ? "Saving…" : "Save and select"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
