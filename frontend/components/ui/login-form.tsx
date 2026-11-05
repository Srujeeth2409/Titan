"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { GradientBackground } from "@/components/ui/noisy-gradient-backgrounds";
import { useAuth } from "@/lib/auth-context";
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export interface LoginFormProps {
  className?: string;
  defaultMode?: "signin" | "signup";
  onSuccess?: () => void;
  redirectTo?: string;
  useGradientBackground?: boolean;
  stockImageUrl?: string;
}

export function LoginForm({
  className,
  defaultMode = "signin",
  onSuccess,
  redirectTo,
  useGradientBackground = true,
  // High quality Unsplash abstract wallpaper fallback
  stockImageUrl = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
}: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = redirectTo || searchParams?.get("next") || "/app/documents";

  // Auth context from Titan
  const auth = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim() || !password) {
      setError("Please fill in all required fields.");
      return;
    }

    if (mode === "signup") {
      if (password.length < 12) {
        setError("Password must be at least 12 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);

    try {
      if (auth && typeof auth.login === "function" && typeof auth.signup === "function") {
        if (mode === "signin") {
          await auth.login(email.trim(), password);
          setSuccess("Signed in successfully! Redirecting...");
        } else {
          await auth.signup(email.trim(), password);
          setSuccess("Account created successfully! Redirecting...");
        }
      } else {
        // Fallback for standalone demo
        await new Promise((resolve) => setTimeout(resolve, 800));
        setSuccess(mode === "signin" ? "Signed in successfully!" : "Account created successfully!");
      }

      if (onSuccess) {
        onSuccess();
      } else {
        setTimeout(() => {
          router.push(nextUrl);
        }, 500);
      }
    } catch (err: any) {
      setError(err?.message || "Authentication failed. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col md:flex-row w-full max-w-5xl mx-auto min-h-[640px] rounded-3xl overflow-hidden border border-zinc-200/90 dark:border-zinc-800/80 bg-white dark:bg-zinc-950/70 shadow-2xl shadow-zinc-900/10 backdrop-blur-xl",
        className
      )}
    >
      {/* Left Side: Dynamic Noisy Gradient Background (replaces static image) */}
      <div className="w-full md:w-1/2 relative hidden md:block overflow-hidden min-h-[640px]">
        {useGradientBackground ? (
          <GradientBackground
            gradientType="radial-gradient"
            gradientOrigin="bottom-middle"
            gradientSize="140% 140%"
            noiseIntensity={0.85}
            noisePatternSize={90}
            noisePatternRefreshInterval={2}
          >
            <div className="absolute inset-0 flex flex-col justify-between p-10 text-white bg-gradient-to-t from-black/40 via-transparent to-black/20">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-bold text-xl border border-white/30 shadow-lg">
                  T
                </div>
                <span className="text-xl font-bold tracking-tight drop-shadow-sm">Titan</span>
              </div>

              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-medium text-white tracking-wide uppercase">
                  <span>Enterprise RAG System</span>
                </div>
                <h3 className="text-3xl font-semibold leading-snug drop-shadow-md">
                  Unified RAG for all your enterprise documents.
                </h3>
                <p className="text-sm text-white/80 leading-relaxed drop-shadow">
                  Titan connects across your files, extracts precise citations, and synthesizes answers instantly.
                </p>
              </div>

              <div className="text-xs text-white/60">
                &copy; {new Date().getFullYear()} Titan RAG. All rights reserved.
              </div>
            </div>
          </GradientBackground>
        ) : (
          <img
            className="w-full h-full object-cover"
            src={stockImageUrl}
            alt="Authentication visual"
          />
        )}
      </div>

      {/* Right Side: Authentication Form */}
      <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-8 sm:p-12 text-zinc-900 dark:text-zinc-100">
        <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col">
          <div className="text-center md:text-left mb-6">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              {mode === "signin" ? "Sign in" : "Create account"}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
              {mode === "signin"
                ? "Welcome back! Please sign in to continue."
                : "Get started with Titan RAG System."}
            </p>
          </div>

          {/* Social Sign In Button */}
          <button
            type="button"
            onClick={() => {
              // Informative toast/notification for OAuth
              setError(null);
            }}
            className="w-full bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center gap-3 h-12 rounded-full border border-zinc-200 dark:border-zinc-800 transition-colors shadow-sm"
          >
            {/* Crisp Google Logo SVG */}
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span className="text-sm font-medium">Continue with Google</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 w-full my-5">
            <div className="w-full h-px bg-zinc-200 dark:bg-zinc-800"></div>
            <p className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500 font-medium uppercase tracking-wider">
              or with email
            </p>
            <div className="w-full h-px bg-zinc-200 dark:bg-zinc-800"></div>
          </div>

          {/* Feedback banners */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Email input field with Lucide icon */}
          <div className="flex items-center w-full bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 focus-within:border-indigo-500 dark:focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 h-12 rounded-full overflow-hidden px-4 gap-3 transition-all">
            <Mail className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="bg-transparent text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none text-sm w-full h-full"
              required
            />
          </div>

          {/* Password input field with Lucide icon */}
          <div className="flex items-center mt-4 w-full bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 focus-within:border-indigo-500 dark:focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 h-12 rounded-full overflow-hidden px-4 gap-3 transition-all">
            <Lock className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="bg-transparent text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none text-sm w-full h-full"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors p-1"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Confirm Password field in signup mode */}
          {mode === "signup" && (
            <div className="flex items-center mt-4 w-full bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 focus-within:border-indigo-500 dark:focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 h-12 rounded-full overflow-hidden px-4 gap-3 transition-all">
              <Lock className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="bg-transparent text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none text-sm w-full h-full"
                required
              />
            </div>
          )}

          {/* Remember me & Forgot Password */}
          <div className="w-full flex items-center justify-between mt-5 text-xs text-zinc-500 dark:text-zinc-400">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                type="checkbox"
                id="remember-me"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Remember me</span>
            </label>
            <a
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors underline"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                alert("Please contact your administrator to reset your credentials.");
              }}
            >
              Forgot password?
            </a>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full h-12 rounded-full text-white font-medium text-sm bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] transition-all flex items-center justify-center shadow-lg shadow-indigo-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : mode === "signin" ? (
              "Sign In"
            ) : (
              "Create Account"
            )}
          </button>

          {/* Toggle between Sign in & Sign up */}
          <p className="text-zinc-500 dark:text-zinc-400 text-xs text-center mt-5">
            {mode === "signin" ? (
              <>
                Don’t have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                    setSuccess(null);
                  }}
                  className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline ml-1"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                    setSuccess(null);
                  }}
                  className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline ml-1"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}

// Export default and alias Example for compatibility
export default LoginForm;
export { LoginForm as Example };

