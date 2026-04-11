"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getFlockSummary, patchShedFlockId } from "@/lib/api";
import type { ApiError, FlockSummaryRow } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

export function ViewFlockDataClient() {
  const [rows, setRows] = useState<FlockSummaryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flockDraft, setFlockDraft] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await getFlockSummary();
    setRows(data);
    setFlockDraft((prev) => {
      const next = { ...prev };
      for (const r of data) {
        next[r.shedId] = r.flockNumber ?? "";
      }
      return next;
    });
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
        if (cancelled) return;
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setError(
            (e as { message?: string })?.message ??
              "Could not load flock summary.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const handleSave = async (shedId: number) => {
    const value = (flockDraft[shedId] ?? "").trim();
    if (!value) {
      setSaveError("Flock ID cannot be empty.");
      return;
    }
    setSaveError(null);
    setSavingId(shedId);
    try {
      await patchShedFlockId(shedId, value);
      await load();
    } catch (e) {
      const msg =
        (e as ApiError)?.message ??
        (e as { message?: string })?.message ??
        "Could not save flock ID.";
      setSaveError(String(msg));
    } finally {
      setSavingId(null);
    }
  };

  if (error) {
    return (
      <div className="px-4 py-6 text-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (rows === null) {
    return (
      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
        Loading flock data...
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
        No active sheds found.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {saveError ? (
        <p className="text-center text-sm text-destructive">{saveError}</p>
      ) : null}
      {rows.map((row) => (
        <Card key={row.shedId}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{row.shedName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-2">
              <span className="text-muted-foreground">Flock ID</span>
              <div className="flex gap-2">
                <Input
                  value={flockDraft[row.shedId] ?? ""}
                  onChange={(e) => {
                    setFlockDraft((d) => ({
                      ...d,
                      [row.shedId]: e.target.value,
                    }));
                    setSaveError(null);
                  }}
                  placeholder="Flock ID"
                  className="flex-1"
                  disabled={savingId === row.shedId}
                  autoComplete="off"
                />
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0"
                  disabled={
                    savingId === row.shedId ||
                    (flockDraft[row.shedId] ?? "").trim() ===
                      (row.flockNumber ?? "").trim()
                  }
                  onClick={() => handleSave(row.shedId)}
                >
                  {savingId === row.shedId ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Closing birds</span>
              <span className="font-medium text-right">
                {row.closingBirds != null ? row.closingBirds : "No data"}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Age</span>
              <span className="font-medium text-right">
                {row.ageWeeks != null ? `${row.ageWeeks} weeks` : "N/A"}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
