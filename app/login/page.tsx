"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Mail, LockKeyhole, Eye, EyeOff, KeyRound, LogIn } from "lucide-react";

import { FaMicrosoft } from "react-icons/fa";
import { SiApple, SiGoogle } from "react-icons/si";
import { authClient } from "@/app/lib/auth-client";

import LeftBanner from "@/app/components/left-banners";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("email") && !url.searchParams.has("password")) return;

    url.searchParams.delete("email");
    url.searchParams.delete("password");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      const result = await authClient.signIn.email({
        email: String(formData.get("email")),
        password: String(formData.get("password")),
        rememberMe,
      });

      if (result.error) {
        setErrorMessage("Email or password is incorrect, or the account needs email verification.");
        return;
      }

      window.location.replace("/dashboard");
    } catch {
      setErrorMessage("Sign-in is temporarily unavailable. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSocialLogin(provider: "google" | "microsoft" | "apple") {
    setErrorMessage("");
    try {
      const response = await fetch("/api/auth/providers", { cache: "no-store" });
      const providers = (await response.json()) as Record<string, boolean>;

      if (!response.ok || !providers[provider]) {
        const providerName = provider[0].toUpperCase() + provider.slice(1);
        setErrorMessage(
          `${providerName} sign-in is not configured. Contact your administrator.`,
        );
        return;
      }

      const result = await authClient.signIn.social({
        provider,
        callbackURL: "/dashboard",
        errorCallbackURL: "/login?error=oauth",
      });

      if (!result.error) return;
      setErrorMessage("Social sign-in could not be started. Please try again.");
    } catch {
      setErrorMessage("Social sign-in is temporarily unavailable. Please try again.");
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Left Banner */}
      <LeftBanner />

      {/* Right Login Panel */}
      <div className="auth-panel flex min-h-screen w-full flex-col bg-white p-4 sm:p-6 md:p-8 lg:w-1/2 lg:border-l lg:border-slate-100 lg:p-10 xl:p-14">
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
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-semibold text-emerald-800 hover:underline">
              Sign up
            </Link>
          </span>
        </div>

        {/* Login Form Container */}
        <div className="max-w-lg w-full mx-auto my-auto space-y-6">
          {/* Heading */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">Welcome Back!</h2>

            <p className="text-sm text-slate-600">
              Sign in to your QueuePilot account
            </p>
          </div>

          <form action="/login" method="post" onSubmit={handleLogin} className="auth-form space-y-4">
            {/* Email Address */}
            <div className="space-y-1">
              <label htmlFor="login-email" className="text-xs font-semibold text-slate-700">
                Email Address
              </label>

              <div className="relative">
                <Mail aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

                <input
                  id="login-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="Email Address"
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label htmlFor="login-password" className="text-xs font-semibold text-slate-700">
                Password
              </label>

              <div className="relative">
                <LockKeyhole aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="Password"
                  className="w-full pl-11 pr-11 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded transition-colors"
                >
                  {showPassword ? <Eye size={17} /> : <EyeOff size={17} />}
                </button>
              </div>
            </div>

            {/* Remember Me and Forgot Password */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />

                <span>Remember me</span>
              </label>

              <Link
                href="/forgot-password"
                className="flex items-center gap-1 text-emerald-700 font-medium hover:underline"
              >
                <KeyRound size={13} />
                Forgot password?
              </Link>
            </div>

            {/* Login Button */}
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
              <LogIn size={17} />
              {isSubmitting ? "Signing in..." : "Login"}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex py-2 items-center text-xs text-slate-600">
            <div className="flex-grow border-t border-slate-200"></div>

            <span className="flex-shrink mx-4">or continue with</span>

            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Social Login Buttons */}
          <div className="grid grid-cols-1 min-[400px]:grid-cols-3 gap-3">
            {/* Google */}
            <button type="button" onClick={() => handleSocialLogin("google")}
              className="w-full min-w-0 flex items-center justify-center gap-2 py-2 px-3 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            >
              <SiGoogle aria-hidden="true" className="h-4 w-4 text-[#4285F4]" />
              Google
            </button>

            {/* Microsoft */}
            <button type="button" onClick={() => handleSocialLogin("microsoft")}
              className="w-full min-w-0 flex items-center justify-center gap-2 py-2 px-3 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            >
              <FaMicrosoft aria-hidden="true" className="h-4 w-4 text-[#5E5E5E]" />
              Microsoft
            </button>

            {/* Apple */}
            <button type="button" onClick={() => handleSocialLogin("apple")}
              className="w-full min-w-0 flex items-center justify-center gap-2 py-2 px-3 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            >
              <SiApple aria-hidden="true" className="h-4 w-4 text-black" />
              Apple
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-600 max-w-sm mx-auto">
          By continuing, you agree to our{" "}
          <Link href="#" className="text-slate-700 underline font-medium">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="#" className="text-slate-700 underline font-medium">
            Privacy Policy
          </Link>
          .
        </div>
        </div>
      </div>
    </div>
  );
}
