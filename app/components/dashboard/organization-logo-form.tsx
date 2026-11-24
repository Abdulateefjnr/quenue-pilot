"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { Building2, ImagePlus, LoaderCircle, Trash2, Upload } from "lucide-react";
import Button from "@/app/components/ui/button";

export default function OrganizationLogoForm() {
  const [logoUrl, setLogoUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/profile/organization/logo", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 404) return "";
        const result = (await response.json()) as { url?: string; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Unable to load facility logo.");
        if (!result.url) throw new Error("The server did not return a facility logo URL.");
        return result.url;
      })
      .then((url) => {
        if (active) setLogoUrl(url);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load facility logo.");
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setIsBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/profile/organization/logo", {
        method: "POST",
        body: new FormData(form),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to upload facility logo.");

      const logoResponse = await fetch("/api/profile/organization/logo", { cache: "no-store" });
      const logoResult = (await logoResponse.json()) as { url?: string; error?: string };
      if (!logoResponse.ok || !logoResult.url) {
        throw new Error(logoResult.error ?? "Logo uploaded, but its preview could not be loaded.");
      }
      setLogoUrl(logoResult.url);
      window.dispatchEvent(new CustomEvent("facility-logo-updated", { detail: logoResult.url }));
      setNotice("Facility logo updated.");
      form.reset();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload facility logo.");
    } finally {
      setIsBusy(false);
    }
  }

  async function removeLogo() {
    setIsBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/profile/organization/logo", { method: "DELETE" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to remove facility logo.");
      setLogoUrl("");
      window.dispatchEvent(new CustomEvent("facility-logo-updated", { detail: "" }));
      setNotice("Facility logo removed.");
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Unable to remove facility logo.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
          <ImagePlus size={20} aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-950">Facility logo</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Add your hospital or clinic logo to personalize your workspace.
          </p>
        </div>
      </div>

      <div className="mt-5 flex min-h-28 items-center gap-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt="Facility logo"
            width={80}
            height={80}
            unoptimized
            className="size-20 rounded-lg border border-slate-200 bg-white object-contain p-1"
          />
        ) : (
          <div className="flex size-20 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400">
            {isLoading ? <LoaderCircle size={22} className="animate-spin" aria-label="Loading logo" /> : <Building2 size={26} aria-hidden="true" />}
          </div>
        )}
        <p className="min-w-0 text-sm text-slate-600">
          {logoUrl ? "Current facility logo" : "No facility logo uploaded"}
        </p>
      </div>

      <form onSubmit={submit} className="mt-4 space-y-3">
        <label className="block text-sm font-medium text-slate-800" htmlFor="facility-logo-file">
          Choose an image
          <input
            id="facility-logo-file"
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
            disabled={isBusy}
            className="mt-2 block w-full min-w-0 rounded-md border border-slate-200 bg-white text-sm text-slate-700 file:mr-3 file:border-0 file:bg-emerald-50 file:px-3 file:py-2.5 file:font-medium file:text-emerald-900"
          />
        </label>
        <p className="text-xs text-slate-500">PNG, JPEG, or WebP · up to 5 MB</p>
        {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{notice}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {logoUrl && (
            <Button type="button" variant="outline" onClick={() => void removeLogo()} disabled={isBusy}>
              <Trash2 size={16} aria-hidden="true" /> Remove logo
            </Button>
          )}
          <Button type="submit" disabled={isBusy}>
            {isBusy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
            {isBusy ? "Saving…" : "Upload logo"}
          </Button>
        </div>
      </form>
    </section>
  );
}
