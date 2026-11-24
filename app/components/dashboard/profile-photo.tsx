"use client";

import { useEffect, useState } from "react";

export default function ProfilePhoto() {
  const [photoUrl, setPhotoUrl] = useState("");
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function loadPhoto() {
    const response = await fetch("/api/profile/photo", { cache: "no-store" });
    if (response.status === 404) {
      setPhotoUrl("");
      return;
    }
    const result = (await response.json()) as { url?: string; error?: string };
    if (!response.ok) throw new Error(result.error ?? "Unable to load profile photo.");
    setPhotoUrl(result.url ?? "");
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/profile/photo", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 404) return null;
        const result = (await response.json()) as { url?: string; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Unable to load profile photo.");
        return result.url ?? "";
      })
      .then((url) => {
        if (active) setPhotoUrl(url ?? "");
      })
      .catch((error: unknown) => {
        if (active) setMessage(error instanceof Error ? error.message : "Unable to load profile photo.");
      });
    return () => {
      active = false;
    };
  }, []);

  async function uploadPhoto(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsBusy(true);
    const form = event.currentTarget;
    try {
      const response = await fetch("/api/profile/photo", {
        method: "POST",
        body: new FormData(form),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to upload photo.");
      await loadPhoto();
      form.reset();
      setMessage("Profile photo updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upload photo.");
    } finally {
      setIsBusy(false);
    }
  }

  async function removePhoto() {
    setMessage("");
    setIsBusy(true);
    try {
      const response = await fetch("/api/profile/photo", { method: "DELETE" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to delete photo.");
      setPhotoUrl("");
      setMessage("Profile photo removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete photo.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Profile photo</h2>
      {photoUrl && (
        <a href={photoUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-emerald-700 underline">
          View current photo
        </a>
      )}
      <form onSubmit={uploadPhoto} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          name="photo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          required
          className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-emerald-800"
        />
        <button
          type="submit"
          disabled={isBusy}
          className="shrink-0 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-70"
        >
          Upload photo
        </button>
        {photoUrl && (
          <button
            type="button"
            onClick={removePhoto}
            disabled={isBusy}
            className="shrink-0 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-70"
          >
            Remove
          </button>
        )}
      </form>
      <p className="text-xs text-slate-500">PNG, JPEG, or WebP; maximum 5 MB.</p>
      {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
    </section>
  );
}
