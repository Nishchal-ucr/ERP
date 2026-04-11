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
  createFeedItem,
  deleteFeedItem,
  getAllFeedItems,
  getFeedFormulations,
  getFeedItemDailyStockLatest,
  type FeedItemCategory,
} from "@/lib/api";
import { useAppData } from "@/lib/app-data-context";
import type { ApiError, FeedItem } from "@/lib/types";
import { useCallback, useEffect, useMemo, useState } from "react";

function categoryLabel(c: string): string {
  if (c === "MEDICINE") return "Medicine";
  return "Ingredient";
}

function buildDeleteBlockReason(
  closingKg: number,
  hasNonZeroFormulation: boolean,
): string | null {
  if (closingKg > 0) {
    return "Cannot delete: latest closing stock is greater than zero.";
  }
  if (hasNonZeroFormulation) {
    return "Cannot delete: used in a feed formulation mix.";
  }
  return null;
}

export function ManageFeedItemsClient() {
  const { refreshData } = useAppData();
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [closingByItemId, setClosingByItemId] = useState<Map<number, number>>(
    () => new Map(),
  );
  const [nonZeroFormulationIds, setNonZeroFormulationIds] = useState<
    Set<number>
  >(() => new Set());

  const [name, setName] = useState("");
  const [category, setCategory] = useState<FeedItemCategory>("INGREDIENT");
  const [closingKgInput, setClosingKgInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setListError(null);
    setLoading(true);
    try {
      const [feedItems, latest, formulations] = await Promise.all([
        getAllFeedItems(),
        getFeedItemDailyStockLatest(),
        getFeedFormulations(),
      ]);
      setItems(feedItems);
      const closing = new Map<number, number>();
      for (const row of latest.items) {
        closing.set(row.feedItemId, row.closingKg);
      }
      setClosingByItemId(closing);
      const nz = new Set<number>();
      for (const f of formulations) {
        if ((f.ratioPer1000Kg ?? 0) > 0) {
          nz.add(f.feedItemId);
        }
      }
      setNonZeroFormulationIds(nz);
    } catch (err) {
      const msg =
        (err as ApiError)?.message ??
        (err as { message?: string })?.message ??
        "Failed to load feed items.";
      setListError(String(msg));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sortedItems = useMemo(() => {
    if (!items) return [];
    return [...items].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError("Name is required.");
      return;
    }
    let closing = 0;
    if (closingKgInput.trim() !== "") {
      const parsed = Number(closingKgInput);
      if (Number.isNaN(parsed) || parsed < 0) {
        setFormError("Closing (kg) must be a non-negative number.");
        return;
      }
      closing = parsed;
    }
    setSubmitting(true);
    try {
      await createFeedItem(trimmed, category, closing);
      setName("");
      setClosingKgInput("");
      await refreshData();
      await load();
    } catch (err) {
      const msg =
        (err as ApiError)?.message ??
        (err as { message?: string })?.message ??
        "Request failed.";
      setFormError(String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: FeedItem) => {
    const closing = closingByItemId.get(item.id) ?? 0;
    const block = buildDeleteBlockReason(
      closing,
      nonZeroFormulationIds.has(item.id),
    );
    if (block) {
      alert(block);
      return;
    }
    if (
      !window.confirm(`Delete "${item.name}"? This cannot be undone.`)
    ) {
      return;
    }
    setDeletingId(item.id);
    try {
      await deleteFeedItem(item.id);
      await refreshData();
      await load();
    } catch (err) {
      const msg =
        (err as ApiError)?.message ??
        (err as { message?: string })?.message ??
        "Failed to delete.";
      alert(String(msg));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4 px-4 py-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Feed items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : listError ? (
            <p className="text-sm text-destructive">{listError}</p>
          ) : !sortedItems.length ? (
            <p className="text-sm text-muted-foreground">No feed items yet.</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto pr-1 text-sm">
              {sortedItems.map((item) => {
                const closing = closingByItemId.get(item.id) ?? 0;
                const blockReason = buildDeleteBlockReason(
                  closing,
                  nonZeroFormulationIds.has(item.id),
                );
                const canDelete = blockReason === null;
                return (
                  <li
                    key={item.id}
                    className="flex gap-2 rounded-md border border-border px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium leading-tight">{item.name}</div>
                      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>{categoryLabel(item.category)}</span>
                        <span>Latest closing: {closing.toFixed(2)} kg</span>
                      </div>
                      {!canDelete ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {blockReason}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 self-center border-destructive/50 text-destructive hover:bg-destructive/10"
                      disabled={!canDelete || deletingId === item.id}
                      title={blockReason ?? "Delete feed item"}
                      onClick={() => handleDelete(item)}
                    >
                      {deletingId === item.id ? "…" : "Delete"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Add feed item</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="feed-item-name">Name</Label>
              <Input
                id="feed-item-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Item name"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feed-item-category">Category</Label>
              <Select
                value={category}
                onValueChange={(v) =>
                  setCategory(v as FeedItemCategory)
                }
              >
                <SelectTrigger
                  id="feed-item-category"
                  className="w-full max-w-none"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INGREDIENT">Ingredient</SelectItem>
                  <SelectItem value="MEDICINE">Medicine</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="feed-item-closing">
                Initial closing stock (kg, optional)
              </Label>
              <Input
                id="feed-item-closing"
                inputMode="decimal"
                value={closingKgInput}
                onChange={(e) => setClosingKgInput(e.target.value)}
                placeholder="0"
                autoComplete="off"
              />
            </div>
            {formError ? (
              <p className="text-sm text-destructive">{formError}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Saving…" : "Add feed item"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
