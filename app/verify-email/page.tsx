"use client";

import Link from "next/link";
import { useState } from "react";

export default function VerifyEmailPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function resendVerification(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/send-verification-email", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          callbackURL: `${window.location.origin}/verify-email?verified=true`,
        }),
      });

      if (response.ok) {
        setMessage("If the account needs verification, a new link has been sent.");
      } else if (response.status === 403) {
        setMessage("The security check blocked this request. Reload the page and try again.");
      } else if (response.status === 429) {
        setMessage("Too many verification requests. Wait a minute before trying again.");
      } else {
        setMessage("We couldn’t send a verification link right now. Please try again later.");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Email service is temporarily unavailable. Please try again.",
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
          <h1 className="text-2xl font-bold text-slate-900">Verify your email</h1>
          <p className="text-sm text-slate-600">
            Open the verification link we sent to your inbox. After verification,
            you can finish setting up your organization.
          </p>
        </div>

        <form onSubmit={resendVerification} className="auth-form space-y-3">
          <label htmlFor="verification-email" className="block text-sm font-medium text-slate-700">
            Email address
          </label>
          <input
            id="verification-email"
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
            {isSubmitting ? "Sending..." : "Resend verification email"}
          </button>
          {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
        </form>

        <p className="text-sm text-slate-600">
          Already verified? <Link href="/onboarding" className="font-semibold text-emerald-700 hover:underline">Continue setup</Link>
        </p>
      </section>
    </main>
  );
}
