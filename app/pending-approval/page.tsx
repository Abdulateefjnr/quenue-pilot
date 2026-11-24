import { redirect } from "next/navigation";
import SignOutButton from "@/app/components/auth/sign-out-button";
import { requireVerifiedUser } from "@/app/lib/server-auth";

export const instant = false;

export default async function PendingApprovalPage() {
  const session = await requireVerifiedUser();
  if (session.user.platformRole === "admin") redirect("/onboarding");

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4 sm:p-6">
      <section className="auth-card w-full max-w-lg space-y-4 p-6 sm:p-8">
        <p className="text-sm font-semibold text-emerald-700">QueuePilot</p>
        <h1 className="text-2xl font-bold text-slate-900">Account awaiting access</h1>
        <p className="text-sm leading-6 text-slate-600">
          Your account is registered. An administrator must grant you access before you can set up or enter a facility workspace.
        </p>
        <p className="text-sm text-slate-700">{session.user.email}</p>
        <SignOutButton />
      </section>
    </main>
  );
}
