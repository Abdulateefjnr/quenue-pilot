"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Facility = {
  organizationId: string;
  name: string;
  role: string;
};

export default function FacilitySelectionForm({
  facilities,
}: {
  facilities: Facility[];
}) {
  const router = useRouter();
  const [organizationId, setOrganizationId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function selectFacility(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/profile/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to open this facility.");
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to open this facility.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={selectFacility} className="auth-form space-y-4">
      <label htmlFor="facility" className="block space-y-1 text-sm font-medium text-slate-700">
        Facility
        <select
          id="facility"
          required
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
        >
          <option value="">Choose a facility</option>
          {facilities.map((facility) => (
            <option key={facility.organizationId} value={facility.organizationId}>
              {facility.name} ({facility.role})
            </option>
          ))}
        </select>
      </label>
      {errorMessage && <p role="alert" className="text-sm text-red-700">{errorMessage}</p>}
      <button
        type="submit"
        disabled={isSubmitting || !organizationId}
        className="w-full rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Opening facility..." : "Continue"}
      </button>
    </form>
  );
}
