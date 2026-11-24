import { CalendarCheck2, CheckCircle2, ClipboardList, UsersRound } from "lucide-react";
import Image from "next/image";

export default function LeftBanner() {
  return (
    <aside className="bg relative hidden min-h-screen w-1/2 flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:p-14">
      <div className="relative z-10 flex items-center">
        <div className="rounded-lg border border-white/30 bg-white px-3 py-2">
          <Image
            src="/images/queue-pilot.png"
          alt="QueuePilot"
            width={200}
            height={65}
          className="h-10 w-auto object-contain"
            priority
          />
        </div>
      </div>

      <div className="relative z-10 my-auto max-w-lg space-y-7 py-16">
        <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
          Healthcare operations
        </p>
        <h1 className="text-4xl font-semibold leading-[1.12] tracking-tight xl:text-[2.75rem]">
          Make every step of the visit feel more connected.
        </h1>
        <p className="max-w-md text-sm leading-6 text-emerald-50/85">
          A clear view of appointments, check-ins, and department queues helps
          care teams stay focused on the people they serve.
        </p>
        </div>

        <ul className="grid gap-3 border-t border-white/20 pt-5 text-sm text-white/90 sm:grid-cols-2">
        <li className="flex items-center gap-2.5">
          <CalendarCheck2 size={17} className="shrink-0 text-emerald-200" aria-hidden="true" />
          Appointment scheduling
        </li>
        <li className="flex items-center gap-2.5">
          <UsersRound size={17} className="shrink-0 text-emerald-200" aria-hidden="true" />
          Patient check-in
        </li>
        <li className="flex items-center gap-2.5">
          <ClipboardList size={17} className="shrink-0 text-emerald-200" aria-hidden="true" />
          Department queues
        </li>
        <li className="flex items-center gap-2.5">
          <CheckCircle2 size={17} className="shrink-0 text-emerald-200" aria-hidden="true" />
          Clear visit status
        </li>
        </ul>
      </div>

      <p className="relative z-10 text-xs text-white/65">
        Thoughtful tools for the everyday work of care.
      </p>
    </aside>
  );
}
