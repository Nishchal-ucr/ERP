"use client";

import { AppHeader } from "@/components/custom/app-header";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center">
      <div className="w-full max-w-sm">
        <AppHeader title="You are offline" onBack={() => router.back()} />

        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-md m-4">
          <div className="mb-4 text-3xl">🚫</div>
          <h1 className="text-xl font-semibold text-slate-900">
            No internet connection
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            You’re currently offline. Once your internet connection is restored,
            this page will automatically refresh. No action needed.
          </p>
          <div className="mt-6 inline-flex items-center rounded-full bg-slate-100 px-4 py-2 text-xs font-medium text-slate-700">
            <span className="h-2 w-2 mr-2 rounded-full bg-emerald-500 animate-pulse" />
            Waiting for connection...
          </div>
        </div>
      </div>
    </div>
  );
}
