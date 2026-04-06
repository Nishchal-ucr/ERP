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
import type { CreateSaleItemDto } from "@/lib/types";

type SaleEntry = {
  shed: string;
  standardEggs: string;
  smallEggs: string;
  bigEggs: string;
  loadingDamage: string;
};

interface AddSalesEntryClientProps {
  date: string;
}

export function AddSalesEntryClient({ date }: AddSalesEntryClientProps) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { sheds, parties, isLoading: dataLoading } = useAppData();
  const { draft, updateSales, markNoSales } = useDailyReportDraft();

  const [entries, setEntries] = useState<SaleEntry[]>([
    { shed: "", standardEggs: "", smallEggs: "", bigEggs: "", loadingDamage: "" },
  ]);
  const [party, setParty] = useState("");
  const [vehicle, setVehicle] = useState("");

  const addEntry = () => {
    setEntries([
      ...entries,
      { shed: "", standardEggs: "", smallEggs: "", bigEggs: "", loadingDamage: "" },
    ]);
  };

  const removeEntry = (index: number) => {
    if (entries.length > 1) {
      setEntries(entries.filter((_, i) => i !== index));
    }
  };

  const updateEntry = (
    index: number,
    field: keyof SaleEntry,
    value: string | number,
  ) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setEntries(newEntries);
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

  const handleAddEntry = () => {
    // Validate inputs
    if (!party || !vehicle || entries.some((e) => !e.shed)) {
      alert("Please fill in all fields");
      return;
    }
    if (
      entries.some(
        (e) =>
          Number(e.standardEggs) < 0 ||
          Number(e.smallEggs) < 0 ||
          Number(e.bigEggs) < 0 ||
          Number(e.loadingDamage) < 0,
      )
    ) {
      alert("Egg counts and loading damage cannot be negative.");
      return;
    }

    // Create sale items from entries
    const saleItems: CreateSaleItemDto[] = entries.map((entry) => ({
      shedId: parseInt(entry.shed),
      standardEggs: Number(entry.standardEggs),
      smallEggs: Number(entry.smallEggs),
      bigEggs: Number(entry.bigEggs),
      loadingDamage: Number(entry.loadingDamage),
    }));

    // Create sale object
    const newSale = {
      partyId: parseInt(party),
      vehicleNumber: vehicle,
      items: saleItems,
    };

    // Update draft with new sale
    if (draft) {
      if (draft.shedDailyReports.length > 0) {
        alert("Shed data will be reset because sales data changed.");
      }
      const updatedSales = [...draft.sales, newSale];
      updateSales(updatedSales);
      markNoSales(false);
    }

    // Return to parent page
    router.push(`/sales-entry?date=${date}`);
  };

  return (
    <div className="flex items-center justify-center">
      <div className="w-full max-w-sm">
        {/* Mobile App Header */}
        <AppHeader title="Add Sales Entry" onBack={() => router.back()} />
        {/* Main Content */}
        <Card className="m-4">
          <CardContent className="space-y-4">
            {/* Party */}
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

            {/* Sale Entries */}
            {entries.map((entry, index) => (
              <div key={index} className="space-y-2 border-t pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Shed {index + 1}</h3>
                  {entries.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeEntry(index)}
                    >
                      Remove
                    </Button>
                  )}
                </div>

                {/* Shed */}
                <Field>
                  <FieldLabel htmlFor={`shed-${index}`}>Shed</FieldLabel>
                  <Select
                    value={entry.shed}
                    onValueChange={(value) => updateEntry(index, "shed", value)}
                  >
                    <SelectTrigger id={`shed-${index}`} className="w-full">
                      <SelectValue placeholder="Select Shed" />
                    </SelectTrigger>
                    <SelectContent>
                      {sheds.map((shed) => (
                        <SelectItem key={shed.id} value={shed.id.toString()}>
                          {shed.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {/* Standard Eggs */}
                <Field>
                  <FieldLabel htmlFor={`standard-${index}`}>
                    Standard Eggs
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id={`standard-${index}`}
                      type="number"
                      placeholder=""
                      value={entry.standardEggs}
                      onChange={(e) =>
                        updateEntry(
                          index,
                          "standardEggs",
                          Number(e.target.value),
                        )
                      }
                    />
                  </InputGroup>
                </Field>

                {/* Small Eggs */}
                <Field>
                  <FieldLabel htmlFor={`small-${index}`}>Small Eggs</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id={`small-${index}`}
                      type="number"
                      placeholder=""
                      value={entry.smallEggs}
                      onChange={(e) =>
                        updateEntry(index, "smallEggs", Number(e.target.value))
                      }
                    />
                  </InputGroup>
                </Field>

                <Field>
                  <FieldLabel htmlFor={`big-${index}`}>Big Eggs</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id={`big-${index}`}
                      type="number"
                      placeholder=""
                      value={entry.bigEggs}
                      onChange={(e) =>
                        updateEntry(index, "bigEggs", Number(e.target.value))
                      }
                    />
                  </InputGroup>
                </Field>

                <Field>
                  <FieldLabel htmlFor={`loading-damage-${index}`}>
                    Loading Damage
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id={`loading-damage-${index}`}
                      type="number"
                      placeholder=""
                      value={entry.loadingDamage}
                      onChange={(e) =>
                        updateEntry(
                          index,
                          "loadingDamage",
                          Number(e.target.value),
                        )
                      }
                    />
                  </InputGroup>
                </Field>
              </div>
            ))}

            {/* Add Another Shed Button */}
            <Button variant="outline" onClick={addEntry} className="w-full">
              Add Another Shed
            </Button>

            <Button className="w-full" size={"lg"} onClick={handleAddEntry}>
              Add Entry
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
