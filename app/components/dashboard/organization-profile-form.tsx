"use client";

import { FormEvent, useState } from "react";
import { Check, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/ui/button";

type FacilityProfile = {
  organizationName: string;
  organizationType: "hospital" | "clinic";
  phone: string;
};

export default function OrganizationProfileForm({
  initialProfile,
}: {
  initialProfile: FacilityProfile;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const response = await fetch("/api/profile/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = (await response.json()) as {
        error?: string;
        profile?: FacilityProfile;
      };
      if (!response.ok) throw new Error(data.error ?? "Could not save facility profile.");
      if (!data.profile) throw new Error("The server did not return the saved facility profile.");
      setProfile(data.profile);
      setSaved(true);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save facility profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="border-b border-slate-100 pb-5">
        <h2 className="text-base font-semibold text-slate-950">Facility information</h2>
        <p className="mt-1 text-sm text-slate-500">Update your hospital or clinic details.</p>
      </div>
      <form className="mt-5 space-y-5" onSubmit={submit} aria-busy={saving}>
        <label className="block text-sm font-medium text-slate-800" htmlFor="facility-name">
          Facility name
          <input
            id="facility-name"
            autoComplete="organization"
            required
            minLength={2}
            maxLength={120}
            value={profile.organizationName}
            onChange={(event) => setProfile({ ...profile, organizationName: event.target.value })}
            className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-600"
          />
        </label>

        <label className="block text-sm font-medium text-slate-800" htmlFor="facility-type">
          Facility type
          <select
            id="facility-type"
            value={profile.organizationType}
            onChange={(event) => {
              const organizationType = event.currentTarget.value;
              if (organizationType === "hospital" || organizationType === "clinic") {
                setProfile({ ...profile, organizationType });
              }
            }}
            className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <option value="hospital">Hospital</option>
            <option value="clinic">Clinic</option>
          </select>
        </label>

        <label className="block text-sm font-medium text-slate-800" htmlFor="facility-phone">
          Contact phone <span className="font-normal text-slate-500">(optional)</span>
          <input
            id="facility-phone"
            type="tel"
            autoComplete="tel"
            maxLength={30}
            value={profile.phone}
            onChange={(event) => setProfile({ ...profile, phone: event.target.value })}
            className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-600"
          />
        </label>

        {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        {saved && (
          <p role="status" className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <Check size={16} aria-hidden="true" /> Facility profile saved.
          </p>
        )}
        <div className="flex justify-end border-t border-slate-100 pt-4">
          <Button type="submit" disabled={saving}>
            <Save size={16} aria-hidden="true" />
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </section>
  );
}
