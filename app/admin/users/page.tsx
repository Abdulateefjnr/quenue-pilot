import Link from "next/link";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import UserRoleManagement from "@/app/components/admin/user-role-management";
import SignOutButton from "@/app/components/auth/sign-out-button";
import ThemeToggle from "@/app/components/dashboard/theme-toggle";
import { requirePlatformAdmin } from "@/app/lib/server-auth";

export const instant = false;

export default async function AdminUsersPage() {
  const session = await requirePlatformAdmin();

  return (
    <main className="platform-admin min-h-screen bg-canvas px-4 py-6 sm:px-7 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between gap-4 border-b border-line pb-5">
          <Link href="/dashboard" aria-label="QueuePilot dashboard">
            <Image
              src="/images/queue-pilot.png"
              alt="QueuePilot"
              width={180}
              height={54}
              priority
              className="h-10 w-auto object-contain"
            />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>
        <div className="mb-6 flex items-start gap-3">
          <span className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-900">
            <ShieldCheck size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
              Platform settings
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              Administrator access
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Manage QueuePilot platform administrators. Facility roles are assigned within a specific facility.
            </p>
          </div>
        </div>
        <UserRoleManagement currentUserId={session.user.id} />
      </div>
    </main>
  );
}
