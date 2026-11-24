"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Building2,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Settings2,
  Users,
  X,
} from "lucide-react";
import Button from "@/app/components/ui/button";
import SignOutButton from "@/app/components/auth/sign-out-button";
import OrganizationSwitcher from "@/app/components/dashboard/organization-switcher";
import ThemeToggle from "@/app/components/dashboard/theme-toggle";
import { hasPermission } from "@/app/lib/permissions";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, permission: "organization:read" },
  { href: "/dashboard/queue", label: "Queue", icon: ClipboardList, permission: "queue:read" },
  { href: "/dashboard/patients", label: "Patients", icon: Users, permission: "patients:read-basic" },
  { href: "/dashboard/appointments", label: "Appointments", icon: CalendarCheck, permission: "appointments:read" },
];

export default function DashboardShell({
  organizationName,
  userName,
  role,
  platformRole,
  activeHref,
  title,
  description,
  children,
  actions,
  notificationCount = 0,
}: {
  organizationName: string;
  userName: string;
  role: string;
  platformRole: "user" | "admin";
  activeHref: string;
  title: string;
  description: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  notificationCount?: number;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [facilityLogoUrl, setFacilityLogoUrl] = useState("");
  const sidebarRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const links = [
    ...navigation.filter(({ permission }) => hasPermission(role, permission)),
    ...(platformRole === "admin"
      ? [{ href: "/admin/users", label: "Platform administration", icon: ShieldCheck }]
      : []),
    ...(
      hasPermission(role, "appointments:read-assigned") &&
      !hasPermission(role, "appointments:read")
        ? [{ href: "/dashboard/appointments", label: "My appointments", icon: CalendarCheck }]
        : []
    ),
    ...(hasPermission(role, "organization:update")
      ? [
          { href: "/dashboard/departments", label: "Departments", icon: Building2 },
          { href: "/dashboard/profile", label: "Facility profile", icon: Settings2 },
        ]
      : []),
  ];
  const initials = userName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  useEffect(() => {
    let active = true;
    let latestRequest = 0;
    async function loadFacilityLogo() {
      const requestId = ++latestRequest;
      try {
        const response = await fetch("/api/profile/organization/logo", { cache: "no-store" });
        if (response.status === 404) {
          if (active && requestId === latestRequest) setFacilityLogoUrl("");
          return;
        }
        if (!response.ok) {
          throw new Error(`Unable to load facility logo (HTTP ${response.status}).`);
        }
        if (!response.headers.get("content-type")?.includes("application/json")) {
          throw new Error("The server returned an invalid facility logo response.");
        }
        const result = (await response.json()) as { url?: string; error?: string };
        if (!result.url) throw new Error("The server did not return a facility logo URL.");
        if (active && requestId === latestRequest) setFacilityLogoUrl(result.url);
      } catch (error) {
        if (active && requestId === latestRequest) {
          console.error("Unable to load facility logo for the dashboard header.", error);
        }
      }
    }

    function handleFacilityLogoUpdated(event: Event) {
      latestRequest += 1;
      if (event instanceof CustomEvent && typeof event.detail === "string") {
        setFacilityLogoUrl(event.detail);
      } else {
        void loadFacilityLogo();
      }
    }

    void loadFacilityLogo();
    const refreshInterval = window.setInterval(() => void loadFacilityLogo(), 4 * 60 * 1000);
    window.addEventListener("facility-logo-updated", handleFacilityLogoUpdated);
    return () => {
      active = false;
      window.clearInterval(refreshInterval);
      window.removeEventListener("facility-logo-updated", handleFacilityLogoUpdated);
    };
  }, []);

  useEffect(() => {
    const menuButton = menuButtonRef.current;
    if (!mobileSidebarOpen) return;
    closeButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileSidebarOpen(false);
      } else if (event.key === "Tab") {
        const focusable = sidebarRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      menuButton?.focus();
    };
  }, [mobileSidebarOpen]);

  function closeMobileSidebar() {
    setMobileSidebarOpen(false);
  }

  return (
    <div className="dashboard-app min-h-screen bg-canvas text-ink transition-colors lg:flex">
      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={closeMobileSidebar}
          className="fixed inset-0 z-30 bg-slate-950/55 lg:hidden"
        />
      )}

      <aside
        ref={sidebarRef}
        id="dashboard-sidebar"
        aria-label="Dashboard sidebar"
        role={mobileSidebarOpen ? "dialog" : undefined}
        aria-modal={mobileSidebarOpen ? true : undefined}
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-72 flex-col overflow-x-hidden border-r border-[#244a3e] bg-[#12382f] px-4 py-5 text-white shadow-xl transition-[width,transform] duration-200 motion-reduce:transition-none lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none ${
          mobileSidebarOpen ? "visible translate-x-0" : "invisible -translate-x-full lg:visible lg:translate-x-0"
        } ${sidebarCollapsed ? "lg:w-20" : "lg:w-64"}`}
      >
        <div className={`flex min-h-12 items-center ${sidebarCollapsed ? "justify-center" : "justify-between gap-2"}`}>
          <Link
            href="/dashboard"
            onClick={closeMobileSidebar}
            className="flex min-w-0 items-center"
            aria-label="QueuePilot overview"
            title={sidebarCollapsed ? "QueuePilot overview" : undefined}
          >
            {sidebarCollapsed ? (
              <Image
                src="/Healthcare%20Queue%20Icon.png"
                alt=""
                width={44}
                height={44}
                priority
                className="size-11 rounded-xl object-cover"
              />
            ) : (
              <Image
                src="/images/queue-pilot.png"
                alt="QueuePilot — Smarter Queue. Better Care."
                width={224}
                height={66}
                priority
                className="dashboard-brand-logo h-auto w-full max-w-56 rounded-lg border border-white/15 bg-white p-1 object-contain"
              />
            )}
          </Link>
          <Button
            ref={closeButtonRef}
            variant="ghost"
            size="icon"
            className="hidden text-white/70 hover:bg-white/10 hover:text-white lg:inline-flex"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-controls="dashboard-sidebar"
            aria-expanded={!sidebarCollapsed}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close navigation menu"
            onClick={closeMobileSidebar}
          >
            <X size={19} />
          </Button>
        </div>

        <div className={`mt-8 min-w-0 px-3 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
            Workspace
          </p>
          <p className="mt-1 truncate text-sm font-medium text-white">{organizationName}</p>
          <OrganizationSwitcher />
        </div>
        <nav aria-label="Main navigation" className="mt-5 flex flex-col gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = activeHref === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={closeMobileSidebar}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                title={sidebarCollapsed ? label : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  sidebarCollapsed ? "lg:justify-center lg:px-0" : ""
                } ${
                  active
                    ? "bg-white/12 text-white"
                    : "text-white/70 hover:bg-white/8 hover:text-white"
                }`}
              >
                <Icon size={18} aria-hidden="true" />
                <span className={sidebarCollapsed ? "lg:hidden" : "flex-1"}>{label}</span>
                {active && <ChevronRight className={sidebarCollapsed ? "lg:hidden" : ""} size={16} aria-hidden="true" />}
              </Link>
            );
          })}
          <Link
            href="/dashboard#notifications"
            onClick={closeMobileSidebar}
            aria-label="Notifications"
            title={sidebarCollapsed ? "Notifications" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/8 hover:text-white ${
              sidebarCollapsed ? "lg:justify-center lg:px-0" : ""
            }`}
          >
            <Bell size={18} aria-hidden="true" />
            <span className={sidebarCollapsed ? "lg:hidden" : "flex-1"}>Notifications</span>
            {notificationCount > 0 && (
              <span className={`rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold text-white ${sidebarCollapsed ? "lg:hidden" : ""}`}>
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </Link>
        </nav>
        <div className={`mt-auto rounded-lg border border-white/10 bg-white/5 p-4 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            <CalendarDays size={16} className="text-emerald-200" />
            Built for better flow
          </p>
          <p className="mt-2 text-xs leading-5 text-white/65">
            Keep check-in, queues, and department operations in one place.
          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1" aria-hidden={mobileSidebarOpen ? true : undefined}>
        <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur-sm">
          <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-7">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <Button
                ref={menuButtonRef}
                variant="outline"
                size="icon"
                className="lg:hidden"
                aria-label="Open navigation menu"
                aria-controls="dashboard-sidebar"
                aria-expanded={mobileSidebarOpen}
                onClick={() => setMobileSidebarOpen(true)}
              >
                <Menu size={19} />
              </Button>
              <div className="min-w-0">
                {activeHref !== "/dashboard" && (
                  <nav aria-label="Breadcrumb" className="mb-0.5 flex items-center gap-1 text-xs text-slate-500">
                    <Link href="/dashboard" className="hover:text-emerald-800">Overview</Link>
                    <ChevronRight size={13} aria-hidden="true" />
                    <span aria-current="page" className="truncate text-slate-700">{title}</span>
                  </nav>
                )}
                <p className="truncate text-xs font-semibold text-slate-900 sm:text-base">
                  {organizationName}
                </p>
                <p className="hidden text-xs text-slate-500 sm:block">Healthcare operations workspace</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
              <ThemeToggle />
              <div className="hidden text-right sm:block">
                <p className="max-w-40 truncate text-sm font-semibold text-slate-800">{userName}</p>
                <p className="text-xs capitalize text-slate-500">{role}</p>
              </div>
              <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-emerald-200 bg-emerald-100 text-xs font-bold text-emerald-900">
                {facilityLogoUrl ? (
                  <Image
                    src={facilityLogoUrl}
                    alt=""
                    width={36}
                    height={36}
                    unoptimized
                    className="size-full bg-white object-contain p-0.5"
                  />
                ) : (
                  <span aria-hidden="true">{initials}</span>
                )}
              </span>
              <SignOutButton />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-7 sm:py-8">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-[1.75rem]">{title}</h1>
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
