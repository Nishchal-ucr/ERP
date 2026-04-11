"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getFlockSummary, postShedTransfer } from "@/lib/api";
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

function toShedHasBirds(closing: number | null): boolean {
  return closing != null && closing > 0;
}

export function ShedTransferClient() {
  const { sheds, refreshData } = useAppData();
  const { user } = useAuth();
  const [summary, setSummary] = useState<FlockSummaryRow[] | null>(null);
  const [fromId, setFromId] = useState<string>("");
  const [toId, setToId] = useState<string>("");
  const [mode, setMode] = useState<"all" | "count">("all");
  const [birdCount, setBirdCount] = useState("");
  const [mergeConfirmed, setMergeConfirmed] = useState(false);
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

  const fromClosing = useMemo(
    () => closingForShed(summary, fromId ? parseInt(fromId, 10) : -1),
    [summary, fromId],
  );
  const toClosing = useMemo(
    () => closingForShed(summary, toId ? parseInt(toId, 10) : -1),
    [summary, toId],
  );

  const needsMergeConfirm = toId && fromId !== toId && toShedHasBirds(toClosing);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);

    const fid = parseInt(fromId, 10);
    const tid = parseInt(toId, 10);
    if (!fromId || !toId || Number.isNaN(fid) || Number.isNaN(tid)) {
      setError("Select both source and destination sheds.");
      return;
    }
    if (fid === tid) {
      setError("Source and destination must be different.");
      return;
    }
    if (fromClosing == null || fromClosing < 1) {
      setError("Source shed has no birds to transfer (check flock data).");
      return;
    }
    if (needsMergeConfirm && !mergeConfirmed) {
      setError("Confirm that you understand birds will be merged without copying flock metadata.");
      return;
    }

    let n: number | undefined;
    if (mode === "count") {
      n = parseInt(birdCount, 10);
      if (Number.isNaN(n) || n < 1) {
        setError("Enter a valid number of birds.");
        return;
      }
      if (n > fromClosing) {
        setError("Cannot transfer more birds than available in the source shed.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await postShedTransfer({
        fromShedId: fid,
        toShedId: tid,
        reportDate,
        submitterId: parseInt(user.id, 10),
        transferMode: mode,
        birdCount: mode === "count" ? n : undefined,
      });
      const parts = [
        `Transferred ${res.birdsTransferred} birds.`,
        `Source closing: ${res.fromClosingBirds}, destination closing: ${res.toClosingBirds}.`,
      ];
      if (res.metadataCopied) parts.push("Flock metadata was copied to the destination.");
      if (res.warning) parts.push(res.warning);
      alert(parts.join(" "));
      setMergeConfirmed(false);
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
          <CardTitle className="text-base">Shed transfer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="from-shed">From shed</Label>
            <Select
              value={fromId || undefined}
              onValueChange={(v) => {
                setFromId(v);
                setMergeConfirmed(false);
              }}
            >
              <SelectTrigger id="from-shed" className="w-full max-w-none">
                <SelectValue placeholder="Source shed" />
              </SelectTrigger>
              <SelectContent>
                {activeSheds.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fromId ? (
              <p className="text-xs text-muted-foreground">
                Latest closing birds:{" "}
                {fromClosing != null ? fromClosing : "No data"}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="to-shed">To shed</Label>
            <Select
              value={toId || undefined}
              onValueChange={(v) => {
                setToId(v);
                setMergeConfirmed(false);
              }}
            >
              <SelectTrigger id="to-shed" className="w-full max-w-none">
                <SelectValue placeholder="Destination shed" />
              </SelectTrigger>
              <SelectContent>
                {activeSheds.map((s) => (
                  <SelectItem
                    key={s.id}
                    value={String(s.id)}
                    disabled={fromId !== "" && String(s.id) === fromId}
                  >
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {toId ? (
              <p className="text-xs text-muted-foreground">
                Latest closing birds:{" "}
                {toClosing != null ? toClosing : "No data (empty)"}
              </p>
            ) : null}
          </div>

          {needsMergeConfirm ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
              <p className="font-medium">Destination already has birds</p>
              <p className="mt-1 text-xs">
                Flock metadata will <strong>not</strong> be copied. Only bird
                counts will be merged (added to the destination&apos;s closing
                birds).
              </p>
              <label className="mt-3 flex cursor-pointer items-start gap-2">
                <Checkbox
                  checked={mergeConfirmed}
                  onCheckedChange={(c) => setMergeConfirmed(c === true)}
                />
                <span>I understand — merge birds only</span>
              </label>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>How many birds</Label>
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "all"}
                  onChange={() => setMode("all")}
                  className="accent-primary"
                />
                All birds in source shed
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="mode"
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
                max={fromClosing ?? undefined}
                value={birdCount}
                onChange={(e) => setBirdCount(e.target.value)}
                placeholder="Number of birds"
              />
            ) : null}
          </div>

          <p className="text-xs text-muted-foreground">
            Transfer is recorded on today&apos;s report ({reportDate}). If the
            destination is empty, flock ID and birth date are copied from the
            source.
          </p>

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={
              submitting ||
              (needsMergeConfirm && !mergeConfirmed) ||
              !fromId ||
              !toId
            }
          >
            {submitting ? "Transferring..." : "Transfer"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
