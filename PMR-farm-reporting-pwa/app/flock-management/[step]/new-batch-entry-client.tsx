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
import { postFlockPlacement } from "@/lib/api";
import { useAppData } from "@/lib/app-data-context";
import { useAuth } from "@/lib/auth-context";
import { todayIsoLocal } from "@/lib/date-utils";
import type { ApiError } from "@/lib/types";
import { useState } from "react";

export function NewBatchEntryClient() {
  const { sheds, refreshData } = useAppData();
  const { user } = useAuth();
  const [shedId, setShedId] = useState<string>("");
  const [flockNumber, setFlockNumber] = useState("");
  const [birthDate, setBirthDate] = useState(() => todayIsoLocal());
  const [birdCount, setBirdCount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reportDate = todayIsoLocal();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    const sid = parseInt(shedId, 10);
    const n = parseInt(birdCount, 10);
    if (!shedId || Number.isNaN(sid) || Number.isNaN(n) || n <= 0) {
      setError("Select a shed and enter a valid bird count.");
      return;
    }
    if (!flockNumber.trim()) {
      setError("Enter a flock ID.");
      return;
    }
    setSubmitting(true);
    try {
      await postFlockPlacement({
        shedId: sid,
        flockNumber: flockNumber.trim(),
        birthDate,
        birdCount: n,
        reportDate,
        submitterId: parseInt(user.id, 10),
      });
      alert("New batch placed successfully.");
      await refreshData();
    } catch (err) {
      const msg =
        (err as ApiError)?.message ||
        String((err as { message?: string })?.message ?? "") ||
        "Request failed.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const activeSheds = sheds.filter((s) => s.active);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 px-4 py-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">New batch entry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="shed">Shed</Label>
            <Select value={shedId || undefined} onValueChange={setShedId}>
              <SelectTrigger id="shed" className="w-full max-w-none">
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
          <div className="space-y-2">
            <Label htmlFor="flock">Flock ID</Label>
            <Input
              id="flock"
              value={flockNumber}
              onChange={(e) => setFlockNumber(e.target.value)}
              placeholder="e.g. FK04262025"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="birds">Number of birds</Label>
            <Input
              id="birds"
              type="number"
              min={1}
              step={1}
              value={birdCount}
              onChange={(e) => setBirdCount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="birth">Birth date</Label>
            <Input
              id="birth"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Bird count is recorded on today&apos;s report ({reportDate}).
          </p>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Saving..." : "Place batch"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
