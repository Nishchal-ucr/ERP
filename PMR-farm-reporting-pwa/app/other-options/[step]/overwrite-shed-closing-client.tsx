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
import { getDailyReportByDate, postShedClosingOverride } from "@/lib/api";
import { useAppData } from "@/lib/app-data-context";
import { useAuth } from "@/lib/auth-context";
import { todayIsoLocal } from "@/lib/date-utils";
import type { ApiError, ShedDailyReportResponseDto } from "@/lib/types";
import { useEffect, useState } from "react";

function numToInput(v: number | undefined | null): string {
  if (v === undefined || v === null) return "";
  return String(v);
}

export function OverwriteShedClosingClient() {
  const { sheds } = useAppData();
  const { user } = useAuth();
  const [reportDate, setReportDate] = useState(todayIsoLocal());
  const [shedId, setShedId] = useState("");
  const [closingBirds, setClosingBirds] = useState("");
  const [standardEggs, setStandardEggs] = useState("");
  const [smallEggs, setSmallEggs] = useState("");
  const [bigEggs, setBigEggs] = useState("");
  const [feedClosing, setFeedClosing] = useState("");
  const [loadingLine, setLoadingLine] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!shedId) {
      setLoadError(null);
      return;
    }
    const sid = parseInt(shedId, 10);
    if (Number.isNaN(sid)) return;

    let cancelled = false;
    setLoadingLine(true);
    setLoadError(null);

    (async () => {
      try {
        const rep = await getDailyReportByDate(reportDate);
        if (cancelled) return;
        const line = rep.shedDailyReports?.find((s) => s.shedId === sid);
        if (!line) {
          setLoadError("No shed entry for this date. Submit a full daily report first.");
          setClosingBirds("");
          setStandardEggs("");
          setSmallEggs("");
          setBigEggs("");
          setFeedClosing("");
          return;
        }
        applyLine(line);
      } catch (err) {
        if (cancelled) return;
        const status = (err as { status?: number }).status;
        if (status === 404) {
          setLoadError("No daily report for this date.");
          setClosingBirds("");
          setStandardEggs("");
          setSmallEggs("");
          setBigEggs("");
          setFeedClosing("");
          return;
        }
        setLoadError(
          (err as ApiError)?.message ?? "Could not load report for this date.",
        );
      } finally {
        if (!cancelled) setLoadingLine(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reportDate, shedId]);

  function applyLine(line: ShedDailyReportResponseDto) {
    setClosingBirds(numToInput(line.closingBirds));
    setStandardEggs(numToInput(line.standardEggsClosing));
    setSmallEggs(numToInput(line.smallEggsClosing));
    setBigEggs(numToInput(line.bigEggsClosing));
    const feed = line.feedClosing ?? line.closingFeed;
    setFeedClosing(numToInput(feed));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!user) return;

    const sid = parseInt(shedId, 10);
    if (!shedId || Number.isNaN(sid)) {
      setError("Select a shed.");
      return;
    }
    if (loadError) {
      setError("Fix the load issue above before saving.");
      return;
    }

    const cb = parseInt(closingBirds, 10);
    const se = parseInt(standardEggs, 10);
    const sm = parseInt(smallEggs, 10);
    const bg = parseInt(bigEggs, 10);
    const fc = parseFloat(feedClosing);

    if ([cb, se, sm, bg].some((n) => Number.isNaN(n) || n < 0)) {
      setError("Bird and egg fields must be non-negative whole numbers.");
      return;
    }
    if (Number.isNaN(fc) || fc < 0) {
      setError("Feed closing must be a non-negative number.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await postShedClosingOverride({
        reportDate,
        shedId: sid,
        submitterId: parseInt(user.id, 10),
        closingBirds: cb,
        standardEggsClosing: se,
        smallEggsClosing: sm,
        bigEggsClosing: bg,
        feedClosing: fc,
      });
      const parts = [
        "Closing values saved.",
        res.nextDayAdjusted
          ? "The next day’s opening birds, eggs, feed, and derived production/consumption were updated for this shed."
          : "No report for the following day, or no shed line there — openings will use these closings when you add the next report.",
      ];
      alert(parts.join(" "));
    } catch (err) {
      setError(
        (err as ApiError)?.message ??
          (err as { message?: string })?.message ??
          "Request failed.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const activeSheds = sheds.filter((s) => s.active);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 px-4 py-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Overwrite shed closing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="osc-date">Report date</Label>
            <Input
              id="osc-date"
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Correct closing birds, eggs, and feed for this day. If the next
              day is already submitted, its openings (and egg/feed calculations)
              are adjusted to match.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="osc-shed">Shed</Label>
            <Select value={shedId || undefined} onValueChange={setShedId}>
              <SelectTrigger id="osc-shed" className="w-full max-w-none">
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
          </div>

          {shedId ? (
            <div className="space-y-3 rounded-md border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground">
                {loadingLine
                  ? "Loading current values…"
                  : "Current closing values (edit below)"}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="osc-birds" className="text-xs">
                    Closing birds
                  </Label>
                  <Input
                    id="osc-birds"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={closingBirds}
                    onChange={(e) => setClosingBirds(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="osc-feed" className="text-xs">
                    Closing feed (kg)
                  </Label>
                  <Input
                    id="osc-feed"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={feedClosing}
                    onChange={(e) => setFeedClosing(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="osc-std" className="text-xs">
                    Standard eggs
                  </Label>
                  <Input
                    id="osc-std"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={standardEggs}
                    onChange={(e) => setStandardEggs(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="osc-small" className="text-xs">
                    Small eggs
                  </Label>
                  <Input
                    id="osc-small"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={smallEggs}
                    onChange={(e) => setSmallEggs(e.target.value)}
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label htmlFor="osc-big" className="text-xs">
                    Big eggs
                  </Label>
                  <Input
                    id="osc-big"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={bigEggs}
                    onChange={(e) => setBigEggs(e.target.value)}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : null}
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={
              submitting ||
              !shedId ||
              loadingLine ||
              !!loadError ||
              !closingBirds ||
              !standardEggs ||
              !smallEggs ||
              !bigEggs ||
              feedClosing === ""
            }
          >
            {submitting ? "Saving…" : "Save closing values"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
