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
  createPartyForRole,
  getParties,
  patchParty,
  type PartiesListFilters,
} from "@/lib/api";
import { useAppData } from "@/lib/app-data-context";
import type { ApiError, Party } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

function typeLabel(t: Party["type"]): string {
  if (t === "CUSTOMER") return "Buyer";
  if (t === "SUPPLIER") return "Seller";
  return "Both";
}

export function ManagePartiesClient() {
  const { refreshData } = useAppData();
  const [filters, setFilters] = useState<PartiesListFilters>({
    activeFilter: "all",
    kindFilter: "all",
  });
  const [parties, setParties] = useState<Party[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [role, setRole] = useState<"buyer" | "seller" | "both">("buyer");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setListError(null);
    setLoading(true);
    try {
      const data = await getParties(filters);
      setParties(data);
    } catch (err) {
      const msg =
        (err as ApiError)?.message ??
        (err as { message?: string })?.message ??
        "Failed to load parties.";
      setListError(String(msg));
      setParties([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError("Name is required.");
      return;
    }
    setSubmitting(true);
    try {
      await createPartyForRole(trimmed, role, {
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      });
      setName("");
      setPhone("");
      setEmail("");
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

  const handleToggleActive = async (p: Party, nextActive: boolean) => {
    setTogglingId(p.id);
    try {
      await patchParty(p.id, { active: nextActive });
      await refreshData();
      await load();
    } catch (err) {
      const msg =
        (err as ApiError)?.message ??
        (err as { message?: string })?.message ??
        "Failed to update party.";
      alert(String(msg));
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-4 px-4 py-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="filter-active">Status</Label>
            <Select
              value={filters.activeFilter}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  activeFilter: v as PartiesListFilters["activeFilter"],
                }))
              }
            >
              <SelectTrigger id="filter-active" className="w-full max-w-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-kind">Buyer / seller / both</Label>
            <Select
              value={filters.kindFilter}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  kindFilter: v as PartiesListFilters["kindFilter"],
                }))
              }
            >
              <SelectTrigger id="filter-kind" className="w-full max-w-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="buyer">Buyer (incl. both)</SelectItem>
                <SelectItem value="seller">Seller (incl. both)</SelectItem>
                <SelectItem value="both">Both only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Parties</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : listError ? (
            <p className="text-sm text-destructive">{listError}</p>
          ) : !parties?.length ? (
            <p className="text-sm text-muted-foreground">No parties match.</p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto pr-1 text-sm">
              {parties.map((p) => {
                const isActive = p.active !== false;
                return (
                  <li
                    key={p.id}
                    className="flex gap-2 rounded-md border border-border px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium leading-tight">{p.name}</div>
                      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>{typeLabel(p.type)}</span>
                        <span>
                          {isActive ? (
                            <span>Active</span>
                          ) : (
                            <span className="text-amber-700 dark:text-amber-400">
                              Inactive
                            </span>
                          )}
                        </span>
                        {p.phone ? <span>Tel: {p.phone}</span> : null}
                        {p.email ? <span>{p.email}</span> : null}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 self-center"
                      disabled={togglingId === p.id}
                      onClick={() =>
                        handleToggleActive(p, !isActive)
                      }
                    >
                      {togglingId === p.id
                        ? "…"
                        : isActive
                          ? "Deactivate"
                          : "Activate"}
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
          <CardTitle className="text-base">Add party</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="party-name">Name</Label>
              <Input
                id="party-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Party name"
                autoComplete="organization"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="party-role">Label</Label>
              <Select
                value={role}
                onValueChange={(v) =>
                  setRole(v as "buyer" | "seller" | "both")
                }
              >
                <SelectTrigger id="party-role" className="w-full max-w-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buyer">Buyer</SelectItem>
                  <SelectItem value="seller">Seller</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="party-phone">Phone (optional)</Label>
              <Input
                id="party-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone"
                autoComplete="tel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="party-email">Email (optional)</Label>
              <Input
                id="party-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
              />
            </div>
            {formError ? (
              <p className="text-sm text-destructive">{formError}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Saving…" : "Add party"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
