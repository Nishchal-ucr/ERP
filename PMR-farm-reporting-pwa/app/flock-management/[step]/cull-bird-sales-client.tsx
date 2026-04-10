"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getFlockSummary, postCullBirdSales } from "@/lib/api";
import { useAppData } from "@/lib/app-data-context";
import { useAuth } from "@/lib/auth-context";
import { todayIsoLocal } from "@/lib/date-utils";
import type { ApiError, FlockSummaryRow } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

function closingForShed(
  summary: FlockSummaryRow[] | null,
  shedId: number,
): number | null {
  if (!summary) return null;
  const row = summary.find((r) => r.shedId === shedId);
  return row?.closingBirds ?? null;
}

export function CullBirdSalesClient() {
  const { sheds, refreshData } = useAppData();
  const { user } = useAuth();
  const [summary, setSummary] = useState<FlockSummaryRow[] | null>(null);
  const [shedId, setShedId] = useState<string>("");
  const [mode, setMode] = useState<"all" | "count">("all");
  const [birdCount, setBirdCount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reportDate = todayIsoLocal();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getFlockSummary();
        if (!cancelled) setSummary(data);
      } catch {
        if (!cancelled) setSummary([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const latestClosing = useMemo(
    () => closingForShed(summary, shedId ? parseInt(shedId, 10) : -1),
    [summary, shedId],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);

    const sid = parseInt(shedId, 10);
    if (!shedId || Number.isNaN(sid)) {
      setError("Select a shed.");
      return;
    }
    if (latestClosing == null || latestClosing < 1) {
      setError("This shed has no birds to remove (check flock data).");
      return;
    }

    let n: number | undefined;
    if (mode === "count") {
      n = parseInt(birdCount, 10);
      if (Number.isNaN(n) || n < 1) {
        setError("Enter a valid number of birds.");
        return;
      }
      if (n > latestClosing) {
        setError("Cannot remove more birds than are in the shed.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await postCullBirdSales({
        shedId: sid,
        reportDate,
        submitterId: parseInt(user.id, 10),
        mode,
        birdCount: mode === "count" ? n : undefined,
      });
      const parts = [
        `Removed ${res.birdsRemoved} birds.`,
        `New closing: ${res.newClosingBirds}.`,
      ];
      if (res.flockCleared) parts.push("Shed is empty — flock cleared.");
      alert(parts.join(" "));
      await refreshData();
      const data = await getFlockSummary();
      setSummary(data);
    } catch (err) {
      const msg =
        (err as ApiError)?.message ??
        (err as { message?: string })?.message ??
        "Request failed.";
      setError(String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const activeSheds = sheds.filter((s) => s.active);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 px-4 py-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cull bird sales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cull-shed">Shed</Label>
            <Select value={shedId || undefined} onValueChange={setShedId}>
              <SelectTrigger id="cull-shed" className="w-full max-w-none">
                <SelectValue placeholder="Select shed" />
              </SelectTrigger>
              <SelectContent>
                {activeSheds.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {shedId ? (
              <p className="text-xs text-muted-foreground">
                Latest closing birds:{" "}
                {latestClosing != null ? latestClosing : "No data"}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>How many birds</Label>
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="cull-mode"
                  checked={mode === "all"}
                  onChange={() => setMode("all")}
                  className="accent-primary"
                />
                All birds in shed
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="cull-mode"
                  checked={mode === "count"}
                  onChange={() => setMode("count")}
                  className="accent-primary"
                />
                Specific number
              </label>
            </div>
            {mode === "count" ? (
              <Input
                type="number"
                min={1}
                max={latestClosing ?? undefined}
                value={birdCount}
                onChange={(e) => setBirdCount(e.target.value)}
                placeholder="Number of birds"
              />
            ) : null}
          </div>

          <p className="text-xs text-muted-foreground">
            Recorded on today&apos;s report ({reportDate}). Mortality is not
            increased; only closing birds are reduced.
          </p>

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={submitting || !shedId}
          >
            {submitting ? "Saving..." : "Record cull"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
