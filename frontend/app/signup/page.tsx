"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signup, TitanApiError } from "@/lib/api";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string; trace_id?: string } | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || isLoading) return;

    if (password.length < 12) {
      setError({ message: "Password must be at least 12 characters long." });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await signup(email, password);
      setSuccess(true);
      setTimeout(() => router.push("/login"), 1500);
    } catch (err: any) {
      if (err instanceof TitanApiError) {
        setError({ message: err.message, code: err.code, trace_id: err.traceId });
      } else {
        setError({ message: err.message || "Failed to create account. Please try again." });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = password.length === 0
    ? null
    : password.length < 8
    ? "weak"
    : password.length < 12
    ? "fair"
    : "strong";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0F0F0F",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--font-body)",
      padding: "24px",
    }}>
      {/* Gradient orbs */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
        <div style={{
          position: "absolute", top: "-20%", right: "-10%",
          width: "500px", height: "500px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(79,142,255,0.06) 0%, transparent 70%)",
        }} />
        <div style={{
          position: "absolute", bottom: "-20%", left: "-10%",
          width: "600px", height: "600px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(79,142,255,0.04) 0%, transparent 70%)",
        }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "420px" }}>
        {/* Wordmark */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <Link href="/" style={{
            fontFamily: "var(--font-display)",
            fontSize: "2rem", fontWeight: 600,
            color: "#FFFFFF", letterSpacing: "-0.5px", textDecoration: "none",
          }}>
            Titan
          </Link>
          <p style={{ marginTop: "8px", fontSize: "0.875rem", color: "rgba(255,255,255,0.4)" }}>
            Create your workspace
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "#1A1A1A",
          borderRadius: "20px",
          border: "1px solid rgba(255,255,255,0.07)",
          padding: "36px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)",
        }}>
          {/* Success Banner */}
          {success && (
            <div style={{
              marginBottom: "20px", padding: "12px 16px", borderRadius: "10px",
              background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)",
              color: "#34D399", fontSize: "0.8125rem",
            }}>
              Account created! Redirecting to sign in…
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div style={{
              marginBottom: "20px", padding: "12px 16px", borderRadius: "10px",
              background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)",
              color: "#F87171", fontSize: "0.8125rem", lineHeight: 1.5,
            }}>
              <div>{error.message}</div>
              {(error.code || error.trace_id) && (
                <div style={{ fontSize: "0.7rem", marginTop: "4px", opacity: 0.7, fontFamily: "var(--font-mono)" }}>
                  {error.code && <span>Code: {error.code} </span>}
                  {error.trace_id && <span>| Trace: {error.trace_id}</span>}
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: "18px" }}>
              <label htmlFor="email" style={{
                display: "block", fontSize: "0.8125rem", fontWeight: 500,
                color: "rgba(255,255,255,0.6)", marginBottom: "8px",
              }}>
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                style={{
                  width: "100%", padding: "13px 16px", fontSize: "0.9375rem",
                  background: "#222222", border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: "10px", color: "#FFFFFF", outline: "none",
                  transition: "border-color 150ms ease, box-shadow 150ms ease",
                  fontFamily: "var(--font-body)",
                }}
                onFocus={(e) => { e.target.style.borderColor = "rgba(79,142,255,0.6)"; e.target.style.boxShadow = "0 0 0 3px rgba(79,142,255,0.12)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.09)"; e.target.style.boxShadow = "none"; }}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: "10px" }}>
              <label htmlFor="password" style={{
                display: "block", fontSize: "0.8125rem", fontWeight: 500,
                color: "rgba(255,255,255,0.6)", marginBottom: "8px",
              }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 12 characters"
                  style={{
                    width: "100%", padding: "13px 48px 13px 16px", fontSize: "0.9375rem",
                    background: "#222222", border: "1px solid rgba(255,255,255,0.09)",
                    borderRadius: "10px", color: "#FFFFFF", outline: "none",
                    transition: "border-color 150ms ease, box-shadow 150ms ease",
                    fontFamily: "var(--font-body)",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "rgba(79,142,255,0.6)"; e.target.style.boxShadow = "0 0 0 3px rgba(79,142,255,0.12)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.09)"; e.target.style.boxShadow = "none"; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    color: "rgba(255,255,255,0.35)", padding: "4px",
                    display: "flex", alignItems: "center", transition: "color 150ms ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.65)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Password strength indicator */}
              {passwordStrength && (
                <div style={{ marginTop: "8px" }}>
                  <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
                    {["weak", "fair", "strong"].map((level, i) => (
                      <div key={level} style={{
                        flex: 1, height: "3px", borderRadius: "2px",
                        background: passwordStrength === "strong" && i <= 2
                          ? "#34D399"
                          : passwordStrength === "fair" && i <= 1
                          ? "#FBBF24"
                          : passwordStrength === "weak" && i === 0
                          ? "#F87171"
                          : "rgba(255,255,255,0.1)",
                        transition: "background 200ms ease",
                      }} />
                    ))}
                  </div>
                  <span style={{
                    fontSize: "0.75rem",
                    color: passwordStrength === "strong" ? "#34D399" : passwordStrength === "fair" ? "#FBBF24" : "#F87171",
                  }}>
                    {passwordStrength === "strong" ? "Strong password" : passwordStrength === "fair" ? "Fair — add more characters" : "Too short"}
                  </span>
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              id="signup-submit"
              type="submit"
              disabled={isLoading || !email || password.length < 12}
              style={{
                width: "100%", marginTop: "24px", padding: "14px",
                fontSize: "0.9375rem", fontWeight: 600, borderRadius: "10px",
                background: isLoading || !email || password.length < 12
                  ? "rgba(79,142,255,0.4)"
                  : "linear-gradient(135deg, #4F8EFF 0%, #3B75E8 100%)",
                color: "#fff", border: "none",
                cursor: isLoading || !email || password.length < 12 ? "not-allowed" : "pointer",
                transition: "all 200ms ease", letterSpacing: "0.01em",
                fontFamily: "var(--font-body)",
                boxShadow: isLoading || !email || password.length < 12 ? "none" : "0 4px 16px rgba(79,142,255,0.3)",
              }}
              onMouseEnter={(e) => {
                if (!isLoading && email && password.length >= 12) {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(79,142,255,0.4)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 16px rgba(79,142,255,0.3)";
              }}
            >
              {isLoading ? "Creating account…" : "Create account"}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "24px 0" }}>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.07)" }} />
            <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.25)", whiteSpace: "nowrap" }}>or</span>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.07)" }} />
          </div>

          {/* Google */}
          <button
            type="button"
            id="google-signup-btn"
            onClick={() => alert("Google OAuth — wire up your provider")}
            style={{
              width: "100%", padding: "13px", fontSize: "0.9375rem", fontWeight: 500,
              borderRadius: "10px", background: "#242424",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.85)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
              transition: "all 150ms ease", fontFamily: "var(--font-body)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#2C2C2C"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#242424"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div style={{ marginTop: "28px", textAlign: "center", fontSize: "0.8125rem", color: "rgba(255,255,255,0.35)" }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "rgba(255,255,255,0.65)", fontWeight: 500, textDecoration: "none" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#FFFFFF")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.65)")}
            >
              Sign in
            </Link>
          </div>
        </div>

        <p style={{
          marginTop: "24px", textAlign: "center", fontSize: "0.75rem",
          color: "rgba(255,255,255,0.2)", lineHeight: 1.6,
        }}>
          By continuing, you agree to Titan&apos;s{" "}
          <span style={{ color: "rgba(255,255,255,0.35)" }}>Terms of Service</span>
          {" "}and{" "}
          <span style={{ color: "rgba(255,255,255,0.35)" }}>Privacy Policy</span>
        </p>
      </div>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-text-fill-color: #ffffff;
          -webkit-box-shadow: 0 0 0px 1000px #222222 inset;
          caret-color: #ffffff;
        }
      `}</style>
    </div>
  );
}
