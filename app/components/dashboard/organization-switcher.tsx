"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { readJsonResponse } from "@/app/lib/client-json-response.mjs";

type OrganizationOption = {
  organizationId: string;
  name: string;
  role: string;
};

export default function OrganizationSwitcher() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [activeOrganizationId, setActiveOrganizationId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/profile/organizations", { cache: "no-store" })
      .then(async (response) => {
        const result = await readJsonResponse<{
          organizations?: OrganizationOption[];
          activeOrganizationId?: string | null;
          error?: string;
        }>(response, "Unable to load facilities.");
        if (!active) return;
        setOrganizations(result.organizations ?? []);
        setActiveOrganizationId(result.activeOrganizationId ?? "");
      })
      .catch((error: unknown) => {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load facilities.");
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function changeOrganization(organizationId: string) {
    setIsSaving(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/profile/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      await readJsonResponse<{ error?: string }>(response, "Unable to switch facilities.");
      setActiveOrganizationId(organizationId);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to switch facilities.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading || organizations.length < 2) {
    return errorMessage ? (
      <p role="alert" className="mt-2 text-xs text-red-700">{errorMessage}</p>
    ) : null;
  }

  return (
    <div className="mt-2">
      <label htmlFor="active-facility" className="sr-only">Switch facility</label>
      <select
        id="active-facility"
        aria-label="Switch facility"
        value={activeOrganizationId}
        disabled={isSaving}
        onChange={(event) => void changeOrganization(event.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-60"
      >
        {organizations.map((item) => (
          <option key={item.organizationId} value={item.organizationId}>
            {item.name}
          </option>
        ))}
      </select>
      {errorMessage && <p role="alert" className="mt-1 text-xs text-red-700">{errorMessage}</p>}
    </div>
  );
}
