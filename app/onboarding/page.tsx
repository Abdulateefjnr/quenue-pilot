import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/app/db";
import { member } from "@/app/db/schema";
import OnboardingForm from "@/app/components/auth/onboarding-form";
import { requireVerifiedUser } from "@/app/lib/server-auth";

export const instant = false;

export default async function OnboardingPage() {
  const session = await requireVerifiedUser();
  if (session.user.platformRole !== "admin") redirect("/pending-approval");
  const [existingMembership] = await db
    .select({ id: member.id })
    .from(member)
    .where(eq(member.userId, session.user.id))
    .limit(1);

  if (existingMembership) redirect("/dashboard");

  return <OnboardingForm />;
}
