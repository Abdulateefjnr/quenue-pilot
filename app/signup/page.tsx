"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Mail,
  Lock,
  User,
  Building2,
  Phone,
  UserPlus,
} from "lucide-react";

import LeftBanner from "@/app/components/left-banners";

export default function SignUpPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSignUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          organizationName: formData.get("organizationName"),
          email: formData.get("email"),
          phone: formData.get("phone"),
          password: formData.get("password"),
          confirmPassword: formData.get("confirmPassword"),
          termsAccepted: formData.get("termsAccepted") === "on",
        }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setErrorMessage(result.error ?? "Unable to create your account. Please try again.");
        return;
      }

      router.push("/verify-email");
    } catch {
      setErrorMessage("Registration is temporarily unavailable. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Left Banner */}
      <LeftBanner />

      {/* Right Sign Up Panel */}
      <div className="auth-panel flex min-h-screen w-full flex-col overflow-y-auto bg-white p-4 sm:p-6 md:p-8 lg:w-1/2 lg:border-l lg:border-slate-100 lg:p-10 xl:p-14">
        <div className="flex flex-1 flex-col justify-between gap-8">
        {/* Top Navigation */}
        <div className="flex items-center justify-between gap-4 text-xs text-slate-600">
          <Link href="/login" aria-label="QueuePilot home" className="lg:hidden">
            <Image
              src="/images/queue-pilot.png"
              alt="QueuePilot"
              width={160}
              height={48}
              priority
              className="h-9 w-auto object-contain"
            />
          </Link>
          <span className="ml-auto">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-emerald-800 hover:underline">
              Sign in
            </Link>
          </span>
        </div>

        {/* Sign Up Form Container */}
        <div className="max-w-lg w-full mx-auto my-auto space-y-6 py-8">
          {/* Heading */}
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-slate-900">
              Create Your Account
            </h2>

            <p className="text-sm text-slate-600">
              Join QueuePilot and take the first step towards smarter healthcare
              management.
            </p>
          </div>

          <form onSubmit={handleSignUp} className="auth-form space-y-4">
            {/* Full Name */}
            <div className="space-y-1">
              <label htmlFor="signup-name" className="text-xs font-semibold text-slate-700">
                Full Name
              </label>

              <div className="relative">
                <User aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

                <input
                  id="signup-name"
                  name="name"
                  type="text"
                  required
                  placeholder="Full Name"
                  autoComplete="name"
                  className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Hospital / Clinic Name */}
            <div className="space-y-1">
              <label htmlFor="signup-organization" className="text-xs font-semibold text-slate-700">
                Hospital / Clinic Name
              </label>

              <div className="relative">
                <Building2 aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

                <input
                  id="signup-organization"
                  name="organizationName"
                  type="text"
                  required
                  placeholder="Hospital / Clinic Name"
                  autoComplete="organization"
                  className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Work Email */}
            <div className="space-y-1">
              <label htmlFor="signup-email" className="text-xs font-semibold text-slate-700">
                Work Email Address
              </label>

              <div className="relative">
                <Mail aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

                <input
                  id="signup-email"
                  name="email"
                  type="email"
                  required
                  placeholder="Work Email Address"
                  autoComplete="email"
                  className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Phone Number */}
            <div className="space-y-1">
              <label htmlFor="signup-phone" className="text-xs font-semibold text-slate-700">
                Phone Number (optional)
              </label>

              <div className="relative">
                <Phone aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

                <input
                  id="signup-phone"
                  name="phone"
                  type="tel"
                  placeholder="Phone Number"
                  autoComplete="tel"
                  maxLength={30}
                  className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
              </div>
              <p className="text-xs text-slate-500">
                You can leave this blank if you don&apos;t have a contact number.
              </p>
            </div>

            {/* Password Fields */}
            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-4">
              {/* Password */}
              <div className="space-y-1">
                <label htmlFor="signup-password" className="text-xs font-semibold text-slate-700">
                  Password
                </label>

                <div className="relative">
                  <Lock aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

                  <input
                    id="signup-password"
                    name="password"
                    type="password"
                    required
                    placeholder="Password"
                    autoComplete="new-password"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1">
                <label htmlFor="signup-confirm-password" className="text-xs font-semibold text-slate-700">
                  Confirm Password
                </label>

                <div className="relative">
                  <Lock aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

                  <input
                    id="signup-confirm-password"
                    name="confirmPassword"
                    type="password"
                    required
                    placeholder="Confirm"
                    autoComplete="new-password"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Terms and Conditions */}
            <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                name="termsAccepted"
                required
                className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
              />

              <span>
                I agree to the{" "}
                <Link
                  href="#"
                  className="text-emerald-700 underline font-medium"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="#"
                  className="text-emerald-700 underline font-medium"
                >
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

            {/* Create Account Button */}
            {errorMessage && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70 text-white font-medium py-2.5 rounded-xl text-sm transition-colors mt-2 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            >
              <UserPlus size={17} />
              {isSubmitting ? "Creating account..." : "Create Account"}
            </button>
          </form>
        </div>

        {/* Footer Support */}
        <div className="text-center text-xs text-slate-600 py-2">
          Need help?{" "}
          <Link
            href="#"
            className="text-emerald-700 font-medium hover:underline"
          >
            Contact Support
          </Link>
        </div>
        </div>
      </div>
    </div>
  );
}
