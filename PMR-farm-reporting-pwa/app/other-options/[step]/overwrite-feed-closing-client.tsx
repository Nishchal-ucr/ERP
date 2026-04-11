"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getFeedItemDailyStockLatest,
  patchFeedItemDailyStock,
} from "@/lib/api";
import { yyyymmddToIso } from "@/lib/date-utils";
import type { ApiError, FeedItemDailyStockLatestDto } from "@/lib/types";
import { useCallback, useEffect, useMemo, useState } from "react";

function closingDiffersFromBaseline(
  raw: string | undefined,
  baselineKg: number,
): boolean {
  const trimmed = raw?.trim() ?? "";
  if (trimmed === "") return true;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return true;
  return Math.abs(parsed - baselineKg) > 1e-6;
}

export function OverwriteFeedClosingClient() {
  const [snapshot, setSnapshot] = useState<FeedItemDailyStockLatestDto | null>(
    null,
  );
  const [closingInputs, setClosingInputs] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const applySnapshot = useCallback((data: FeedItemDailyStockLatestDto) => {
    setSnapshot(data);
    const next: Record<number, string> = {};
    for (const row of data.items) {
      next[row.feedItemId] = String(row.closingKg);
    }
    setClosingInputs(next);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await getFeedItemDailyStockLatest();
      applySnapshot(data);
      setSaveSuccess(false);
    } catch (err) {
      const msg =
        (err as ApiError)?.message ??
        (err as { message?: string })?.message ??
        "Failed to load feed stock.";
      setError(String(msg));
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [applySnapshot]);

  useEffect(() => {
    void load();
  }, [load]);

  const isDirty = useMemo(() => {
    if (!snapshot?.items.length) return false;
    return snapshot.items.some((row) =>
      closingDiffersFromBaseline(
        closingInputs[row.feedItemId],
        row.closingKg,
      ),
    );
  }, [snapshot, closingInputs]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapshot?.reportDate || !isDirty) return;
    setFormError(null);
    setSaveSuccess(false);
    const items: { feedItemId: number; closingKg: number }[] = [];
    for (const row of snapshot.items) {
      const raw = closingInputs[row.feedItemId];
      const parsed = raw === undefined || raw.trim() === "" ? NaN : Number(raw);
      if (!Number.isFinite(parsed)) {
        setFormError(`Enter a valid number for ${row.name}.`);
        return;
      }
      if (parsed < 0) {
        setFormError(`Closing cannot be negative for ${row.name}.`);
        return;
      }
      items.push({ feedItemId: row.feedItemId, closingKg: parsed });
    }
    if (items.length === 0) {
      setFormError("Nothing to save.");
      return;
    }
    setSaving(true);
    try {
      const updated = await patchFeedItemDailyStock({
        reportDate: snapshot.reportDate,
        items,
      });
      applySnapshot(updated);
      setSaveSuccess(true);
    } catch (err) {
      const msg =
        (err as ApiError)?.message ??
        (err as { message?: string })?.message ??
        "Save failed.";
      setFormError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3 px-4 py-6">
        <p className="text-center text-sm text-destructive">{error}</p>
        <Button type="button" variant="outline" className="w-full" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  if (!snapshot?.reportDate || snapshot.items.length === 0) {
    return (
      <div className="space-y-2 px-4 py-6 text-center text-sm text-muted-foreground">
        <p>No feed stock snapshot yet.</p>
        <p className="text-xs">
          Submit a daily report with feed data first, or initialize stock from
          CSV.
        </p>
      </div>
    );
  }

  const dateLabel = yyyymmddToIso(snapshot.reportDate);

  return (
    <form className="space-y-4 px-4 py-4" onSubmit={handleSave}>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Stock date{" "}
        <span className="font-mono text-foreground">{dateLabel}</span>. Edit
        closing (kg) per item and save. This updates inventory only; it does
        not change submitted daily reports. The next day&apos;s opening uses
        these closing figures.
      </p>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Closing (kg)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="max-h-[min(60vh,28rem)] space-y-3 overflow-y-auto pr-1">
            {snapshot.items.map((row) => (
              <li
                key={row.feedItemId}
                className="flex min-h-[3.25rem] flex-col gap-2 rounded-md border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0 shrink font-medium leading-tight">
                  {row.name}
                </div>
                <div className="flex w-full flex-col gap-1.5 sm:max-w-[12rem] sm:shrink-0">
                  <Label
                    htmlFor={`closing-${row.feedItemId}`}
                    className="text-xs text-muted-foreground"
                  >
                    Closing (kg)
                  </Label>
                  <Input
                    id={`closing-${row.feedItemId}`}
                    inputMode="decimal"
                    className="h-10"
                    value={closingInputs[row.feedItemId] ?? ""}
                    onChange={(e) => {
                      setSaveSuccess(false);
                      setClosingInputs((prev) => ({
                        ...prev,
                        [row.feedItemId]: e.target.value,
                      }));
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {formError ? (
        <p className="text-center text-sm text-destructive">{formError}</p>
      ) : null}

      {saveSuccess ? (
        <p className="text-center text-sm text-emerald-700 dark:text-emerald-400">
          Changes saved.
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={saving || !isDirty}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
