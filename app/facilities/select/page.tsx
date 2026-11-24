import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import FacilitySelectionForm from "@/app/components/auth/facility-selection-form";
import { db } from "@/app/db";
import { member, organization, organizationProfiles } from "@/app/db/schema";
import { resolveActiveOrganization } from "@/app/lib/organization-selection.js";
import { requireVerifiedUser } from "@/app/lib/server-auth";

export const instant = false;

export default async function SelectFacilityPage() {
  const session = await requireVerifiedUser();
  const memberships = await db
    .select({
      organizationId: organization.id,
      name: organization.name,
      role: member.role,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .innerJoin(
      organizationProfiles,
      eq(organizationProfiles.organizationId, organization.id),
    )
    .where(eq(member.userId, session.user.id))
    .orderBy(asc(organization.name));
  const selection = resolveActiveOrganization(
    session.session.activeOrganizationId,
    memberships,
  );

  if (memberships.length === 0) {
    redirect(session.user.platformRole === "admin" ? "/onboarding" : "/pending-approval");
  }
  if (selection.status === "selected") redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4 sm:p-6">
      <section className="auth-card w-full max-w-lg space-y-5 p-6 sm:p-8">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-emerald-700">QueuePilot</p>
          <h1 className="text-2xl font-bold text-slate-900">Choose a facility</h1>
          <p className="text-sm leading-6 text-slate-600">
            Select which facility workspace you want to open. Your access is limited to the facility you choose.
          </p>
        </div>
        <FacilitySelectionForm facilities={memberships} />
      </section>
    </main>
  );
}
