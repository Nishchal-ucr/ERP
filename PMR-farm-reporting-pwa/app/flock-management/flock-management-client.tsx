"use client";

import { AppHeader } from "@/components/custom/app-header";
import { ReportItem } from "@/components/custom/report-item";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const FLOCK_OPTIONS = [
  {
    title: "View flock data",
    href: "/flock-management/view-flock-data",
  },
  {
    title: "New batch entry",
    href: "/flock-management/new-batch",
  },
  {
    title: "Shed transfer",
    href: "/flock-management/shed-transfer",
  },
  {
    title: "Cull bird sales",
    href: "/flock-management/cull-bird-sales",
  },
] as const;

export function FlockManagementClient() {
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
          title="Flock management"
          onBack={() => router.push("/")}
        />

        <div className="flex flex-col gap-4 px-4 py-4">
          {FLOCK_OPTIONS.map((opt) => (
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
