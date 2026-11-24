"use client";

import { FormEvent, useCallback, useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { LoaderCircle, Trash2 } from "lucide-react";

type Department = { id: string; name: string; code: string };
type Patient = {
  id: string;
  medicalRecordNumber: string;
  fullName: string;
  phone: string | null;
  dateOfBirth: string | null;
  createdAt: string;
};

export default function PatientRegistration({
  departments,
  initialPatients,
  initialTotal,
  canDeletePatients,
}: {
  departments: Department[];
  initialPatients: Patient[];
  initialTotal: number;
  canDeletePatients: boolean;
}) {
  const [patients, setPatients] = useState(initialPatients);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(Math.ceil(initialTotal / 25));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [ticketLabel, setTicketLabel] = useState("");
  const [deletingPatientId, setDeletingPatientId] = useState<string | null>(null);
  const [deleteNotice, setDeleteNotice] = useState("");
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);

  const loadPatients = useCallback(async (query = "", requestedPage = 1) => {
    try {
      const params = new URLSearchParams({ page: String(requestedPage) });
      if (query) params.set("q", query);
      const response = await fetch(`/api/patients?${params}`);
      const data = (await response.json()) as {
        patients?: Patient[];
        pagination?: { page: number; total: number; totalPages: number };
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Could not load patients.");
      setPatients(data.patients ?? []);
      setPage(data.pagination?.page ?? requestedPage);
      setTotal(data.pagination?.total ?? 0);
      setTotalPages(data.pagination?.totalPages ?? 0);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load patients.");
    } finally {
      setLoading(false);
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSaving(true);
    setError("");
    setMessage("");
    setTicketLabel("");
    const formData = new FormData(form);
    try {
      const response = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.get("fullName"),
          phone: formData.get("phone"),
          dateOfBirth: formData.get("dateOfBirth"),
          departmentId: formData.get("departmentId"),
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        patient?: Patient;
        queue?: { ticketLabel: string; department: string };
      };
      if (!response.ok) throw new Error(data.error ?? "Could not check in patient.");
      setMessage(`${data.patient?.fullName} checked in to ${data.queue?.department}.`);
      setTicketLabel(data.queue?.ticketLabel ?? "");
      setSearch("");
      setAppliedSearch("");
      form.reset();
      setLoading(true);
      await loadPatients();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not check in patient.");
    } finally {
      setSaving(false);
    }
  }

  function searchPatients(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    setAppliedSearch(query);
    setLoading(true);
    void loadPatients(query, 1);
  }

  function changePage(nextPage: number) {
    setLoading(true);
    void loadPatients(appliedSearch, nextPage);
  }

  async function deletePatient(patient: Patient) {
    setDeletingPatientId(patient.id);
    setDeleteNotice("");
    setError("");
    try {
      const response = await fetch(`/api/patients/${encodeURIComponent(patient.id)}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not remove patient record.");

      setDeleteNotice(`${patient.fullName} was removed from active patient records.`);
      setPatientToDelete(null);
      setLoading(true);
      await loadPatients(appliedSearch, patients.length === 1 && page > 1 ? page - 1 : page);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not remove patient record.");
    } finally {
      setDeletingPatientId(null);
    }
  }

  return (
    <AlertDialog.Root
      open={patientToDelete !== null}
      onOpenChange={(open) => {
        if (!open && deletingPatientId === null) setPatientToDelete(null);
      }}
    >
    <div className="grid gap-6 lg:grid-cols-[minmax(300px,0.8fr)_1.2fr]">
      <section className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">New check-in</h2>
        <form className="mt-4 space-y-4" onSubmit={submit} aria-busy={saving}>
          <label className="block text-sm font-medium text-slate-700" htmlFor="patient-full-name">
            Patient full name
            <input
              id="patient-full-name"
              name="fullName"
              required
              minLength={2}
              maxLength={120}
              autoComplete="name"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700" htmlFor="patient-phone">
            Phone number <span className="font-normal text-slate-500">(optional)</span>
            <input
              name="phone"
              id="patient-phone"
              type="tel"
              maxLength={30}
              autoComplete="tel"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700" htmlFor="patient-date-of-birth">
            Date of birth <span className="font-normal text-slate-500">(optional)</span>
            <input
              name="dateOfBirth"
              id="patient-date-of-birth"
              type="date"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700" htmlFor="patient-department">
            Department
            <select
              name="departmentId"
              id="patient-department"
              required
              disabled={!departments.length}
              defaultValue=""
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="" disabled>Select a department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
          {message && (
            <p role="status" aria-live="polite" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              {message}{ticketLabel ? <strong className="ml-2">{ticketLabel}</strong> : null}
            </p>
          )}
          {!departments.length && (
            <p className="text-sm text-amber-800">There are no active departments for check-in.</p>
          )}
          <button
            type="submit"
            disabled={saving || !departments.length}
            className="w-full rounded-lg bg-emerald-800 px-4 py-2.5 font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Checking in…" : "Register and issue ticket"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Patients</h2>
            <p className="mt-1 text-sm text-slate-500">Most recently registered in this facility.</p>
          </div>
          <form onSubmit={searchPatients} className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              id="patient-search"
              aria-label="Search patients"
              placeholder="Name, MRN, or phone"
              className="min-w-0 flex-[1_1_100%] rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-700 sm:w-56 sm:flex-none"
            />
            <button type="submit" disabled={loading} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:flex-none">
              Search
            </button>
            {search && (
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setSearch("");
                  setAppliedSearch("");
                  setLoading(true);
                  void loadPatients("", 1);
                }}
                className="min-w-0 flex-1 rounded-lg px-2 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 sm:flex-none"
              >
                Clear
              </button>
            )}
          </form>
        </div>
        <p className="mt-3 text-xs text-slate-500">{total} patient records</p>
        <div className="mt-4 space-y-3 md:hidden" aria-busy={loading}>
          {loading && Array.from({ length: 3 }, (_, index) => (
            <div key={`mobile-skeleton-${index}`} aria-hidden="true" className="space-y-3 rounded-lg border border-slate-200 p-4">
              <span className="block h-4 w-2/3 animate-pulse rounded bg-slate-100" />
              <span className="block h-3 w-full animate-pulse rounded bg-slate-100" />
              <span className="block h-3 w-1/2 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
          {!loading && patients.map((patient) => (
            <article key={patient.id} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words font-semibold text-slate-900">{patient.fullName}</h3>
                  <p className="mt-1 break-all text-xs text-slate-500">{patient.medicalRecordNumber}</p>
                </div>
                {canDeletePatients && (
                  <button
                    type="button"
                    disabled={deletingPatientId !== null}
                    onClick={() => setPatientToDelete(patient)}
                    aria-label={`Delete ${patient.fullName}`}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-50"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm">
                <div className="min-w-0">
                  <dt className="text-xs text-slate-500">Phone</dt>
                  <dd className="mt-1 break-words text-slate-700">{patient.phone || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Date of birth</dt>
                  <dd className="mt-1 text-slate-700">{patient.dateOfBirth || "—"}</dd>
                </div>
              </dl>
            </article>
          ))}
          {!loading && !patients.length && !error && (
            <p className="rounded-lg border border-slate-200 px-4 py-8 text-center text-sm text-slate-600">
              {appliedSearch ? "No matching patients. Try another name, record number, or phone." : "No patients registered yet."}
            </p>
          )}
          {error && !patients.length && !loading && <p role="alert" className="py-6 text-center text-sm text-red-700">{error}</p>}
        </div>
        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className={`w-full ${canDeletePatients ? "min-w-[700px]" : "min-w-[560px]"} text-left text-sm`}>
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-3 pr-3 font-semibold">Patient</th>
                <th className="py-3 pr-3 font-semibold">Medical record no.</th>
                <th className="py-3 pr-3 font-semibold">Phone</th>
                <th className="py-3 font-semibold">Date of birth</th>
                {canDeletePatients && <th className="py-3 text-right font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && Array.from({ length: 5 }, (_, index) => (
                <tr key={`skeleton-${index}`} aria-hidden="true">
                  {Array.from({ length: canDeletePatients ? 5 : 4 }, (_, cell) => (
                    <td key={cell} className="py-4 pr-3">
                      <span className="block h-4 animate-pulse rounded bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))}
              {!loading && patients.map((patient) => (
                <tr key={patient.id}>
                  <td className="py-3 pr-3 font-medium text-slate-900">{patient.fullName}</td>
                  <td className="py-3 pr-3 text-slate-600">{patient.medicalRecordNumber}</td>
                  <td className="py-3 pr-3 text-slate-600">{patient.phone || "—"}</td>
                  <td className="py-3 text-slate-600">{patient.dateOfBirth || "—"}</td>
                  {canDeletePatients && (
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        disabled={deletingPatientId !== null}
                        onClick={() => setPatientToDelete(patient)}
                        aria-label={`Delete ${patient.fullName}`}
                        title="Remove from active patient records"
                        className="inline-flex size-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {!loading && !patients.length && !error && (
                <tr>
                  <td colSpan={canDeletePatients ? 5 : 4} className="px-4 py-10 text-center">
                    <p className="font-semibold text-slate-800">{appliedSearch ? "No matching patients" : "No patients registered yet"}</p>
                    <p className="mt-1 text-sm text-slate-500">{appliedSearch ? "Try another name, record number, or phone." : "Use the check-in form to register the first patient."}</p>
                  </td>
                </tr>
              )}
              {error && !patients.length && !loading && (
                <tr><td colSpan={canDeletePatients ? 5 : 4} className="py-8 text-center text-sm text-red-700">{error}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {deleteNotice && <p role="status" className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{deleteNotice}</p>}
        {totalPages > 1 && (
          <nav aria-label="Patient list pages" className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={loading || page <= 1}
                onClick={() => changePage(page - 1)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >Previous</button>
              <button
                type="button"
                disabled={loading || page >= totalPages}
                onClick={() => changePage(page + 1)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >Next</button>
            </div>
          </nav>
        )}
      </section>
    </div>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[2px]" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-6 shadow-2xl focus:outline-none">
          <div className="flex size-11 items-center justify-center rounded-full bg-red-50 text-red-700">
            <Trash2 size={19} aria-hidden="true" />
          </div>
          <AlertDialog.Title className="mt-4 text-lg font-semibold tracking-tight text-slate-950">
            Remove patient record?
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm leading-6 text-slate-600">
            {patientToDelete
              ? `${patientToDelete.fullName} will be removed from active patient records. Visit and queue history will be retained.`
              : "This patient will be removed from active records."}
          </AlertDialog.Description>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <button
                type="button"
                disabled={deletingPatientId !== null}
                className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-50"
              >
                Cancel
              </button>
            </AlertDialog.Cancel>
            <button
              type="button"
              disabled={!patientToDelete || deletingPatientId !== null}
              onClick={() => patientToDelete && void deletePatient(patientToDelete)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-red-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deletingPatientId ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : null}
              {deletingPatientId ? "Removing…" : "Remove patient"}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
