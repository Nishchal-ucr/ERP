"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFlockSummary } from "@/lib/api";
import type { FlockSummaryRow } from "@/lib/types";
import { useEffect, useState } from "react";

export function ViewFlockDataClient() {
  const [rows, setRows] = useState<FlockSummaryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getFlockSummary();
        if (!cancelled) {
          setRows(data);
          setError(null);
        }
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
  }, []);

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
      {rows.map((row) => (
        <Card key={row.shedId}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{row.shedName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Flock ID</span>
              <span className="font-medium text-right">
                {row.flockNumber ?? "—"}
              </span>
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
