"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { TitanApiError } from "@/lib/api";

const FRONT_LILY_URL =
  "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260808_192942_e1086505-d7da-433b-a59b-8220f4e6c808.png&w=1280&q=85";
const REVEAL_LILY_URL =
  "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260808_151324_bf318a5f-5525-4fc7-aab5-e9a341018828.png&w=1280&q=85";

const TRAIL_MAX_POINTS = 60;
const TRAIL_HEAD_R = 140;
const TRAIL_NOISE_AMP = 44;
const TRAIL_BLOB_PTS = 24;
const TRAIL_FADE_SPEED = 0.92;
const TRAIL_SAMPLE_DIST = 8;

interface TrailPoint {
  x: number;
  y: number;
  r: number;
  alpha: number;
  seed: number;
}

function LoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const nextUrl = searchParams.get("next") || "/app/documents";
    const {user, login, signup} = useAuth();

    // Mode: "signin" | "signup"
    const [mode, setMode] = useState<"signin" | "signup">("signin");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<{ message: string; code?: string } | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // If already authenticated, redirect
    useEffect(() => {
      if (user) {
        router.push(nextUrl);
      }
    }, [user, router, nextUrl]);

    // Stage & morph reveal refs
    const stageRef = useRef<HTMLElement>(null);
    const flowerRef = useRef<HTMLDivElement>(null);
    const bgLayerRef = useRef<HTMLDivElement>(null);
    const topLayerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      // Entrance choreography: class anim removed after 4.5s
      const animTimer = setTimeout(() => {
        document.documentElement.classList.remove("anim");
      }, 4500);

      const canvasBg = document.createElement("canvas");
      const ctxBg = canvasBg.getContext("2d", {willReadFrequently: true});
      const canvasTop = document.createElement("canvas");
      const ctxTop = canvasTop.getContext("2d", {willReadFrequently: true});

      let headRadius = 0;
      let hovering = false;
      let mouseX = 0;
      let mouseY = 0;
      let lastX = -9999;
      let lastY = -9999;
      let trail: TrailPoint[] = [];
      let time = 0;
      let animId: number;

      const drawBlob = (
          ctx: CanvasRenderingContext2D,
          cx: number,
          cy: number,
          r: number,
          t: number,
          seed: number
      ) => {
        if (r < 2) return;
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i < TRAIL_BLOB_PTS; i++) {
          const angle = (i / TRAIL_BLOB_PTS) * Math.PI * 2;
          const n1 = Math.sin(angle * 3 + t * 1.4 + seed) * 0.45;
          const n2 = Math.sin(angle * 5 - t * 0.9 + seed * 2.3) * 0.3;
          const n3 = Math.cos(angle * 2 + t * 1.8 + seed * 0.7) * 0.25;
          const noise = (n1 + n2 + n3) * TRAIL_NOISE_AMP * (r / 140);
          const rad = Math.max(0, r + noise);
          pts.push({
            x: cx + Math.cos(angle) * rad,
            y: cy + Math.sin(angle) * rad,
          });
        }

        ctx.beginPath();
        const len = pts.length;
        for (let i = 0; i < len; i++) {
          const p0 = pts[i];
          const p1 = pts[(i + 1) % len];
          const midX = (p0.x + p1.x) / 2;
          const midY = (p0.y + p1.y) / 2;
          if (i === 0) {
            ctx.moveTo(midX, midY);
          } else {
            ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
          }
        }
        ctx.closePath();
        ctx.fill();
      };

      const handleMouseMove = (e: MouseEvent) => {
        hovering = true;
        if (!flowerRef.current) return;
        const rect = flowerRef.current.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
      };

      const handleMouseEnter = () => {
        hovering = true;
      };

      const handleMouseLeave = () => {
        hovering = false;
      };

      const stage = stageRef.current;
      if (stage) {
        stage.addEventListener("mousemove", handleMouseMove);
        stage.addEventListener("mouseenter", handleMouseEnter);
        stage.addEventListener("mouseleave", handleMouseLeave);
      }

      const renderFrame = () => {
        animId = requestAnimationFrame(renderFrame);
        if (!flowerRef.current || !bgLayerRef.current || !topLayerRef.current || !ctxBg || !ctxTop) {
          return;
        }

        const rect = flowerRef.current.getBoundingClientRect();
        const w = Math.max(1, Math.round(rect.width));
        const h = Math.max(1, Math.round(rect.height));

        if (canvasBg.width !== w || canvasBg.height !== h) {
          canvasBg.width = w;
          canvasBg.height = h;
          canvasTop.width = w;
          canvasTop.height = h;
        }

        const targetR = hovering ? TRAIL_HEAD_R : 0;
        headRadius += (targetR - headRadius) * (hovering ? 0.14 : 0.04);

        if (hovering && headRadius > 5) {
          const dx = mouseX - lastX;
          const dy = mouseY - lastY;
          const dist = Math.hypot(dx, dy);
          if (dist > TRAIL_SAMPLE_DIST) {
            trail.push({
              x: mouseX,
              y: mouseY,
              r: headRadius,
              alpha: 1,
              seed: Math.random() * 100,
            });
            if (trail.length > TRAIL_MAX_POINTS) trail.shift();
            lastX = mouseX;
            lastY = mouseY;
          }
        }

        time += 0.016;

        // Update trail decay
        for (let i = trail.length - 1; i >= 0; i--) {
          trail[i].alpha *= TRAIL_FADE_SPEED;
          trail[i].r *= 0.995;
          if (trail[i].alpha < 0.01) {
            trail.splice(i, 1);
          }
        }

        // If no points and not hovering, keep default state
        if (trail.length === 0 && headRadius < 2) {
          bgLayerRef.current.style.maskImage = "";
          (bgLayerRef.current.style as any).webkitMaskImage = "";
          topLayerRef.current.style.maskImage = "linear-gradient(#0000, #0000)";
          (topLayerRef.current.style as any).webkitMaskImage = "linear-gradient(#0000, #0000)";
          return;
        }

        // 1. BG Layer: White fill + destination-out blobs
        ctxBg.clearRect(0, 0, w, h);
        ctxBg.fillStyle = "#ffffff";
        ctxBg.fillRect(0, 0, w, h);
        ctxBg.globalCompositeOperation = "destination-out";

        // 2. Top Layer: Clear + white blobs
        ctxTop.clearRect(0, 0, w, h);
        ctxTop.fillStyle = "#ffffff";
        ctxTop.globalCompositeOperation = "source-over";

        for (const pt of trail) {
          ctxBg.fillStyle = `rgba(0, 0, 0, ${pt.alpha})`;
          drawBlob(ctxBg, pt.x, pt.y, pt.r, time, pt.seed);

          ctxTop.fillStyle = `rgba(255, 255, 255, ${pt.alpha})`;
          drawBlob(ctxTop, pt.x, pt.y, pt.r, time, pt.seed);
        }

        // Draw head blob if hovering
        if (hovering && headRadius > 2) {
          ctxBg.fillStyle = "rgba(0, 0, 0, 1)";
          drawBlob(ctxBg, mouseX, mouseY, headRadius, time, 42);

          ctxTop.fillStyle = "rgba(255, 255, 255, 1)";
          drawBlob(ctxTop, mouseX, mouseY, headRadius, time, 42);
        }

        const maskBgUrl = `url(${canvasBg.toDataURL()})`;
        const maskTopUrl = `url(${canvasTop.toDataURL()})`;

        bgLayerRef.current.style.maskImage = maskBgUrl;
        (bgLayerRef.current.style as any).webkitMaskImage = maskBgUrl;
        bgLayerRef.current.style.maskSize = "100% 100%";
        (bgLayerRef.current.style as any).webkitMaskSize = "100% 100%";

        topLayerRef.current.style.maskImage = maskTopUrl;
        (topLayerRef.current.style as any).webkitMaskImage = maskTopUrl;
        topLayerRef.current.style.maskSize = "100% 100%";
        (topLayerRef.current.style as any).webkitMaskSize = "100% 100%";
      };

      renderFrame();

      return () => {
        clearTimeout(animTimer);
        cancelAnimationFrame(animId);
        if (stage) {
          stage.removeEventListener("mousemove", handleMouseMove);
          stage.removeEventListener("mouseenter", handleMouseEnter);
          stage.removeEventListener("mouseleave", handleMouseLeave);
        }
      };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSuccess(null);

      if (!email.trim() || !password) {
        setError({message: "Please enter both email and password."});
        return;
      }

      if (mode === "signup") {
        if (password.length < 12) {
          setError({message: "Password must be at least 12 characters long."});
          return;
        }
        if (password !== confirmPassword) {
          setError({message: "Passwords do not match."});
          return;
        }
      }

      setLoading(true);

      try {
        if (mode === "signin") {
          await login(email.trim(), password);
          setSuccess("Signed in successfully! Redirecting...");
        } else {
          await signup(email.trim(), password);
          setSuccess("Account created successfully! Redirecting...");
        }
        setTimeout(() => {
          router.push(nextUrl);
        }, 500);
      } catch (err: any) {
        if (err instanceof TitanApiError) {
          setError({message: err.message, code: err.code});
        } else {
          setError({message: err.message || "Authentication failed."});
        }
      } finally {
        setLoading(false);
      }
    };

    return (
        <>
          <style jsx global>{`
            :root {
              --ink: #ffffff;
              --surface: #161616;
              --orb-reveal: cubic-bezier(0.16, 1, 0.3, 1);
              --orb-soft: cubic-bezier(0.25, 0.8, 0.28, 1);
            }

            html, body {
              width: 100%;
              height: 100%;
              margin: 0;
              padding: 0;
              overflow: hidden !important;
              background: #161616 !important;
              color: #ffffff;
              font-family: "Orbit Sans", Arial, Helvetica, sans-serif;
              -webkit-font-smoothing: antialiased;
            }

            /* ── Animations ── */
            @keyframes orb-quiet {
              0% {
                opacity: 0;
                transform: translateY(14px);
              }
              100% {
                opacity: 1;
                transform: translateY(0);
              }
            }

            @keyframes orb-dim {
              0% {
                opacity: 0;
              }
              100% {
                opacity: 1;
              }
            }

            @keyframes orb-word {
              0% {
                transform: translateY(118%);
              }
              100% {
                transform: translateY(0);
              }
            }

            @keyframes orb-subject {
              0% {
                opacity: 0;
                transform: translateX(-50%) translateY(3.4dvh);
              }
              100% {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
              }
            }

            @keyframes orb-corner {
              0% {
                opacity: 0;
                transform: translateY(12px);
              }
              100% {
                opacity: 1;
                transform: translateY(0);
              }
            }

            .anim .brand-mark {
              animation: orb-quiet 620ms var(--orb-soft) 100ms both;
            }




            .anim .secure-system-pill {
              animation: orb-quiet 620ms var(--orb-soft) 340ms both;
            }

            .anim .orbit-word__inner {
              animation: orb-word 1150ms var(--orb-reveal) 300ms both;
            }

            .anim .flower {
              animation: orb-subject 1150ms var(--orb-reveal) 660ms both;
            }

            .anim .support-copy__inner {
              animation: orb-corner 720ms var(--orb-soft) 980ms both;
            }

            /* ── Split Layout ── */
            .login-split-container {
              display: flex;
              width: 100vw;
              height: 100dvh;
              background: #161616;
              overflow: hidden;
            }

            .login-left-stage {
              position: relative;
              width: 60%;
              height: 100%;
              background: #161616;
              overflow: hidden;
              contain: strict;
              isolation: isolate;
              border-right: 1px solid rgba(255, 255, 255, 0.08);
            }

            .login-right-pane {
              width: 40%;
              height: 100%;
              background: radial-gradient(circle at 70% 30%, #1f1f1f 0%, #161616 70%);
              display: flex;
              align-items: center;
              justify-content: center;
              position: relative;
              z-index: 20;
              padding: clamp(24px, 5vw, 64px);
              box-sizing: border-box;
            }

            /* ── Left Stage Elements ── */
            .brand-mark {
              position: absolute;
              top: 2.141745dvh;
              left: 3.854167vw;
              width: clamp(34px, min(3.4375vw, 5.2dvh), 66px);
              z-index: 4;
            }

            /* nav removed */

            .secure-system-pill {
              position: absolute;
              top: 2.336449dvh;
              right: 3.5vw;
              height: clamp(32px, 4.439252dvh, 52px);
              padding: 0 clamp(14px, 1.8vw, 24px);
              display: flex;
              align-items: center;
              background: #ffffff;
              color: #161616;
              border-radius: 999px;
              font-size: clamp(11px, 1.3dvh, 15px);
              font-weight: 600;
              letter-spacing: 0.026923em;
              z-index: 4;
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
            }

            .orbit-word {
              position: absolute;
              top: 10.565421dvh;
              left: 3.848958vw;
              margin: 0;
              padding: 0;
              font-family: "Orbit Display", "Times New Roman", Times, serif;
              font-size: min(12vw, 28dvh);
              line-height: 0.95;
              letter-spacing: 0.033708em;
              z-index: 1;
              user-select: none;
            }

            .orbit-word__mask {
              display: block;
              overflow: hidden;
              padding-bottom: 0.1em;
              margin-bottom: -0.1em;
            }

            .orbit-word__inner {
              display: flex;
              align-items: baseline;
            }

            .orbit-word__white {
              color: #ffffff;
            }

            .orbit-word__pink {
              background: linear-gradient(180deg, #ffc5dc 0%, #fd86db 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }

            .flower {
              position: absolute;
              top: 14.749065dvh;
              left: 50%;
              height: 106.109034dvh;
              transform: translateX(-50%);
              pointer-events: none;
              z-index: 2;
            }

            .flower__sizer {
              height: 100%;
              width: auto;
              visibility: hidden;
            }

            .flower__layer {
              position: absolute;
              inset: 0;
            }

            .flower__layer img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }

            .flower__layer--top {
              mask-image: linear-gradient(#0000, #0000);
              -webkit-mask-image: linear-gradient(#0000, #0000);
            }

            .support-copy {
              position: absolute;
              bottom: 4.361371dvh;
              color: #f7f7f7;
              font-size: clamp(12px, min(1.1vw, 1.8dvh), 20px);
              line-height: 1.35;
              z-index: 3;
              pointer-events: none;
            }

            .support-copy--left {
              left: 3.177083vw;
            }

            .support-copy--right {
              right: 3.177083vw;
              text-align: right;
            }

            .support-copy--left .support-copy__inner {
              display: block;
              transform: scaleX(1.073);
              transform-origin: left bottom;
            }

            .support-copy--right .support-copy__inner {
              display: block;
              transform: scaleX(1.058);
              transform-origin: right bottom;
            }

            /* ── Right Pane Card ── */
            .auth-card {
              width: 100%;
              max-width: 440px;
              background: rgba(22, 22, 22, 0.7);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 20px;
              padding: clamp(24px, 3.5vw, 40px);
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1);
              backdrop-filter: blur(24px);
              -webkit-backdrop-filter: blur(24px);
            }

            .auth-header {
              margin-bottom: 28px;
            }

            .auth-header-tag {
              display: inline-block;
              font-size: 11px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.12em;
              color: #ffc5dc;
              margin-bottom: 8px;
            }

            .auth-title {
              font-size: clamp(24px, 2.5vw, 30px);
              font-weight: 600;
              color: #ffffff;
              margin: 0 0 8px 0;
              letter-spacing: -0.02em;
            }

            .auth-subtitle {
              font-size: 14px;
              color: rgba(255, 255, 255, 0.55);
              margin: 0;
              line-height: 1.4;
            }

            .auth-tabs {
              display: flex;
              background: rgba(255, 255, 255, 0.05);
              border-radius: 12px;
              padding: 4px;
              margin-bottom: 24px;
              border: 1px solid rgba(255, 255, 255, 0.06);
            }

            .auth-tab {
              flex: 1;
              background: transparent;
              border: none;
              color: rgba(255, 255, 255, 0.6);
              font-size: 13px;
              font-weight: 500;
              padding: 10px 16px;
              border-radius: 9px;
              cursor: pointer;
              transition: all 0.2s ease;
            }

            .auth-tab.active {
              background: #ffffff;
              color: #161616;
              font-weight: 600;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
            }

            .auth-form {
              display: flex;
              flex-direction: column;
              gap: 16px;
            }

            .form-group {
              display: flex;
              flex-direction: column;
              gap: 6px;
            }

            .form-label {
              font-size: 12px;
              font-weight: 500;
              color: rgba(255, 255, 255, 0.7);
            }

            .form-input {
              width: 100%;
              background: rgba(255, 255, 255, 0.04);
              border: 1px solid rgba(255, 255, 255, 0.12);
              border-radius: 10px;
              padding: 12px 14px;
              font-size: 14px;
              color: #ffffff;
              outline: none;
              box-sizing: border-box;
              transition: border-color 0.2s ease, background 0.2s ease;
            }

            .form-input:focus {
              border-color: rgba(255, 255, 255, 0.4);
              background: rgba(255, 255, 255, 0.07);
            }

            .form-hint {
              font-size: 11px;
              color: rgba(255, 255, 255, 0.4);
              margin-top: 2px;
            }

            .form-btn {
              margin-top: 8px;
              background: #ffffff;
              color: #161616;
              border: none;
              border-radius: 10px;
              padding: 13px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              transition: transform 0.15s ease, opacity 0.2s ease;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
            }

            .form-btn:hover:not(:disabled) {
              opacity: 0.92;
              transform: translateY(-1px);
            }

            .form-btn:disabled {
              opacity: 0.5;
              cursor: not-allowed;
            }

            .banner-msg {
              padding: 10px 14px;
              border-radius: 8px;
              font-size: 13px;
              display: flex;
              align-items: center;
              gap: 8px;
            }

            .banner-msg.error {
              background: rgba(239, 68, 68, 0.12);
              border: 1px solid rgba(239, 68, 68, 0.3);
              color: #fca5a5;
            }

            .banner-msg.success {
              background: rgba(34, 197, 94, 0.12);
              border: 1px solid rgba(34, 197, 94, 0.3);
              color: #86efac;
            }

            @media (max-width: 900px) {
              .login-split-container {
                flex-direction: column;
                overflow-y: auto;
              }

              .login-left-stage {
                display: none;
              }

              .login-right-pane {
                width: 100%;
                min-height: 100dvh;
              }
            }
          `}</style>

          <main className="login-split-container">
            {/* ── LEFT POSTER STAGE (ORBIT SPEC) ── */}
            <section ref={stageRef} className="login-left-stage stage">
              {/* Asterisk Brand Mark */}
              <svg className="brand-mark" viewBox="0 0 66 62" fill="none">
                <line x1="33" y1="1" x2="33" y2="61" stroke="#ffffff" strokeWidth="5" strokeLinecap="square"/>
                <line x1="3" y1="31" x2="63" y2="31" stroke="#ffffff" strokeWidth="5" strokeLinecap="square"/>
                <line x1="11.8" y1="9.8" x2="54.2" y2="52.2" stroke="#ffffff" strokeWidth="5" strokeLinecap="square"/>
                <line x1="54.2" y1="9.8" x2="11.8" y2="52.2" stroke="#ffffff" strokeWidth="5" strokeLinecap="square"/>
              </svg>

              {/* Nav links removed */}

              {/* Secure system pill */}
              <div className="secure-system-pill">
                <span>Secure system</span>
              </div>

              {/* Wordmark TITAN */}
              <h1 className="orbit-word" id="orbit-title" aria-label="Titan">
            <span className="orbit-word__mask">
              <span className="orbit-word__inner">
                <span className="orbit-word__white">TI</span>
                <span className="orbit-word__pink">TAN</span>
              </span>
            </span>
              </h1>

              {/* Flower Stack */}
              <div ref={flowerRef} className="flower">
                <img className="flower__sizer" src={FRONT_LILY_URL} alt="" aria-hidden="true"/>
                <div ref={bgLayerRef} className="flower__layer flower__layer--bg">
                  <img src={FRONT_LILY_URL} alt="Pixel-art pink and violet lily"/>
                </div>
                <div ref={topLayerRef} className="flower__layer flower__layer--top" aria-hidden="true">
                  <img src={REVEAL_LILY_URL} alt=""/>
                </div>
              </div>

              {/* Corner Copy */}
              <div className="support-copy support-copy--left">
            <span className="support-copy__inner">
              Every workflow,<br/>intelligently connected.
            </span>
              </div>
              <div className="support-copy support-copy--right">
            <span className="support-copy__inner">
              Less manual work.<br/>More meaningful output.
            </span>
              </div>
            </section>

            {/* ── RIGHT AUTH PANE ── */}
            <section className="login-right-pane">
              <div className="auth-card">
                <div className="auth-header">
                  <span className="auth-header-tag">Titan Workspace</span>
                  <h2 className="auth-title">
                    {mode === "signin" ? "Welcome back" : "Create your account"}
                  </h2>
                  <p className="auth-subtitle">
                    {mode === "signin"
                        ? "Sign in to access your ingested documents and reasoning engine."
                        : "Get started with citation-backed document intelligence."}
                  </p>
                </div>

                {/* Switcher Tabs */}
                <div className="auth-tabs">
                  <button
                      type="button"
                      className={`auth-tab ${mode === "signin" ? "active" : ""}`}
                      onClick={() => {
                        setMode("signin");
                        setError(null);
                        setSuccess(null);
                      }}
                  >
                    Sign In
                  </button>
                  <button
                      type="button"
                      className={`auth-tab ${mode === "signup" ? "active" : ""}`}
                      onClick={() => {
                        setMode("signup");
                        setError(null);
                        setSuccess(null);
                      }}
                  >
                    Sign Up
                  </button>
                </div>

                {/* Error / Success Banners */}
                {error && (
                    <div className="banner-msg error" style={{marginBottom: "16px"}}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      <span>{error.message} {error.code ? `(${error.code})` : ""}</span>
                    </div>
                )}

                {success && (
                    <div className="banner-msg success" style={{marginBottom: "16px"}}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      <span>{success}</span>
                    </div>
                )}

                {/* Auth Form */}
                <form className="auth-form" onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="auth-email">Email Address</label>
                    <input
                        id="auth-email"
                        type="email"
                        required
                        placeholder="name@company.com"
                        className="form-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="auth-password">Password</label>
                    <input
                        id="auth-password"
                        type="password"
                        required
                        placeholder="••••••••••••"
                        className="form-input"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    {mode === "signup" && (
                        <span className="form-hint">At least 12 characters required</span>
                    )}
                  </div>

                  {mode === "signup" && (
                      <div className="form-group">
                        <label className="form-label" htmlFor="auth-confirm-password">Confirm Password</label>
                        <input
                            id="auth-confirm-password"
                            type="password"
                            required
                            placeholder="••••••••••••"
                            className="form-input"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                      </div>
                  )}

                  <button type="submit" className="form-btn" disabled={loading}>
                    {loading ? (
                        <span>Processing...</span>
                    ) : mode === "signin" ? (
                        "Sign In to Titan"
                    ) : (
                        "Create Account"
                    )}
                  </button>
                </form>
              </div>
            </section>
          </main>
        </>
    );
  }                                      // closes LoginContent

  export default function LoginPage() {
    return (
        <Suspense fallback={null}>
          <LoginContent />
        </Suspense>
    );
  }