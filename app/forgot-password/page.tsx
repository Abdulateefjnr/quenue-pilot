"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function requestReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          redirectTo: `${window.location.origin}/reset-password`,
        }),
      });

      if (response.ok) {
        setMessage("If an account exists for that address, a password reset link has been sent.");
      } else if (response.status === 403) {
        setMessage("The security check blocked this request. Reload the page and try again.");
      } else if (response.status === 429) {
        setMessage("Too many reset requests. Wait a minute before trying again.");
      } else {
        setMessage("We couldn’t send a reset link right now. Please try again later.");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Password reset is temporarily unavailable. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4 sm:p-6">
      <section className="auth-card w-full max-w-lg space-y-6 p-6 sm:p-8">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-emerald-700">QueuePilot</p>
          <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
          <p className="text-sm text-slate-600">
            Enter your account email and we&apos;ll send a reset link if the account exists.
          </p>
        </div>

        <form onSubmit={requestReset} className="auth-form space-y-3">
          <label htmlFor="reset-email" className="block text-sm font-medium text-slate-700">Email address</label>
          <input
            id="reset-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Sending..." : "Send reset link"}
          </button>
          {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
        </form>

        <Link href="/login" className="block text-sm font-semibold text-emerald-700 hover:underline">Back to sign in</Link>
      </section>
    </main>
  );
}
