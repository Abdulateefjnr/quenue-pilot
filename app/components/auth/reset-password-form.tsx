"use client";

import Link from "next/link";
import { useState } from "react";

export default function ResetPasswordForm({ token }: { token: string }) {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const newPassword = String(formData.get("newPassword"));
    const confirmPassword = String(formData.get("confirmPassword"));

    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match.");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      });

      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        setMessage(result.error ?? "This reset link is invalid or has expired.");
        return;
      }

      setMessage("Password updated. You can now sign in with your new password.");
    } catch {
      setMessage("Password reset is temporarily unavailable. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4 sm:p-6">
      <section className="auth-card w-full max-w-lg space-y-6 p-6 sm:p-8">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-emerald-700">QueuePilot</p>
          <h1 className="text-2xl font-bold text-slate-900">Choose a new password</h1>
          {!token && <p role="alert" className="text-sm text-red-700">This reset link is invalid or incomplete.</p>}
        </div>
        {token && (
          <form onSubmit={resetPassword} className="auth-form space-y-4">
            <label className="block space-y-1 text-sm font-medium text-slate-700">
              New password
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </label>
            <label className="block space-y-1 text-sm font-medium text-slate-700">
              Confirm new password
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </label>
            <p className="text-xs text-slate-600">Use at least 12 characters with uppercase, lowercase, a number, and a symbol.</p>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Updating..." : "Update password"}
            </button>
            {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
          </form>
        )}
        <Link href="/login" className="block text-sm font-semibold text-emerald-700 hover:underline">Back to sign in</Link>
      </section>
    </main>
  );
}
