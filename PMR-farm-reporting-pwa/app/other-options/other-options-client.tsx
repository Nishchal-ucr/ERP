"use client";

import { AppHeader } from "@/components/custom/app-header";
import { ReportItem } from "@/components/custom/report-item";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

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

export function OtherOptionsClient() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

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

  return (
    <div className="flex min-h-screen justify-center">
      <div className="w-full max-w-sm">
        <AppHeader
          title="Other options"
          onBack={() => router.push("/")}
        />

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
      </div>
    </div>
  );
}
