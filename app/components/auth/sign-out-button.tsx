"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/app/lib/auth-client";

export default function SignOutButton() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function signOut() {
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setErrorMessage("Unable to sign out. Please try again.");
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      setErrorMessage("Sign-out is temporarily unavailable. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={signOut}
        disabled={isSubmitting}
        className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-70 sm:px-4 sm:text-sm"
      >
        {isSubmitting ? "Signing out..." : "Sign out"}
      </button>
      {errorMessage && <p role="alert" className="mt-2 text-xs text-red-700">{errorMessage}</p>}
    </div>
  );
}
