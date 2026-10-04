"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login, TitanApiError } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      await login(email, password);
      router.push("/app");
    } catch (err: any) {
      setError(
        err instanceof TitanApiError
          ? err.message
          : err.message || "Invalid credentials. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style jsx global>{`
        @keyframes heroChildSlideUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes formFadeIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .hero-child-1 { animation: heroChildSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.20s; opacity: 0; }
        .hero-child-2 { animation: heroChildSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.35s; opacity: 0; }
        .hero-child-3 { animation: heroChildSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.50s; opacity: 0; }
        .hero-child-4 { animation: heroChildSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.65s; opacity: 0; }
        .hero-child-5 { animation: heroChildSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.80s; opacity: 0; }

        .form-animated-container {
          animation: formFadeIn 0.8s ease-out forwards;
        }

        .atlantis-input::placeholder {
          color: rgba(255, 255, 255, 0.25);
        }
        .atlantis-input:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2);
        }
      `}</style>

      <main style={{
        display: "flex",
        minHeight: "100vh",
        width: "100%",
        backgroundColor: "#000000",
        color: "#ffffff",
        padding: "16px",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        boxSizing: "border-box",
        overflow: "hidden",
      }}>

        {/* LEFT COLUMN: Hero & Background Video */}
        <section style={{
          position: "relative",
          display: "flex",
          width: "52%",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingBottom: "110px",
          paddingLeft: "48px",
          paddingRight: "48px",
          borderRadius: "28px",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
          height: "calc(100vh - 32px)",
          userSelect: "none",
          flexShrink: 0,
        }}>
          <video
            autoPlay
            muted
            loop
            playsInline
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          >
            <source
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260506_081238_406ed0e3-5d83-436e-a512-0bbff7ec5b95.mp4"
              type="video/mp4"
            />
          </video>

          {/* Vignette overlay */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle at center, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.45) 100%)",
          }} />

          {/* Hero Content Container with Staggered Children Animations */}
          <div style={{
            position: "relative",
            zIndex: 10,
            width: "100%",
            maxWidth: "320px",
            display: "flex",
            flexDirection: "column",
            gap: "32px",
          }}>

            {/* Brand/Logo */}
            <div className="hero-child-1" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <svg style={{ width: "20px", height: "20px", fill: "white", color: "white" }} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
              </svg>
              <span style={{ fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.025em", color: "#ffffff" }}>Titan</span>
            </div>

            {/* Heading Block */}
            <div className="hero-child-2" style={{ display: "flex", flexDirection: "column", gap: "8px", textAlign: "left" }}>
              <h1 style={{ fontSize: "2.25rem", fontWeight: 500, letterSpacing: "-0.03em", whiteSpace: "nowrap", color: "#ffffff", margin: 0 }}>
                Welcome back
              </h1>
              <p style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "0.875rem", lineHeight: 1.6, margin: 0 }}>
                Authenticate your session to access your sovereign space.
              </p>
            </div>

            {/* Steps: StepItem component instances */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
              {/* Step 1: Active */}
              <div className="hero-child-3" style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                padding: "12px 16px",
                borderRadius: "16px",
                backgroundColor: "#ffffff",
                color: "#000000",
                border: "1px solid #ffffff",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
              }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "24px",
                  height: "24px",
                  borderRadius: "9999px",
                  backgroundColor: "#000000",
                  color: "#ffffff",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  flexShrink: 0,
                }}>
                  1
                </div>
                <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>Verify credentials</span>
              </div>

              {/* Step 2: Inactive */}
              <div className="hero-child-4" style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                padding: "12px 16px",
                borderRadius: "16px",
                backgroundColor: "#1A1A1A",
                color: "#ffffff",
              }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "24px",
                  height: "24px",
                  borderRadius: "9999px",
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  color: "rgba(255, 255, 255, 0.4)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  flexShrink: 0,
                }}>
                  2
                </div>
                <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "rgba(255, 255, 255, 0.8)" }}>Connect to enclave</span>
              </div>

              {/* Step 3: Inactive */}
              <div className="hero-child-5" style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                padding: "12px 16px",
                borderRadius: "16px",
                backgroundColor: "#1A1A1A",
                color: "#ffffff",
              }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "24px",
                  height: "24px",
                  borderRadius: "9999px",
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  color: "rgba(255, 255, 255, 0.4)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  flexShrink: 0,
                }}>
                  3
                </div>
                <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "rgba(255, 255, 255, 0.8)" }}>Resume workspace</span>
              </div>
            </div>

          </div>
        </section>

        {/* RIGHT COLUMN: Sign In Form */}
        <section style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 24px",
          overflowY: "auto",
        }}>
          <div className="form-animated-container" style={{
            width: "100%",
            maxWidth: "460px",
            display: "flex",
            flexDirection: "column",
            gap: "28px",
          }}>

            {/* Header */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <h2 style={{ fontSize: "1.875rem", fontWeight: 500, letterSpacing: "-0.025em", color: "#ffffff", margin: 0 }}>
                Sign In
              </h2>
              <p style={{ color: "rgba(255, 255, 255, 0.4)", fontSize: "0.875rem", margin: 0 }}>
                Enter your credentials to access your account.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div style={{
                padding: "12px 16px",
                borderRadius: "12px",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                color: "#f87171",
                fontSize: "0.875rem",
              }}>
                {error}
              </div>
            )}

            {/* Social Buttons Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              {/* Google / Chrome SocialButton */}
              <button
                type="button"
                onClick={() => alert("Google OAuth flow ready")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "12px",
                  height: "48px",
                  padding: "0 16px",
                  backgroundColor: "#000000",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "12px",
                  color: "#ffffff",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "background-color 150ms ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#000000")}
              >
                <svg style={{ width: "16px", height: "16px", color: "white" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <circle cx="12" cy="12" r="4"></circle>
                  <line x1="21.17" y1="8" x2="12" y2="8"></line>
                  <line x1="3.95" y1="6.06" x2="8.54" y2="14"></line>
                  <line x1="10.88" y1="21.94" x2="15.46" y2="14"></line>
                </svg>
                <span>Google</span>
              </button>

              {/* GitHub SocialButton */}
              <button
                type="button"
                onClick={() => alert("GitHub OAuth flow ready")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "12px",
                  height: "48px",
                  padding: "0 16px",
                  backgroundColor: "#000000",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "12px",
                  color: "#ffffff",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "background-color 150ms ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#000000")}
              >
                <svg style={{ width: "16px", height: "16px", color: "white" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path>
                  <path d="M9 18c-4.51 2-5-2-7-2"></path>
                </svg>
                <span>GitHub</span>
              </button>
            </div>

            {/* Divider */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: "100%", borderTop: "1px solid rgba(255, 255, 255, 0.1)" }}></div>
              <span style={{
                position: "absolute",
                backgroundColor: "#000000",
                padding: "0 16px",
                fontSize: "0.75rem",
                fontWeight: 500,
                color: "rgba(255, 255, 255, 0.4)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}>Or</span>
            </div>

            {/* Form Layout */}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* InputGroup: Email */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label htmlFor="email" style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "#ffffff" }}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="elena.rostova@atlantis.io"
                  className="atlantis-input"
                  style={{
                    width: "100%",
                    backgroundColor: "#1A1A1A",
                    border: "none",
                    borderRadius: "12px",
                    height: "44px",
                    padding: "0 16px",
                    color: "#ffffff",
                    fontSize: "0.875rem",
                    transition: "all 150ms ease",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Password with Eye toggle */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <label htmlFor="password" style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "#ffffff" }}>
                    Password
                  </label>
                  <a href="#" style={{ fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.4)", textDecoration: "none", transition: "color 150ms" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255, 255, 255, 0.4)")}>
                    Forgot password?
                  </a>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="atlantis-input"
                    style={{
                      width: "100%",
                      backgroundColor: "#1A1A1A",
                      border: "none",
                      borderRadius: "12px",
                      height: "44px",
                      padding: "0 44px 0 16px",
                      color: "#ffffff",
                      fontSize: "0.875rem",
                      transition: "all 150ms ease",
                      boxSizing: "border-box",
                    }}
                  />
                  <button
                    id="togglePassword"
                    type="button"
                    aria-label="Toggle password visibility"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: "14px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "rgba(255, 255, 255, 0.4)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                    }}
                  >
                    {showPassword ? (
                      <svg style={{ width: "16px", height: "16px" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path>
                        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path>
                        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path>
                        <line x1="2" y1="2" x2="22" y2="22"></line>
                      </svg>
                    ) : (
                      <svg style={{ width: "16px", height: "16px" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: "100%",
                  height: "56px",
                  backgroundColor: "#ffffff",
                  color: "#000000",
                  fontWeight: 600,
                  borderRadius: "12px",
                  border: "none",
                  marginTop: "16px",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.875rem",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                  transition: "all 200ms ease",
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#ffffff";
                }}
              >
                {isLoading ? "Signing in..." : "Log In"}
              </button>
            </form>

            {/* Footer Link */}
            <div style={{ textAlign: "center", paddingTop: "8px" }}>
              <p style={{ fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.5)", margin: 0 }}>
                Don&apos;t have an account?
                <Link href="/signup" style={{ color: "#ffffff", fontWeight: 500, marginLeft: "6px", textDecoration: "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                  onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}>
                  Sign up
                </Link>
              </p>
            </div>

          </div>
        </section>

      </main>
    </>
  );
}
