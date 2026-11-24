"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  List,
  Plus,
  Search,
  X,
} from "lucide-react";
import { readJsonResponse } from "@/app/lib/client-json-response.mjs";
import {
  facilityDateKey,
  facilityDateStart,
  formatFacilityCalendarDay,
  formatFacilityTime,
  formatFacilityTimestamp,
  formatFacilityWeekday,
  formatFacilityWeekEnd,
  formatFacilityWeekStart,
} from "@/app/lib/facility-time";

type Department = { id: string; name: string };
type PatientOption = { id: string; fullName: string; medicalRecordNumber: string };
type StaffOption = { id: string; name: string; role: string };
type Appointment = {
  id: string;
  patientId: string;
  patientName: string;
  medicalRecordNumber: string;
  departmentId: string;
  departmentName: string;
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "confirmed" | "checked_in" | "completed" | "cancelled" | "no_show";
  reason: string | null;
};
type AppointmentAction = "confirm" | "check_in" | "complete" | "cancel" | "no_show";

function localDateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function startOfWeek(date: Date) {
  const start = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    12,
  ));
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return start;
}

function localInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function defaultAppointmentStart() {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15);
  date.setMinutes(date.getMinutes() + 30);
  return date;
}

function weekRange(date: Date) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function AppointmentManagement({
  initialDate,
  canManage,
  canUpdateAssigned,
  canCreate,
  departments,
}: {
  initialDate: string;
  canManage: boolean;
  canUpdateAssigned: boolean;
  canCreate: boolean;
  departments: Department[];
}) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    () => new Date(`${initialDate}T12:00:00.000Z`),
  );
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [confirming, setConfirming] = useState<{ appointment: Appointment; action: AppointmentAction } | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientOptions, setPatientOptions] = useState<PatientOption[]>([]);
  const [patientOptionsQuery, setPatientOptionsQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const [staffAvailability, setStaffAvailability] = useState<{
    key: string;
    staff: StaffOption[];
  } | null>(null);
  const [formStartsAt, setFormStartsAt] = useState("");
  const [formEndsAt, setFormEndsAt] = useState("");
  const [formDepartmentId, setFormDepartmentId] = useState("");
  const [formStaffId, setFormStaffId] = useState("");
  const [formReason, setFormReason] = useState("");

  const range = useMemo(() => weekRange(selectedDate), [selectedDate]);
  const availabilityKey = `${formStartsAt}|${formEndsAt}|${editing?.id ?? ""}`;
  const startsAtDate = new Date(formStartsAt);
  const endsAtDate = new Date(formEndsAt);
  const staffWindowIsValid =
    Number.isFinite(startsAtDate.getTime()) &&
    Number.isFinite(endsAtDate.getTime()) &&
    startsAtDate < endsAtDate &&
    endsAtDate.getTime() - startsAtDate.getTime() <= 8 * 60 * 60 * 1000;
  const staffOptions =
    formOpen && staffAvailability?.key === availabilityKey
      ? staffAvailability.staff
      : [];
  const staffLoading =
    canCreate &&
    formOpen &&
    staffWindowIsValid &&
    staffAvailability?.key !== availabilityKey;

  const loadAppointments = useCallback(async (
    query = "",
    status = "",
    requestedPage = 1,
    dateRange = range,
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from: facilityDateStart(dateRange.start).toISOString(),
        to: facilityDateStart(dateRange.end).toISOString(),
        page: String(requestedPage),
      });
      if (query) params.set("q", query);
      if (status) params.set("status", status);
      const response = await fetch(`/api/appointments?${params}`);
      const data = await readJsonResponse<{
        appointments?: Appointment[];
        pagination?: { page: number; total: number; totalPages: number };
        error?: string;
      }>(response, "Could not load appointments.");
      setAppointments(data.appointments ?? []);
      setPage(data.pagination?.page ?? requestedPage);
      setTotal(data.pagination?.total ?? 0);
      setTotalPages(data.pagination?.totalPages ?? 0);
      setError("");
    } catch (loadError) {
      setError(errorText(loadError, "Could not load appointments."));
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAppointments(appliedSearch, statusFilter, 1, range);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [appliedSearch, loadAppointments, range, statusFilter]);

  useEffect(() => {
    const query = patientSearch.trim();
    if (query.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/patients?q=${encodeURIComponent(query)}&page=1`, {
          signal: controller.signal,
        });
        const data = await readJsonResponse<{
          patients?: PatientOption[];
          error?: string;
        }>(response, "Could not search patients.");
        setPatientOptions(data.patients ?? []);
        setPatientOptionsQuery(query);
      } catch (searchError) {
        if (!controller.signal.aborted) {
          setError(errorText(searchError, "Could not search patients."));
        }
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [patientSearch]);

  useEffect(() => {
    if (!canCreate || !formOpen || !formStartsAt || !formEndsAt) return;
    const startsAt = new Date(formStartsAt);
    const endsAt = new Date(formEndsAt);
    if (
      !Number.isFinite(startsAt.getTime()) ||
      !Number.isFinite(endsAt.getTime()) ||
      startsAt >= endsAt
    ) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      start: startsAt.toISOString(),
      end: endsAt.toISOString(),
      ...(editing ? { exclude: editing.id } : {}),
    });
    void fetch(`/api/appointments/availability?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await readJsonResponse<{ staff?: StaffOption[]; error?: string }>(
          response,
          "Could not check staff availability.",
        );
        setStaffAvailability({
          key: `${formStartsAt}|${formEndsAt}|${editing?.id ?? ""}`,
          staff: data.staff ?? [],
        });
      })
      .catch((availabilityError: unknown) => {
        if (!controller.signal.aborted) {
          setError(errorText(availabilityError, "Could not check staff availability."));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setStaffAvailability((value) =>
            value?.key === `${formStartsAt}|${formEndsAt}|${editing?.id ?? ""}`
              ? value
              : { key: `${formStartsAt}|${formEndsAt}|${editing?.id ?? ""}`, staff: [] },
          );
        }
      });
    return () => controller.abort();
  }, [canCreate, editing, formEndsAt, formOpen, formStartsAt]);

  function openCreateForm() {
    const startsAt = defaultAppointmentStart();
    const endsAt = new Date(startsAt.getTime() + 30 * 60_000);
    setEditing(null);
    setFormOpen(true);
    setIdempotencyKey(crypto.randomUUID());
    setSelectedPatient(null);
    setPatientSearch("");
    setFormStartsAt(localInputValue(startsAt));
    setFormEndsAt(localInputValue(endsAt));
    setFormDepartmentId("");
    setFormStaffId("");
    setFormReason("");
    setError("");
    setNotice("");
  }

  function openEditForm(appointment: Appointment) {
    setEditing(appointment);
    setFormOpen(true);
    setSelectedPatient({
      id: appointment.patientId,
      fullName: appointment.patientName,
      medicalRecordNumber: appointment.medicalRecordNumber,
    });
    setPatientSearch(appointment.patientName);
    setFormStartsAt(localInputValue(new Date(appointment.startsAt)));
    setFormEndsAt(localInputValue(new Date(appointment.endsAt)));
    setFormDepartmentId(appointment.departmentId);
    setFormStaffId(appointment.assignedStaffId ?? "");
    setFormReason(appointment.reason ?? "");
    setError("");
    setNotice("");
  }

  async function submitAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPatient) {
      setError("Search and select a patient before scheduling.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const startsAt = new Date(String(formData.get("startsAt")));
    const endsAt = new Date(String(formData.get("endsAt")));
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime())) {
      setError("Enter valid appointment start and end times.");
      return;
    }
    const data = {
      patientId: selectedPatient.id,
      departmentId: formDepartmentId,
      assignedStaffId: formStaffId || null,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      reason: String(formData.get("reason") || ""),
    };
    if (
      data.assignedStaffId &&
      !staffOptions.some(({ id }) => id === data.assignedStaffId) &&
      data.assignedStaffId !== editing?.assignedStaffId
    ) {
      setError("The selected staff member is no longer available for that time.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        editing ? `/api/appointments/${editing.id}` : "/api/appointments",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editing
              ? { action: "reschedule", ...data }
              : { ...data, idempotencyKey },
          ),
        },
      );
      await readJsonResponse<{ error?: string }>(response, "Could not save appointment.");
      setNotice(editing ? "Appointment updated." : "Appointment scheduled.");
      setEditing(null);
      setFormOpen(false);
      setIdempotencyKey("");
      setSelectedPatient(null);
      setPatientSearch("");
      await loadAppointments(appliedSearch, statusFilter, 1);
    } catch (saveError) {
      setError(errorText(saveError, "Could not save appointment."));
    } finally {
      setSaving(false);
    }
  }

  async function runAppointmentAction() {
    if (!confirming) return;
    const { appointment, action } = confirming;
    setConfirming(null);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await readJsonResponse<{ error?: string }>(response, "Could not update appointment.");
      setNotice(`Appointment ${action === "check_in" ? "checked in" : action.replace("_", " ")}.`);
      await loadAppointments(appliedSearch, statusFilter, page);
    } catch (actionError) {
      setError(errorText(actionError, "Could not update appointment."));
    }
  }

  function searchAppointments(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedSearch(search.trim());
    setPage(1);
  }

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => {
      const date = new Date(range.start);
      date.setUTCDate(date.getUTCDate() + index);
      return date;
    }),
    [range.start],
  );
  const appointmentsByDay = useMemo(() => {
    const grouped = new Map<string, Appointment[]>();
    for (const appointment of appointments) {
      const key = facilityDateKey(new Date(appointment.startsAt));
      grouped.set(key, [...(grouped.get(key) ?? []), appointment]);
    }
    return grouped;
  }, [appointments]);

  return (
    <div className="space-y-5">
      {notice && (
        <div role="status" aria-live="polite" className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={16} /></button>
        </div>
      )}
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Appointment schedule</h2>
            <p className="mt-1 text-sm text-slate-500">{total} appointments in this week</p>
          </div>
          {canCreate && (
            <button type="button" onClick={openCreateForm} className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900">
              <Plus size={17} /> Schedule appointment
            </button>
          )}
        </div>

        {formOpen && (canCreate || editing) && (
          <form onSubmit={submitAppointment} className="mt-5 grid gap-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy={saving}>
            <div className="sm:col-span-2 lg:col-span-3">
              <h3 className="font-semibold text-slate-900">{editing ? "Edit appointment" : "New appointment"}</h3>
              <p className="mt-1 text-xs text-slate-600">Availability checks use staff member appointment conflicts. Working-hour schedules will be part of staff scheduling.</p>
            </div>
            <div className="relative">
              <label htmlFor="appointment-patient-search" className="block text-sm font-medium text-slate-700">Patient</label>
              {selectedPatient ? (
                <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{selectedPatient.fullName}</span>
                    <span className="ml-2 text-xs text-slate-500">{selectedPatient.medicalRecordNumber}</span>
                  </span>
                  <button type="button" onClick={() => { setSelectedPatient(null); setPatientSearch(""); }} aria-label="Change patient" className="shrink-0 rounded p-1 hover:bg-slate-100"><X size={15} /></button>
                </div>
              ) : (
                <>
                  <input
                    id="appointment-patient-search"
                    type="search"
                    value={patientSearch}
                    onChange={(event) => setPatientSearch(event.target.value)}
                    required
                    minLength={2}
                    placeholder="Search patient name or MRN"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                  />
                  {patientSearch.trim().length >= 2 && patientOptionsQuery === patientSearch.trim() && patientOptions.length > 0 && (
                    <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg" aria-label="Patient search results">
                      {patientOptions.map((patient) => (
                        <li key={patient.id}>
                          <button
                            type="button"
                            onClick={() => { setSelectedPatient(patient); setPatientOptions([]); }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-emerald-50"
                          >
                            <span className="block font-medium text-slate-900">{patient.fullName}</span>
                            <span className="text-xs text-slate-500">{patient.medicalRecordNumber}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {patientSearch.trim().length >= 2 && patientOptionsQuery === patientSearch.trim() && !patientOptions.length && (
                    <p className="mt-1 text-xs text-slate-500">Search results will appear here if a matching patient is found.</p>
                  )}
                </>
              )}
            </div>
            <label className="block text-sm font-medium text-slate-700">
              Department
              <select name="departmentId" required value={formDepartmentId} onChange={(event) => setFormDepartmentId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm">
                <option value="" disabled>Select department</option>
                {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Available doctor or nurse
              <select name="assignedStaffId" value={formStaffId} onChange={(event) => setFormStaffId(event.target.value)} disabled={staffLoading} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm">
                <option value="">No staff assigned</option>
                {staffOptions.map((staff) => <option key={staff.id} value={staff.id}>{staff.name} · {staff.role}</option>)}
                {editing?.assignedStaffId && editing.assignedStaffName && !staffOptions.some(({ id }) => id === editing.assignedStaffId) && (
                  <option value={editing.assignedStaffId}>{editing.assignedStaffName} · current assignment</option>
                )}
              </select>
              <span className="mt-1 block text-xs text-slate-500">{staffLoading ? "Checking availability…" : "Only facility doctors/nurses without an overlapping appointment are listed."}</span>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Starts
              <input
                name="startsAt"
                type="datetime-local"
                required
                value={formStartsAt}
                onChange={(event) => setFormStartsAt(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Ends
              <input
                name="endsAt"
                type="datetime-local"
                required
                value={formEndsAt}
                onChange={(event) => setFormEndsAt(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Reason <span className="font-normal text-slate-500">(optional)</span>
              <input name="reason" maxLength={500} value={formReason} onChange={(event) => setFormReason(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm" />
            </label>
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3">
              <button type="submit" disabled={saving || !departments.length} className="rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50">
                {saving ? "Saving…" : editing ? "Save changes" : "Create appointment"}
              </button>
              <button type="button" onClick={() => { setEditing(null); setFormOpen(false); setSelectedPatient(null); setIdempotencyKey(""); }} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
            </div>
            {!departments.length && <p className="text-sm text-amber-800">Create an active department before scheduling appointments.</p>}
          </form>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Previous week" onClick={() => setSelectedDate((date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - 7, 12)))} className="rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-50"><ArrowLeft size={17} /></button>
            <button type="button" onClick={() => setSelectedDate(new Date(`${facilityDateKey(new Date())}T12:00:00.000Z`))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Today</button>
            <button type="button" aria-label="Next week" onClick={() => setSelectedDate((date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 7, 12)))} className="rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-50"><ArrowRight size={17} /></button>
            <p className="ml-1 text-sm font-semibold text-slate-800">
              {formatFacilityWeekStart(range.start)} – {formatFacilityWeekEnd(new Date(range.end.getTime() - 24 * 60 * 60 * 1000))}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <form onSubmit={searchAppointments} className="flex gap-2">
              <label htmlFor="appointment-search" className="sr-only">Search appointments by patient</label>
              <input id="appointment-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={100} placeholder="Patient or MRN" className="w-36 rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-48" />
              <button type="submit" aria-label="Search appointments" className="rounded-lg border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-50"><Search size={16} /></button>
            </form>
            <label htmlFor="appointment-status" className="sr-only">Filter appointments by status</label>
            <select id="appointment-status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="max-w-36 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm">
              <option value="">All statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="confirmed">Confirmed</option>
              <option value="checked_in">Checked in</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No-show</option>
            </select>
            <button type="button" onClick={() => setView((current) => current === "calendar" ? "list" : "calendar")} aria-label={`Switch to ${view === "calendar" ? "list" : "calendar"} view`} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              {view === "calendar" ? <List size={16} /> : <CalendarDays size={16} />}
              <span className="hidden sm:inline">{view === "calendar" ? "List" : "Calendar"}</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Loading appointments">
            {Array.from({ length: 8 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}
          </div>
        ) : view === "calendar" ? (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {days.map((day) => {
              const dateKey = localDateKey(day);
              const dayAppointments = appointmentsByDay.get(dateKey) ?? [];
              return (
                <section key={dateKey} aria-label={formatFacilityCalendarDay(day)} className="min-h-36 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
                    {formatFacilityWeekday(day)}
                    <span className="ml-2 text-slate-900">{day.getUTCDate()}</span>
                  </h3>
                  <div className="mt-2 space-y-2">
                    {dayAppointments.map((appointment) => (
                      <AppointmentCard
                        key={appointment.id}
                        appointment={appointment}
                        canManage={canManage}
                        canUpdateAssigned={canUpdateAssigned}
                        onEdit={() => openEditForm(appointment)}
                        onAction={(action) => setConfirming({ appointment, action })}
                      />
                    ))}
                    {!dayAppointments.length && <p className="py-3 text-center text-xs text-slate-400">No appointments</p>}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {appointments.map((appointment) => (
              <div key={appointment.id} className="p-3 sm:p-4">
                <AppointmentCard
                  appointment={appointment}
                  canManage={canManage}
                  canUpdateAssigned={canUpdateAssigned}
                  onEdit={() => openEditForm(appointment)}
                  onAction={(action) => setConfirming({ appointment, action })}
                  horizontal
                />
              </div>
            ))}
            {!appointments.length && !error && (
              <div className="px-4 py-12 text-center">
                <CalendarDays className="mx-auto text-slate-300" size={30} />
                <p className="mt-3 font-semibold text-slate-800">{appliedSearch || statusFilter ? "No matching appointments" : "No appointments this week"}</p>
                <p className="mt-1 text-sm text-slate-500">{appliedSearch || statusFilter ? "Change your search or filters." : "Schedule an appointment to add it to the calendar."}</p>
              </div>
            )}
          </div>
        )}
        {view === "calendar" && !loading && !appointments.length && !error && (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
            {appliedSearch || statusFilter ? "No appointments match the current search and filter." : "No appointments scheduled this week."}
          </div>
        )}
        {error && !appointments.length && !loading && <p className="mt-5 rounded-xl bg-red-50 px-4 py-8 text-center text-sm text-red-700">Appointments could not be loaded. Use refresh to try again.</p>}

        {totalPages > 1 && (
          <nav aria-label="Appointment pages" className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button type="button" disabled={loading || page <= 1} onClick={() => void loadAppointments(appliedSearch, statusFilter, page - 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Previous</button>
              <button type="button" disabled={loading || page >= totalPages} onClick={() => void loadAppointments(appliedSearch, statusFilter, page + 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Next</button>
            </div>
          </nav>
        )}
      </section>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="appointment-confirm-title" aria-describedby="appointment-confirm-description" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="appointment-confirm-title" className="text-lg font-bold text-slate-900">
              {confirming.action === "cancel" ? "Cancel appointment?" : confirming.action === "no_show" ? "Record a no-show?" : `Mark appointment ${confirming.action.replace("_", " ")}?`}
            </h2>
            <p id="appointment-confirm-description" className="mt-2 text-sm leading-6 text-slate-600">
              {confirming.appointment.patientName} · {formatFacilityTimestamp(new Date(confirming.appointment.startsAt))}.
              {confirming.action === "cancel" ? " This appointment will be recorded as cancelled." : ""}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirming(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Keep appointment</button>
              <button type="button" onClick={() => void runAppointmentAction()} className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AppointmentCard({
  appointment,
  canManage,
  canUpdateAssigned,
  onEdit,
  onAction,
  horizontal = false,
}: {
  appointment: Appointment;
  canManage: boolean;
  canUpdateAssigned: boolean;
  onEdit: () => void;
  onAction: (action: AppointmentAction) => void;
  horizontal?: boolean;
}) {
  const canEdit = canManage && ["scheduled", "confirmed"].includes(appointment.status);
  const canCancel = canManage && ["scheduled", "confirmed"].includes(appointment.status);
  const canShowNoShow =
    canManage &&
    ["scheduled", "confirmed"].includes(appointment.status) &&
    new Date(appointment.startsAt) < new Date();
  const actions: { label: string; action: AppointmentAction | "edit" }[] = [];
  if ((canManage || canUpdateAssigned) && appointment.status === "scheduled") actions.push({ label: "Confirm", action: "confirm" });
  if ((canManage || canUpdateAssigned) && ["scheduled", "confirmed"].includes(appointment.status)) actions.push({ label: "Check in", action: "check_in" });
  if ((canManage || canUpdateAssigned) && appointment.status === "checked_in") actions.push({ label: "Complete", action: "complete" });
  if ((canManage || canUpdateAssigned) && appointment.status === "confirmed" && !canManage) actions.push({ label: "Confirm", action: "confirm" });
  if (canCancel) actions.push({ label: "Cancel", action: "cancel" });
  if (canShowNoShow) actions.push({ label: "No-show", action: "no_show" });
  if (canEdit) actions.push({ label: "Edit", action: "edit" });

  return (
    <article className={`rounded-lg border border-slate-200 bg-white p-3 ${horizontal ? "sm:flex sm:items-center sm:justify-between sm:gap-4" : ""}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <time className="text-xs font-bold text-emerald-900">
            {formatFacilityTime(new Date(appointment.startsAt))}
            {" – "}
            {formatFacilityTime(new Date(appointment.endsAt))}
          </time>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${appointment.status === "cancelled" || appointment.status === "no_show" ? "bg-red-50 text-red-800" : appointment.status === "completed" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
            {appointment.status.replace("_", " ")}
          </span>
        </div>
        <p className="mt-1 truncate text-sm font-semibold text-slate-900">{appointment.patientName}</p>
        <p className="truncate text-xs text-slate-500">{appointment.departmentName} · {appointment.assignedStaffName ?? "Staff unassigned"}</p>
        {horizontal && <p className="mt-1 text-xs text-slate-500">{appointment.medicalRecordNumber}{appointment.reason ? ` · ${appointment.reason}` : ""}</p>}
      </div>
      {!!actions.length && (
        <div className={`mt-2 flex flex-wrap gap-1 ${horizontal ? "sm:mt-0 sm:justify-end" : ""}`}>
          {actions.map(({ label, action }) => (
            <button
              key={label}
              type="button"
              onClick={action === "edit" ? onEdit : () => onAction(action)}
              className={`rounded-md px-2 py-1 text-xs font-semibold ${label === "Cancel" || label === "No-show" ? "text-red-700 hover:bg-red-50" : "text-emerald-800 hover:bg-emerald-50"}`}
            >{label}</button>
          ))}
        </div>
      )}
    </article>
  );
}
