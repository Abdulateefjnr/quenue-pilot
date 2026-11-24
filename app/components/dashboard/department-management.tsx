"use client";

import { FormEvent, useCallback, useState } from "react";

type Department = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
};

const pageSize = 10;

export default function DepartmentManagement({
  initialDepartments,
}: {
  initialDepartments: Department[];
}) {
  const [departments, setDepartments] = useState(initialDepartments);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const loadDepartments = useCallback(async () => {
    try {
      const response = await fetch("/api/departments");
      const data = (await response.json()) as {
        departments?: Department[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Could not load departments.");
      setDepartments(data.departments ?? []);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load departments.");
    } finally {
      setLoading(false);
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          code: formData.get("code"),
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not add department.");
      setNotice("Department added.");
      form.reset();
      setLoading(true);
      await loadDepartments();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not add department.");
    } finally {
      setSaving(false);
    }
  }

  const filteredDepartments = departments.filter((department) => {
    const matchesSearch = `${department.name} ${department.code}`.toLowerCase().includes(search.trim().toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && department.isActive) ||
      (statusFilter === "inactive" && !department.isActive);
    return matchesSearch && matchesStatus;
  });
  const totalPages = Math.ceil(filteredDepartments.length / pageSize);
  const currentPage = Math.min(page, Math.max(totalPages, 1));
  const visibleDepartments = filteredDepartments.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(260px,0.8fr)_1.2fr]">
      <section className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Add department</h2>
        <form onSubmit={submit} className="mt-4 space-y-4" aria-busy={saving}>
          <label className="block text-sm font-medium text-slate-700" htmlFor="department-name">
            Name
            <input
              id="department-name"
              name="name"
              required
              minLength={2}
              maxLength={80}
              placeholder="e.g. Cardiology"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700" htmlFor="department-code">
            Ticket code
            <input
              id="department-code"
              name="code"
              required
              minLength={2}
              maxLength={6}
              pattern="[A-Za-z0-9]{2,6}"
              placeholder="e.g. CARD"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 uppercase outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            />
            <span className="mt-1 block text-xs text-slate-500">2–6 letters or numbers; used on queue tickets.</span>
          </label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button
            disabled={saving}
            className="w-full rounded-lg bg-emerald-800 px-4 py-2.5 font-semibold text-white hover:bg-emerald-900 disabled:opacity-60"
          >
            {saving ? "Adding…" : "Add department"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Facility departments</h2>
            <p className="mt-1 text-sm text-slate-500">{departments.length} total</p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              void loadDepartments();
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >Refresh</button>
        </div>

        {notice && (
          <div role="status" aria-live="polite" className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <span>{notice}</span>
            <button type="button" aria-label="Dismiss notification" onClick={() => setNotice("")} className="font-semibold">Dismiss</button>
          </div>
        )}
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_180px]">
          <label className="sr-only" htmlFor="department-search">Search departments</label>
          <input
            id="department-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search name or ticket code"
            className="min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
          />
          <label className="sr-only" htmlFor="department-status-filter">Filter by department status</label>
          <select
            id="department-status-filter"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All departments</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <ul className="mt-3 divide-y divide-slate-100" aria-busy={loading}>
          {loading && Array.from({ length: 5 }, (_, index) => (
            <li key={`skeleton-${index}`} aria-hidden="true" className="flex items-center justify-between gap-3 py-4">
              <span className="h-4 w-40 animate-pulse rounded bg-slate-100" />
              <span className="h-6 w-16 animate-pulse rounded bg-slate-100" />
            </li>
          ))}
          {!loading && visibleDepartments.map((department) => (
            <li key={department.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium text-slate-900">{department.name}</p>
                <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${department.isActive ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                  {department.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold tracking-wide text-emerald-900">
                {department.code}
              </span>
            </li>
          ))}
          {!loading && !visibleDepartments.length && !error && (
            <li className="py-8 text-center">
              <p className="font-semibold text-slate-800">{departments.length ? "No matching departments" : "No departments yet"}</p>
              <p className="mt-1 text-sm text-slate-500">
                {departments.length ? "Try a different search or status filter." : "Add a department to start routing queue tickets."}
              </p>
            </li>
          )}
          {error && !departments.length && !loading && (
            <li className="py-8 text-center text-sm text-red-700">Departments could not be loaded.</li>
          )}
        </ul>

        {totalPages > 1 && (
          <nav aria-label="Department list pages" className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-500">Page {currentPage} of {totalPages}</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={loading || currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >Previous</button>
              <button
                type="button"
                disabled={loading || currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >Next</button>
            </div>
          </nav>
        )}
      </section>
    </div>
  );
}
