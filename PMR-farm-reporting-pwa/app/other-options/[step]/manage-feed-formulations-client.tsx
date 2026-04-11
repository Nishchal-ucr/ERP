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
import {
  deleteFeedFormulation,
  getAllFeedItems,
  getAllSheds,
  getFeedFormulations,
  patchFeedFormulation,
} from "@/lib/api";
import { useAppData } from "@/lib/app-data-context";
import type { ApiError, FeedFormulationRow, FeedItem, Shed } from "@/lib/types";
import { useCallback, useEffect, useMemo, useState } from "react";

function ratioStringForRow(
  row: FeedFormulationRow,
  ratioDrafts: Record<number, string>,
): string {
  const d = ratioDrafts[row.id];
  if (d !== undefined) return d;
  return String(row.ratioPer1000Kg ?? 0);
}

function parseRatioNumber(
  row: FeedFormulationRow,
  ratioDrafts: Record<number, string>,
): number | null {
  const raw = ratioStringForRow(row, ratioDrafts).trim();
  if (raw === "") return null;
  const n = Number(raw);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

export function ManageFeedFormulationsClient() {
  const { refreshData } = useAppData();
  const [sheds, setSheds] = useState<Shed[] | null>(null);
  const [feedItems, setFeedItems] = useState<FeedItem[] | null>(null);
  const [formulations, setFormulations] = useState<FeedFormulationRow[] | null>(
    null,
  );
  const [listError, setListError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [shedId, setShedId] = useState<number | null>(null);
  const [ratioDrafts, setRatioDrafts] = useState<Record<number, string>>({});
  const [savingFormulation, setSavingFormulation] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setListError(null);
    setLoading(true);
    try {
      const [shedsData, itemsData, formData] = await Promise.all([
        getAllSheds(),
        getAllFeedItems(),
        getFeedFormulations(),
      ]);
      setSheds(shedsData);
      setFeedItems(itemsData);
      setFormulations(formData);
      setShedId((prev) => {
        if (prev != null && shedsData.some((s) => s.id === prev)) {
          return prev;
        }
        const first = shedsData[0]?.id;
        return first != null ? first : null;
      });
      setRatioDrafts({});
      setSaveError(null);
    } catch (err) {
      const msg =
        (err as ApiError)?.message ??
        (err as { message?: string })?.message ??
        "Failed to load data.";
      setListError(String(msg));
      setSheds([]);
      setFeedItems([]);
      setFormulations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshData();
      } catch {
        /* AppDataProvider logs */
      }
      if (!cancelled) {
        await load();
      }
    })();
    return () => {
      cancelled = true;
    };
    // refreshData from context is not referentially stable; run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync app data then load formulations
  }, []);

  const sortedSheds = useMemo(() => {
    if (!sheds) return [];
    return [...sheds].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [sheds]);

  const feedItemNameById = useMemo(() => {
    const m = new Map<number, string>();
    if (!feedItems) return m;
    for (const fi of feedItems) {
      m.set(fi.id, fi.name);
    }
    return m;
  }, [feedItems]);

  const displayFeedItemName = (row: FeedFormulationRow) =>
    feedItemNameById.get(row.feedItemId) ??
    row.feedItemName ??
    `Item #${row.feedItemId}`;

  const rowsForShed = useMemo(() => {
    if (!formulations || shedId == null) return [];
    return formulations
      .filter((f) => f.shedId === shedId)
      .sort((a, b) =>
        displayFeedItemName(a).localeCompare(displayFeedItemName(b), undefined, {
          sensitivity: "base",
        }),
      );
  }, [formulations, shedId, feedItemNameById]);

  const sortedRowsForShed = useMemo(() => {
    const rows = [...rowsForShed];
    const effRatio = (r: FeedFormulationRow) => {
      const n = parseRatioNumber(r, ratioDrafts);
      return n ?? 0;
    };
    rows.sort((a, b) => {
      const ra = effRatio(a);
      const rb = effRatio(b);
      const aZero = ra === 0;
      const bZero = rb === 0;
      if (aZero !== bZero) return aZero ? 1 : -1;
      return displayFeedItemName(a).localeCompare(displayFeedItemName(b), undefined, {
        sensitivity: "base",
      });
    });
    return rows;
  }, [rowsForShed, ratioDrafts, feedItemNameById]);

  const ratioSumDraft = useMemo(() => {
    return rowsForShed.reduce((acc, r) => {
      const n = parseRatioNumber(r, ratioDrafts);
      return acc + (n ?? 0);
    }, 0);
  }, [rowsForShed, ratioDrafts]);

  const formulationDirty = useMemo(() => {
    return rowsForShed.some((r) => {
      const parsed = parseRatioNumber(r, ratioDrafts);
      if (parsed === null) {
        const raw = ratioStringForRow(r, ratioDrafts).trim();
        if (raw === "") return false;
        return true;
      }
      const server = Number(r.ratioPer1000Kg ?? 0);
      return Math.abs(parsed - server) > 1e-9;
    });
  }, [rowsForShed, ratioDrafts]);

  const formulationInvalid = useMemo(() => {
    return rowsForShed.some((r) => {
      const raw = ratioStringForRow(r, ratioDrafts).trim();
      if (raw === "") return false;
      const n = Number(raw);
      return Number.isNaN(n) || n < 0;
    });
  }, [rowsForShed, ratioDrafts]);

  const ratioInputValue = (row: FeedFormulationRow) => {
    return ratioStringForRow(row, ratioDrafts);
  };

  const handleSaveFormulation = async () => {
    setSaveError(null);
    if (formulationInvalid) {
      setSaveError("Fix invalid ratios (non-negative numbers only).");
      return;
    }
    const patches: { id: number; ratio: number }[] = [];
    for (const row of rowsForShed) {
      const parsed = parseRatioNumber(row, ratioDrafts);
      if (parsed === null) continue;
      const server = Number(row.ratioPer1000Kg ?? 0);
      if (Math.abs(parsed - server) > 1e-9) {
        patches.push({ id: row.id, ratio: parsed });
      }
    }
    if (patches.length === 0) return;
    setSavingFormulation(true);
    try {
      await Promise.all(
        patches.map((p) =>
          patchFeedFormulation(p.id, { ratioPer1000Kg: p.ratio }),
        ),
      );
      setRatioDrafts({});
      await load();
      await refreshData();
    } catch (err) {
      const msg =
        (err as ApiError)?.message ??
        (err as { message?: string })?.message ??
        "Failed to save formulation.";
      setSaveError(String(msg));
    } finally {
      setSavingFormulation(false);
    }
  };

  const handleDelete = async (row: FeedFormulationRow) => {
    if (
      !window.confirm(
        `Remove "${displayFeedItemName(row)}" from this shed's formulation?`,
      )
    ) {
      return;
    }
    setDeletingId(row.id);
    try {
      await deleteFeedFormulation(row.id);
      setRatioDrafts((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      await load();
      await refreshData();
    } catch (err) {
      const msg =
        (err as ApiError)?.message ??
        (err as { message?: string })?.message ??
        "Failed to remove.";
      alert(String(msg));
    } finally {
      setDeletingId(null);
    }
  };

  const currentShedName =
    sortedSheds.find((s) => s.id === shedId)?.name ?? "Shed";

  const hasZeroRatioRow = useMemo(
    () => rowsForShed.some((r) => Number(r.ratioPer1000Kg ?? 0) === 0),
    [rowsForShed],
  );

  const totalVs1000Copy = useMemo(() => {
    const sum = ratioSumDraft;
    const gap = sum - 1000;
    const eps = 0.005;
    let deltaLine: string;
    if (Math.abs(gap) < eps) {
      deltaLine = "Within rounding of 1000 kg issued.";
    } else if (gap < 0) {
      deltaLine = `${Math.abs(gap).toFixed(2)} kg below 1000 kg issued.`;
    } else {
      deltaLine = `${gap.toFixed(2)} kg above 1000 kg issued.`;
    }
    return {
      totalLine: `${sum.toFixed(2)} kg per 1000 kg issued`,
      deltaLine,
    };
  }, [ratioSumDraft]);

  return (
    <div className="space-y-4 px-4 py-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Shed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : listError ? (
            <p className="text-sm text-destructive">{listError}</p>
          ) : sortedSheds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sheds configured.</p>
          ) : (
            <>
              <Label htmlFor="form-shed">Formulation for</Label>
              <Select
                value={shedId != null ? String(shedId) : ""}
                onValueChange={(v) => {
                  setShedId(Number(v));
                  setRatioDrafts({});
                  setSaveError(null);
                }}
              >
                <SelectTrigger id="form-shed" className="w-full max-w-none">
                  <SelectValue placeholder="Select shed" />
                </SelectTrigger>
                <SelectContent>
                  {sortedSheds.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Kg of each ingredient per 1000 kg of compound feed issued to{" "}
                {currentShedName}. Totals and comparison to 1000 kg are shown
                under Ingredients.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {shedId != null && !loading && !listError ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ingredients</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              New feed items from Manage feed items appear here automatically at{" "}
              <span className="font-medium">0</span> kg per 1000 kg issued—edit
              the values below, then use{" "}
              <span className="font-medium">Save formulation</span>.
            </p>
            {hasZeroRatioRow ? (
              <p className="text-xs text-muted-foreground">
                Rows at <span className="font-medium">0</span> kg are listed
                after non-zero ingredients. Scroll if you don&apos;t see a new
                item yet.
              </p>
            ) : null}
            {rowsForShed.length > 0 ? (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                <div className="font-medium text-foreground">
                  Total: {totalVs1000Copy.totalLine}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {totalVs1000Copy.deltaLine} Sum may be very close to 1000
                  without matching exactly.
                </p>
              </div>
            ) : null}
            {rowsForShed.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No formulation rows for this shed yet.
              </p>
            ) : (
              <>
                <ul className="max-h-64 space-y-3 overflow-y-auto pr-1 text-sm">
                  {sortedRowsForShed.map((row) => (
                    <li
                      key={row.id}
                      className="rounded-md border border-border px-3 py-2"
                    >
                      <div className="font-medium leading-tight">
                        {displayFeedItemName(row)}
                      </div>
                      <div className="mt-2 flex flex-wrap items-end gap-2">
                        <div className="min-w-0 flex-1 space-y-1">
                          <Label
                            htmlFor={`ratio-${row.id}`}
                            className="text-xs text-muted-foreground"
                          >
                            kg per 1000 kg issued
                          </Label>
                          <Input
                            id={`ratio-${row.id}`}
                            inputMode="decimal"
                            value={ratioInputValue(row)}
                            onChange={(e) =>
                              setRatioDrafts((prev) => ({
                                ...prev,
                                [row.id]: e.target.value,
                              }))
                            }
                            autoComplete="off"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-destructive/50 text-destructive hover:bg-destructive/10"
                          disabled={deletingId === row.id}
                          onClick={() => handleDelete(row)}
                        >
                          {deletingId === row.id ? "…" : "Remove"}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  className="w-full"
                  disabled={
                    savingFormulation ||
                    !formulationDirty ||
                    formulationInvalid
                  }
                  onClick={() => handleSaveFormulation()}
                >
                  {savingFormulation ? "Saving…" : "Save formulation"}
                </Button>
                {saveError ? (
                  <p className="text-sm text-destructive">{saveError}</p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
