"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SignOutButton from "@/app/components/auth/sign-out-button";

type PendingOrganization = {
  organizationName: string;
  organizationType: "hospital" | "clinic" | null;
  phone: string | null;
};

export default function OnboardingForm() {
  const router = useRouter();
  const [organizationType, setOrganizationType] = useState<"hospital" | "clinic">("hospital");
  const [pending, setPending] = useState<PendingOrganization | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/onboarding", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as {
          pending?: PendingOrganization | null;
          error?: string;
        };
        if (!response.ok) throw new Error(result.error ?? "Unable to load organization setup.");
        if (!active) return;
        setPending(result.pending ?? null);
        if (result.pending?.organizationType) setOrganizationType(result.pending.organizationType);
      })
      .catch((error: unknown) => {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load organization setup.");
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function completeOnboarding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: formData.get("organizationName"),
          organizationType,
          phone: formData.get("phone"),
          termsAccepted,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setErrorMessage(result.error ?? "Unable to finish setup. Please try again.");
        return;
      }
      router.replace("/dashboard");
    } catch {
      setErrorMessage("Organization setup is temporarily unavailable. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4 sm:p-6">
      <section className="auth-card w-full max-w-xl space-y-6 p-6 sm:p-8">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-emerald-700">QueuePilot</p>
          <h1 className="text-2xl font-bold text-slate-900">Set up your organization</h1>
          <p className="text-sm text-slate-600">Confirm your healthcare facility details to create your secure workspace.</p>
        </div>

        {isLoading ? (
          <div role="status" aria-label="Loading setup details" aria-busy="true" className="space-y-3">
            <span className="block h-10 animate-pulse rounded-lg bg-slate-100" />
            <span className="block h-10 animate-pulse rounded-lg bg-slate-100" />
            <span className="block h-10 animate-pulse rounded-lg bg-slate-100" />
          </div>
        ) : (
          <form onSubmit={completeOnboarding} className="auth-form space-y-4">
            <label className="block space-y-1 text-sm font-medium text-slate-700">
              Hospital / clinic name
              <input
                name="organizationName"
                type="text"
                minLength={2}
                maxLength={120}
                defaultValue={pending?.organizationName ?? ""}
                readOnly={Boolean(pending)}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 read-only:bg-slate-100"
              />
            </label>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-700">Facility type</legend>
              <div className="grid grid-cols-2 gap-3">
                {(["hospital", "clinic"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    disabled={Boolean(pending?.organizationType)}
                    aria-pressed={organizationType === type}
                    onClick={() => setOrganizationType(type)}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium capitalize disabled:cursor-default ${
                      organizationType === type
                        ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                        : "border-slate-300 text-slate-700"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="block space-y-1 text-sm font-medium text-slate-700">
              Contact phone (optional)
              <input
                name="phone"
                type="tel"
                maxLength={30}
                defaultValue={pending?.phone ?? ""}
                readOnly={Boolean(pending)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 read-only:bg-slate-100"
              />
            </label>

            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
                required
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
              <span>I confirm that I am authorized to create this organization workspace and agree to the service terms.</span>
            </label>

            {errorMessage && <p role="alert" className="text-sm text-red-700">{errorMessage}</p>}
            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Creating workspace..." : "Create workspace"}
            </button>
          </form>
        )}

        <p className="text-sm text-slate-600">Need another account? Use the sign-out control above before signing in with a different account.</p>
        <SignOutButton />
      </section>
    </main>
  );
}
