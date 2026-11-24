export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-canvas lg:flex" role="status" aria-label="Loading dashboard" aria-busy="true">
      <aside className="hidden w-64 shrink-0 bg-[#12382f] p-6 lg:block" aria-hidden="true">
        <div className="h-10 w-40 animate-pulse rounded-lg bg-white/10" />
        <div className="mt-12 space-y-3">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-11 animate-pulse rounded-xl bg-white/10" />
          ))}
        </div>
      </aside>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-7 sm:py-8">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-200" />
        <div className="mt-3 h-5 w-96 max-w-full animate-pulse rounded bg-slate-200" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ))}
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          <div className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </div>
      </main>
    </div>
  );
}
