"use client";

import { AppHeader } from "@/components/custom/app-header";
import { ReportItem } from "@/components/custom/report-item";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

const OTHER_OPTIONS = [
  {
    title: "View flock data",
    href: "/other-options/view-flock-data",
  },
  {
    title: "New batch entry",
    href: "/other-options/new-batch",
  },
  {
    title: "Shed transfer",
    href: "/other-options/shed-transfer",
  },
  {
    title: "Cull bird sales",
    href: "/other-options/cull-bird-sales",
  },
  {
    title: "Manage parties",
    href: "/other-options/manage-parties",
  },
  {
    title: "Overwrite feed closing",
    href: "/other-options/overwrite-feed-closing",
  },
  {
    title: "Overwrite shed closing",
    href: "/other-options/overwrite-shed-closing",
  },
  {
    title: "Manage feed items",
    href: "/other-options/manage-feed-items",
  },
  {
    title: "Manage feed formulations",
    href: "/other-options/manage-feed-formulations",
  },
] as const;
const HARDCODED_PASSCODE = "040501";

export function OtherOptionsClient() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [passcode, setPasscode] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleUnlock = (e: FormEvent) => {
    e.preventDefault();
    if (passcode === HARDCODED_PASSCODE) {
      setIsUnlocked(true);
      setPasscode("");
      setError(null);
      return;
    }
    setError("Incorrect passcode.");
  };

  return (
    <div className="flex min-h-screen justify-center">
      <div className="w-full max-w-sm">
        <AppHeader
          title="Other options"
          onBack={() => router.push("/")}
        />

        {!isUnlocked ? (
          <form onSubmit={handleUnlock} className="px-4 py-6">
            <div className="rounded-xl border p-4 shadow-sm">
              <h2 className="text-base font-semibold">Enter passcode</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter passcode to open other options.
              </p>
              <Input
                className="mt-4"
                type="password"
                inputMode="numeric"
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  if (error) {
                    setError(null);
                  }
                }}
                placeholder="Passcode"
                autoFocus
              />
              {error ? (
                <p className="mt-2 text-sm text-red-600">{error}</p>
              ) : null}
              <Button className="mt-4 w-full" type="submit">
                Unlock
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-4 px-4 py-4">
            {OTHER_OPTIONS.map((opt) => (
              <ReportItem
                key={opt.href}
                title={opt.title}
                href={opt.href}
                completed={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
