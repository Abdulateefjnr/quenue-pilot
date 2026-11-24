"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard route failed", { digest: error.digest });
  }, [error.digest]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-canvas px-4 py-12">
      <section className="auth-card w-full max-w-md p-7 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-800">
          <AlertTriangle size={23} />
        </span>
        <h1 className="mt-4 text-xl font-bold text-slate-950">We couldn&apos;t load this page</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Your data is unchanged. Check your connection and try again. If the problem continues, contact your administrator.
        </p>
        {error.digest && <p className="mt-3 text-xs text-slate-400">Reference: {error.digest}</p>}
        <button
          type="button"
          onClick={retry}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900"
        >
          <RefreshCw size={16} /> Try again
        </button>
      </section>
    </main>
  );
}
