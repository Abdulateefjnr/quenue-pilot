import { Building2, ShieldCheck } from "lucide-react";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import DashboardShell from "@/app/components/dashboard/dashboard-shell";
import OrganizationProfileForm from "@/app/components/dashboard/organization-profile-form";
import OrganizationLogoForm from "@/app/components/dashboard/organization-logo-form";
import { db } from "@/app/db";
import { organizationProfiles } from "@/app/db/schema";
import { hasPermission } from "@/app/lib/permissions";
import { requireOrganization } from "@/app/lib/server-auth";

export const instant = false;

export default async function FacilityProfilePage() {
  const session = await requireOrganization();
  if (!hasPermission(session.membership.role, "organization:update")) {
    redirect("/dashboard");
  }

  const [profile] = await db
    .select({
      organizationType: organizationProfiles.organizationType,
      phone: organizationProfiles.contactPhone,
    })
    .from(organizationProfiles)
    .where(eq(organizationProfiles.organizationId, session.membership.organizationId))
    .limit(1);

  if (!profile) {
    throw new Error("Facility profile is missing for this organization.");
  }
  if (profile.organizationType !== "hospital" && profile.organizationType !== "clinic") {
    throw new Error("Facility profile has an unsupported type.");
  }

  return (
    <DashboardShell
      organizationName={session.membership.organizationName}
      userName={session.user.name}
      role={session.membership.role}
      platformRole={session.user.platformRole}
      activeHref="/dashboard/profile"
      title="Facility profile"
      description="Manage the contact and identity details shown across your QueuePilot workspace."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <div className="space-y-6">
          <OrganizationProfileForm
            initialProfile={{
              organizationName: session.membership.organizationName,
              organizationType: profile.organizationType,
              phone: profile.phone ?? "",
            }}
          />
          <OrganizationLogoForm />
        </div>
        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex size-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
            <Building2 size={21} aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-slate-950">Facility workspace</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Your facility details help staff identify the correct hospital or clinic workspace.
          </p>
          <div className="mt-5 flex items-start gap-3 rounded-lg bg-slate-50 p-3">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />
            <p className="text-xs leading-5 text-slate-600">
              Only facility owners and admins can view or change these details.
            </p>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}
