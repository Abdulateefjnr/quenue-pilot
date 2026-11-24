"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { formatFacilityTime } from "@/app/lib/facility-time";

type Department = { id: string; name: string; code: string };
type Ticket = {
  id: string;
  ticketNumber: number;
  ticketLabel: string;
  status: "waiting" | "called" | "in_service";
  queuedAt: string;
  patientName: string;
  medicalRecordNumber: string;
  departmentId: string;
  departmentName: string;
};
type QueueAction = "call" | "start" | "complete" | "transfer";
type Confirmation = {
  ticket: Ticket;
  action: "complete" | "transfer";
  departmentId?: string;
};

const pageSize = 25;

export default function QueueManagement({
  canUpdate,
  initialDepartments,
  initialTickets,
  initialTotal,
}: {
  canUpdate: boolean;
  initialDepartments: Department[];
  initialTickets: Ticket[];
  initialTotal: number;
}) {
  const [tickets, setTickets] = useState(initialTickets);
  const [departments, setDepartments] = useState(initialDepartments);
  const [transfers, setTransfers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [busyTicket, setBusyTicket] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(initialTotal);
  const [totalPages, setTotalPages] = useState(Math.ceil(initialTotal / pageSize));
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const cancelConfirmationRef = useRef<HTMLButtonElement>(null);
  const confirmActionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirmation) return;
    cancelConfirmationRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setConfirmation(null);
      } else if (event.key === "Tab") {
        const cancel = cancelConfirmationRef.current;
        const confirm = confirmActionRef.current;
        if (event.shiftKey && document.activeElement === cancel) {
          event.preventDefault();
          confirm?.focus();
        } else if (!event.shiftKey && document.activeElement === confirm) {
          event.preventDefault();
          cancel?.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [confirmation]);

  const loadQueue = useCallback(
    async (
      query = "",
      requestedPage = 1,
      status = "",
      departmentId = "",
    ) => {
      try {
        const params = new URLSearchParams({ page: String(requestedPage) });
        if (query) params.set("q", query);
        if (status) params.set("status", status);
        if (departmentId) params.set("department", departmentId);
        let response = await fetch(`/api/queue?${params}`);
        let data = (await response.json()) as {
          tickets?: Ticket[];
          departments?: Department[];
          pagination?: { page: number; total: number; totalPages: number };
          error?: string;
        };
        if (!response.ok) throw new Error(data.error ?? "Could not load the queue.");
        const safePage =
          data.pagination?.totalPages && requestedPage > data.pagination.totalPages
            ? data.pagination.totalPages
            : requestedPage;
        if (safePage !== requestedPage) {
          params.set("page", String(safePage));
          response = await fetch(`/api/queue?${params}`);
          data = (await response.json()) as typeof data;
          if (!response.ok) throw new Error(data.error ?? "Could not load the queue.");
        }
        setTickets(data.tickets ?? []);
        setDepartments(data.departments ?? []);
        setPage(data.pagination?.page ?? safePage);
        setTotal(data.pagination?.total ?? 0);
        setTotalPages(data.pagination?.totalPages ?? 0);
        setError("");
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load the queue.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  async function act(ticketId: string, action: QueueAction, departmentId?: string) {
    setBusyTicket(ticketId);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/queue/${ticketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(departmentId ? { departmentId } : {}) }),
      });
      const data = (await response.json()) as {
        error?: string;
        ticket?: { ticketLabel?: string; department?: string };
      };
      if (!response.ok) throw new Error(data.error ?? "The queue action failed.");
      setNotice(
        action === "transfer"
          ? `Patient transferred${data.ticket?.department ? ` to ${data.ticket.department}` : ""}.`
          : `Ticket ${action === "start" ? "started" : action === "complete" ? "completed" : "called"}.`,
      );
      setLoading(true);
      await loadQueue(appliedSearch, page, statusFilter, departmentFilter);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The queue action failed.");
    } finally {
      setBusyTicket("");
    }
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const query = search.trim();
    setAppliedSearch(query);
    void loadQueue(query, 1, statusFilter, departmentFilter);
  }

  function confirm(ticket: Ticket, action: Confirmation["action"], departmentId?: string) {
    setConfirmation({ ticket, action, departmentId });
  }

  async function runConfirmedAction() {
    if (!confirmation) return;
    const { ticket, action, departmentId } = confirmation;
    setConfirmation(null);
    await act(ticket.id, action, departmentId);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Active tickets</h2>
          <p className="mt-1 text-sm text-slate-500">
            {total} {total === 1 ? "patient" : "patients"} currently in the active queue.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            void loadQueue(appliedSearch, page, statusFilter, departmentFilter);
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <form onSubmit={applyFilters} className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(180px,1fr)_180px_200px_auto_auto]">
        <label className="sr-only" htmlFor="queue-search">Search patients or ticket records</label>
        <input
          id="queue-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          maxLength={100}
          placeholder="Search patient or MRN"
          className="min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
        />
        <label className="sr-only" htmlFor="queue-status-filter">Filter by queue status</label>
        <select
          id="queue-status-filter"
          value={statusFilter}
          onChange={(event) => {
            const value = event.target.value;
            setStatusFilter(value);
            const query = search.trim();
            setAppliedSearch(query);
            setLoading(true);
            void loadQueue(query, 1, value, departmentFilter);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="waiting">Waiting</option>
          <option value="called">Called</option>
          <option value="in_service">In service</option>
        </select>
        <label className="sr-only" htmlFor="queue-department-filter">Filter by department</label>
        <select
          id="queue-department-filter"
          value={departmentFilter}
          onChange={(event) => {
            const value = event.target.value;
            setDepartmentFilter(value);
            const query = search.trim();
            setAppliedSearch(query);
            setLoading(true);
            void loadQueue(query, 1, statusFilter, value);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All departments</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>{department.name}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
        >
          Search
        </button>
        {(search || statusFilter || departmentFilter) && (
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setSearch("");
              setAppliedSearch("");
              setStatusFilter("");
              setDepartmentFilter("");
              setLoading(true);
              void loadQueue("", 1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Clear
          </button>
        )}
      </form>

      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {notice && (
        <div role="status" aria-live="polite" className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss notification" onClick={() => setNotice("")} className="font-semibold">Dismiss</button>
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[780px] text-left text-sm" aria-busy={loading}>
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="py-3 pr-3 font-semibold">Ticket</th>
              <th scope="col" className="py-3 pr-3 font-semibold">Patient</th>
              <th scope="col" className="py-3 pr-3 font-semibold">Department</th>
              <th scope="col" className="py-3 pr-3 font-semibold">Status</th>
              <th scope="col" className="py-3 pr-3 font-semibold">Checked in</th>
              {canUpdate && <th scope="col" className="py-3 font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && Array.from({ length: 5 }, (_, index) => (
              <tr key={`skeleton-${index}`} aria-hidden="true">
                {Array.from({ length: canUpdate ? 6 : 5 }, (_, cell) => (
                  <td key={cell} className="py-4 pr-3">
                    <span className="block h-4 animate-pulse rounded bg-slate-100" />
                  </td>
                ))}
              </tr>
            ))}
            {!loading && tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td className="py-3 pr-3 font-bold text-emerald-900">{ticket.ticketLabel}</td>
                <td className="py-3 pr-3">
                  <p className="font-medium text-slate-900">{ticket.patientName}</p>
                  <p className="text-xs text-slate-500">{ticket.medicalRecordNumber}</p>
                </td>
                <td className="py-3 pr-3 text-slate-700">{ticket.departmentName}</td>
                <td className="py-3 pr-3">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700">
                    {ticket.status.replace("_", " ")}
                  </span>
                </td>
                <td className="py-3 pr-3 text-slate-600">
                  {formatFacilityTime(new Date(ticket.queuedAt))}
                </td>
                {canUpdate && (
                  <td className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {ticket.status === "waiting" && (
                        <button
                          type="button"
                          disabled={busyTicket === ticket.id}
                          onClick={() => void act(ticket.id, "call")}
                          className="rounded-md bg-emerald-800 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >Call</button>
                      )}
                      {ticket.status === "called" && (
                        <button
                          type="button"
                          disabled={busyTicket === ticket.id}
                          onClick={() => void act(ticket.id, "start")}
                          className="rounded-md bg-emerald-800 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >Start</button>
                      )}
                      {ticket.status === "in_service" && (
                        <button
                          type="button"
                          disabled={busyTicket === ticket.id}
                          onClick={() => confirm(ticket, "complete")}
                          className="rounded-md bg-emerald-800 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >Complete</button>
                      )}
                      <select
                        aria-label={`Transfer ${ticket.ticketLabel} to department`}
                        disabled={busyTicket === ticket.id}
                        value={transfers[ticket.id] ?? ""}
                        onChange={(event) => setTransfers((value) => ({ ...value, [ticket.id]: event.target.value }))}
                        className="max-w-36 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                      >
                        <option value="">Transfer to…</option>
                        {departments
                          .filter((department) => department.id !== ticket.departmentId)
                          .map((department) => (
                            <option key={department.id} value={department.id}>{department.name}</option>
                          ))}
                      </select>
                      <button
                        type="button"
                        disabled={busyTicket === ticket.id || !transfers[ticket.id]}
                        onClick={() => confirm(ticket, "transfer", transfers[ticket.id])}
                        className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                      >Transfer</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!loading && !tickets.length && !error && (
              <tr>
                <td colSpan={canUpdate ? 6 : 5} className="py-10 text-center">
                  <p className="font-semibold text-slate-800">
                    {appliedSearch || statusFilter || departmentFilter
                      ? "No tickets match these filters"
                      : "The queue is clear"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {appliedSearch || statusFilter || departmentFilter
                      ? "Adjust or clear the search and filters."
                      : "Active check-ins will appear here."}
                  </p>
                </td>
              </tr>
            )}
            {error && !tickets.length && !loading && (
              <tr><td colSpan={canUpdate ? 6 : 5} className="py-8 text-center text-sm text-red-700">{error}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav aria-label="Queue pages" className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-sm text-slate-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => {
                setLoading(true);
                void loadQueue(appliedSearch, page - 1, statusFilter, departmentFilter);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >Previous</button>
            <button
              type="button"
              disabled={loading || page >= totalPages}
              onClick={() => {
                setLoading(true);
                void loadQueue(appliedSearch, page + 1, statusFilter, departmentFilter);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >Next</button>
          </div>
        </nav>
      )}

      {confirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="queue-confirmation-title"
            aria-describedby="queue-confirmation-description"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2 id="queue-confirmation-title" className="text-lg font-bold text-slate-900">
              {confirmation.action === "complete" ? "Complete this visit?" : "Transfer this patient?"}
            </h2>
            <p id="queue-confirmation-description" className="mt-2 text-sm leading-6 text-slate-600">
              {confirmation.action === "complete"
                ? `This will complete ticket ${confirmation.ticket.ticketLabel} and remove it from the active queue.`
                : `This will transfer ticket ${confirmation.ticket.ticketLabel} to ${departments.find((department) => department.id === confirmation.departmentId)?.name ?? "the selected department"}.`}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                ref={cancelConfirmationRef}
                type="button"
                onClick={() => setConfirmation(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >Cancel</button>
              <button
                ref={confirmActionRef}
                type="button"
                onClick={() => void runConfirmedAction()}
                className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
              >Confirm</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
