import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Stethoscope,
  Timer,
  UserPlus,
  Users,
} from "lucide-react";
import { and, count, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/app/db";
import { departments, notifications, patients, queueTickets, visits } from "@/app/db/schema";
import DashboardShell from "@/app/components/dashboard/dashboard-shell";
import LiveNotifications, {
  type DashboardNotification,
} from "@/app/components/dashboard/live-notifications";
import VisitTrendChart from "@/app/components/dashboard/visit-trend-chart";
import { hasPermission } from "@/app/lib/permissions";
import { requireOrganization } from "@/app/lib/server-auth";

export const instant = false;

const TIMEZONE = "Africa/Lagos";

function getLocalDayRange(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const day = `${values.year}-${values.month}-${values.day}`;
  return {
    label: day,
    start: new Date(`${day}T00:00:00+01:00`),
    end: new Date(new Date(`${day}T00:00:00+01:00`).getTime() + 24 * 60 * 60 * 1000),
  };
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  tone: string;
}) {
  return (
    <article className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <span className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon size={22} />
      </span>
      <div>
        <p className="text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        <p className="mt-0.5 text-sm text-slate-600">{label}</p>
      </div>
    </article>
  );
}

export default async function DashboardPage() {
  const session = await requireOrganization();
  if (
    !hasPermission(session.membership.role, "queue:read") &&
    !hasPermission(session.membership.role, "patients:read-basic")
  ) {
    redirect("/");
  }
  const organizationId = session.membership.organizationId;
  const { label: day, start, end } = getLocalDayRange(new Date());
  const weekStart = new Date(start.getTime() - 6 * 24 * 60 * 60 * 1000);
  const visitLocalDate = sql<string>`to_char(${visits.createdAt} at time zone 'Africa/Lagos', 'YYYY-MM-DD')`;

  const [
    visitCount,
    waitingCount,
    serviceCount,
    completedCount,
    patientCount,
    notificationRows,
    departmentPerformance,
    visitTrendRows,
  ] =
    await Promise.all([
      db
        .select({ value: count() })
        .from(visits)
        .where(
          and(
            eq(visits.organizationId, organizationId),
            gte(visits.createdAt, start),
            lt(visits.createdAt, end),
          ),
        ),
      db
        .select({ value: count() })
        .from(queueTickets)
        .where(
          and(
            eq(queueTickets.organizationId, organizationId),
            eq(queueTickets.status, "waiting"),
            gte(queueTickets.queuedAt, start),
            lt(queueTickets.queuedAt, end),
          ),
        ),
      db
        .select({ value: count() })
        .from(queueTickets)
        .where(
          and(
            eq(queueTickets.organizationId, organizationId),
            eq(queueTickets.status, "in_service"),
            gte(queueTickets.queuedAt, start),
            lt(queueTickets.queuedAt, end),
          ),
        ),
      db
        .select({ value: count() })
        .from(visits)
        .where(
          and(
            eq(visits.organizationId, organizationId),
            eq(visits.status, "completed"),
            gte(visits.completedAt, start),
            lt(visits.completedAt, end),
          ),
        ),
      db
        .select({ value: count() })
        .from(patients)
        .where(
          and(
            eq(patients.organizationId, organizationId),
            isNull(patients.archivedAt),
          ),
        ),
      db
        .select({
          id: notifications.id,
          title: notifications.title,
          body: notifications.body,
          createdAt: notifications.createdAt,
        })
        .from(notifications)
        .where(eq(notifications.userId, session.user.id))
        .orderBy(desc(notifications.createdAt))
        .limit(10),
      db
        .select({
          departmentId: departments.id,
          departmentName: departments.name,
          ticketsWaiting: sql<number>`count(*) filter (where ${queueTickets.status} = 'waiting')::int`,
          ticketsInService: sql<number>`count(*) filter (where ${queueTickets.status} = 'in_service')::int`,
          ticketsCompleted: sql<number>`count(*) filter (where ${queueTickets.status} = 'completed')::int`,
          averageWaitMinutes: sql<number | null>`round(avg(extract(epoch from (${queueTickets.startedAt} - ${queueTickets.queuedAt})) / 60) filter (where ${queueTickets.startedAt} is not null))::int`,
          currentWaitMinutes: sql<number | null>`round(avg(extract(epoch from (now() - ${queueTickets.queuedAt})) / 60) filter (where ${queueTickets.status} in ('waiting', 'called')))::int`,
        })
        .from(queueTickets)
        .innerJoin(
          departments,
          and(
            eq(queueTickets.departmentId, departments.id),
            eq(queueTickets.organizationId, departments.organizationId),
          ),
        )
        .where(
          and(
            eq(queueTickets.organizationId, organizationId),
            gte(queueTickets.queuedAt, start),
            lt(queueTickets.queuedAt, end),
          ),
        )
        .groupBy(departments.id, departments.name)
        .orderBy(desc(sql`count(*) filter (where ${queueTickets.status} in ('waiting', 'called', 'in_service'))`)),
      db
        .select({
          date: visitLocalDate,
          visits: count(),
        })
        .from(visits)
        .where(
          and(
            eq(visits.organizationId, organizationId),
            gte(visits.createdAt, weekStart),
            lt(visits.createdAt, end),
          ),
        )
        .groupBy(visitLocalDate)
        .orderBy(visitLocalDate),
    ]);

  const initialNotifications: DashboardNotification[] = notificationRows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
  const notificationCount = initialNotifications.length;
  const visitCountsByDate = new Map(visitTrendRows.map((row) => [row.date, row.visits]));
  const visitTrend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart.getTime() + index * 24 * 60 * 60 * 1000);
    const dateParts = new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const dateValues = Object.fromEntries(dateParts.map(({ type, value }) => [type, value]));
    const dateKey = `${dateValues.year}-${dateValues.month}-${dateValues.day}`;
    return {
      date: dateKey,
      label: new Intl.DateTimeFormat("en", {
        weekday: "short",
        timeZone: TIMEZONE,
      }).format(date),
      visits: visitCountsByDate.get(dateKey) ?? 0,
    };
  });
  const busiestWaitingDepartment = departmentPerformance
    .filter((department) => department.ticketsWaiting > 0 && department.currentWaitMinutes !== null)
    .reduce<(typeof departmentPerformance)[number] | null>(
      (busiest, department) =>
        !busiest || (department.currentWaitMinutes ?? 0) > (busiest.currentWaitMinutes ?? 0)
          ? department
          : busiest,
      null,
    );
  const cards = [
    { label: "Visits checked in today", value: visitCount[0]?.value ?? 0, icon: UserPlus, tone: "bg-blue-50 text-blue-700" },
    { label: "Waiting in queue", value: waitingCount[0]?.value ?? 0, icon: Clock3, tone: "bg-amber-50 text-amber-700" },
    { label: "Currently in service", value: serviceCount[0]?.value ?? 0, icon: Stethoscope, tone: "bg-violet-50 text-violet-700" },
    { label: "Visits completed today", value: completedCount[0]?.value ?? 0, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700" },
  ];

  return (
    <DashboardShell
      organizationName={session.membership.organizationName}
      userName={session.user.name}
      role={session.membership.role}
      platformRole={session.user.platformRole}
      activeHref="/dashboard"
      title="Facility overview"
      description={`Welcome, ${session.user.name}. Today's operational activity for ${day}.`}
      notificationCount={notificationCount}
      actions={
        <>
          <Link href="/dashboard/patients" className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900">
            <UserPlus size={17} /> Patient check-in
          </Link>
          <Link href="/dashboard/queue" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Manage queue <ArrowRight size={16} />
          </Link>
        </>
      }
    >
        <section aria-label="Today's statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => <SummaryCard key={card.label} {...card} />)}
        </section>

        <section aria-labelledby="visit-trend-heading" className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="visit-trend-heading" className="text-base font-semibold text-slate-950">
                Patient visits
              </h2>
              <p className="mt-1 text-sm text-slate-500">Daily registrations over the last 7 days</p>
            </div>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
              Last 7 days
            </span>
          </div>
          <div className="mt-4">
            <VisitTrendChart data={visitTrend} />
          </div>
        </section>

        <section aria-labelledby="department-performance-heading" className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="department-performance-heading" className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <BarChart3 size={20} className="text-emerald-800" />
                Department queue performance
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Live queue load and actual wait durations from tickets created today.
              </p>
            </div>
            {busiestWaitingDepartment && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Longest current wait: <strong>{busiestWaitingDepartment.departmentName}</strong>
                {busiestWaitingDepartment.currentWaitMinutes !== null
                  ? ` · ${busiestWaitingDepartment.currentWaitMinutes} min average`
                  : ""}
              </p>
            )}
          </div>
          {departmentPerformance.length ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {departmentPerformance.map((department) => (
                <article key={department.departmentId} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <h3 className="font-semibold text-slate-900">{department.departmentName}</h3>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-white p-2">
                      <p className="text-lg font-bold text-amber-800">{department.ticketsWaiting}</p>
                      <p className="text-xs text-slate-500">Waiting</p>
                    </div>
                    <div className="rounded-lg bg-white p-2">
                      <p className="text-lg font-bold text-violet-800">{department.ticketsInService}</p>
                      <p className="text-xs text-slate-500">In service</p>
                    </div>
                    <div className="rounded-lg bg-white p-2">
                      <p className="text-lg font-bold text-emerald-800">{department.ticketsCompleted}</p>
                      <p className="text-xs text-slate-500">Completed</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <Timer size={14} aria-hidden="true" />
                      Current wait avg: {department.currentWaitMinutes === null ? "—" : `${department.currentWaitMinutes} min`}
                    </span>
                    <span>
                      Time to service avg: {department.averageWaitMinutes === null ? "—" : `${department.averageWaitMinutes} min`}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
              No queue activity recorded today. Department performance will appear after the first check-in.
            </p>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr] mt-10 mb-10">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Patient operations</h2>
                <p className="mt-1 text-sm text-slate-500">Patient and visit totals for this facility.</p>
              </div>
              <Users className="text-emerald-800" />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-600">Active patient records</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{patientCount[0]?.value ?? 0}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-600">Visits created today</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{visitCount[0]?.value ?? 0}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/dashboard/patients" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:underline">
                View patients <ArrowRight size={15} />
              </Link>
              <Link href="/dashboard/queue" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:underline">
                View active tickets <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <CalendarDays size={20} className="text-emerald-800" />
              Daily workflow
            </h2>
            <ol className="mt-4 space-y-4 text-sm">
              <li className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-900">1</span>
                <span className="text-slate-600">Register or locate the patient and choose a department.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-900">2</span>
                <span className="text-slate-600">QueuePilot creates a visit and issues the next department ticket.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-900">3</span>
                <span className="text-slate-600">Call, start, complete, or transfer the patient from Queue Management.</span>
              </li>
            </ol>
          </div>
        </section>

        <div id="notifications">
          <LiveNotifications initialNotifications={initialNotifications} />
        </div>
    </DashboardShell>
  );
}
