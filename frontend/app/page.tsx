"use client";

import Link from "next/link";
import { PromptInput } from "@/components/prompt-input";

export default function HomePage() {
  return (
    <>
      <style jsx global>{`
        html, body {
          width: 100%;
          height: 100%;
          overflow: hidden !important;
          background: #000000 !important;
          margin: 0;
          padding: 0;
          font-family: "Reference Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
          color: #ffffff;
          -webkit-font-smoothing: antialiased;
        }

        .screen-container {
          --gutter-start: clamp(36px, 4.177vw, 96px);
          --gutter-end: clamp(36px, 4.04vw, 96px);
          --header-top: clamp(20px, 2.264vh, 30px);
          --hero-bottom: clamp(34px, 5.19vh, 64px);
          --display-size: clamp(58px, 7.64vh, 88px);
          --display-leading: clamp(72px, 9.34vh, 106px);
          --copy-size: clamp(14px, 1.70vh, 19px);
          --copy-leading: clamp(19px, 2.17vh, 24px);
          --title-copy-gap: clamp(15px, 2.08vh, 24px);
          --copy-cta-gap: clamp(24px, 3.11vh, 36px);
          --cta-width: clamp(142px, 15.09vh, 168px);
          --cta-height: clamp(38px, 3.96vh, 44px);
          --primary-control-font-size: clamp(17px, 1.77vh, 19.25px);
          --control-baseline-shift: clamp(1px, .19vh, 2px);
          --card-width: clamp(150px, 18.96vh, 215px);
        }

        /* Dark theme tokens for the chatbox (used by Tailwind: bg-card, border-border, ...) */
        .vantage-prompt {
          --background: 0 0% 0%;
          --foreground: 0 0% 98%;
          --card: 0 0% 8%;
          --muted: 0 0% 12%;
          --muted-foreground: 0 0% 65%;
          --accent: 0 0% 18%;
          --border: 0 0% 22%;
          --ring: 0 0% 70%;
          --primary: 0 0% 100%;
          --primary-foreground: 0 0% 7%;
        }

        .vignette-overlay {
          background:
            linear-gradient(180deg, rgba(0,0,0,.03), transparent 24%, transparent 82%, rgba(0,0,0,.05)),
            radial-gradient(ellipse at 44% 54%, transparent 30%, rgba(0,0,0,.055) 100%);
        }

        .hero-title-font {
          font-family: "Reference Display", "Reference Sans", Arial, sans-serif;
          font-weight: 500;
          font-optical-sizing: auto;
          letter-spacing: -2.1px;
          -webkit-text-stroke: .12px currentColor;
          white-space: nowrap;
          text-shadow: 0 2px 2px rgba(0,0,0,.44);
        }

        .line-one-transform {
          transform: scaleX(.775);
          transform-origin: left center;
          color: #ffffff;
        }

        .line-two-transform {
          transform: scaleX(.793);
          transform-origin: left center;
          color: rgba(211, 207, 207, .78);
        }
      `}</style>

      <main style={{ position: "fixed", inset: 0, isolation: "isolate", background: "#000", overflow: "hidden" }}>
        <section
          id="screen"
          className="screen-container"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "100%",
            height: "100%",
            background: "#000",
            overflow: "hidden",
          }}
        >
          {/* Background Video */}
          <video
            autoPlay
            muted
            loop
            playsInline
            disablePictureInPicture
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              zIndex: -3,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            <source
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260808_064556_051587f1-74a1-4336-8c05-4dde3594ed05.mp4"
              type="video/mp4"
            />
          </video>

          {/* Screen Vignette Overlay */}
          <div
            className="vignette-overlay"
            style={{
              position: "absolute",
              inset: 0,
              zIndex: -2,
              pointerEvents: "none",
            }}
          />

          {/* Header Top Bar */}
          <header
            style={{
              position: "absolute",
              top: "var(--header-top)",
              left: "var(--gutter-start)",
              right: "var(--gutter-end)",
              height: "48px",
              display: "flex",
              alignItems: "flex-start",
              whiteSpace: "nowrap",
              zIndex: 10,
            }}
          >
            <Link
              href="/"
              aria-label="Vantage home"
              style={{
                position: "relative",
                top: "10px",
                display: "inline-block",
                width: "25px",
                height: "25px",
                filter: "drop-shadow(0 1px 2px rgba(0,0,0,.3))",
                textDecoration: "none",
                flexShrink: 0,
              }}
            >
              <svg viewBox="0 0 25 25" fill="none" style={{ width: 25, height: 25, display: "block" }}>
                <clipPath id="brand-disc-tsx"><circle cx="12.5" cy="12.5" r="12.5"/></clipPath>
                <g clipPath="url(#brand-disc-tsx)">
                  <rect width="25" height="25" fill="#ededed"/>
                  <path d="M12.5 0 L25 12.5 L12.5 25 Z" fill="#050606"/>
                  <path d="M0 12.5 L12.5 0 L12.5 12.5 Z" fill="#737778"/>
                  <path d="M12.5 12.5 L25 12.5 L12.5 25 Z" fill="#fafafa" opacity="0.85"/>
                  <path d="M0 12.5 L12.5 12.5 L6.25 25 Z" fill="#0a0b0b"/>
                  <polygon points="12.5,4 18,12.5 12.5,21 7,12.5" fill="#ffffff"/>
                  <polygon points="12.5,7 15.5,12.5 12.5,18 9.5,12.5" fill="#0a0b0b"/>
                </g>
              </svg>
            </Link>

            <div style={{ display: "flex", alignItems: "flex-start", width: "100%" }}>
              <nav
                style={{
                  marginLeft: "clamp(36px, 3.03vw, 48px)",
                  gap: "clamp(32px, 2.9vw, 43px)",
                  position: "relative",
                  top: "9px",
                  display: "flex",
                }}
              >
                <Link
                  href="/"
                  style={{
                    position: "relative",
                    top: "-3px",
                    fontSize: "16px",
                    fontWeight: 430,
                    letterSpacing: "-.36px",
                    color: "#ffffff",
                    textShadow: "0 1px 3px rgba(0,0,0,.55)",
                    textDecoration: "none",
                  }}
                >
                  Home
                  <span
                    style={{
                      position: "absolute",
                      bottom: "-8px",
                      left: 0,
                      width: "44px",
                      height: "2px",
                      background: "rgba(255,255,255,.82)",
                      borderRadius: "1px",
                    }}
                  />
                </Link>
                <a
                  href="#about"
                  style={{
                    fontSize: "16px",
                    fontWeight: 430,
                    letterSpacing: "-.36px",
                    color: "rgba(229,229,230,.77)",
                    textShadow: "0 1px 3px rgba(0,0,0,.55)",
                    textDecoration: "none",
                  }}
                >
                  About
                </a>
                <a
                  href="#services"
                  style={{
                    fontSize: "16px",
                    fontWeight: 430,
                    letterSpacing: "-.36px",
                    color: "rgba(229,229,230,.77)",
                    textShadow: "0 1px 3px rgba(0,0,0,.55)",
                    textDecoration: "none",
                  }}
                >
                  Services
                </a>
                <a
                  href="#contact"
                  style={{
                    marginLeft: "1px",
                    fontSize: "16px",
                    fontWeight: 430,
                    letterSpacing: "-.36px",
                    color: "rgba(229,229,230,.77)",
                    textShadow: "0 1px 3px rgba(0,0,0,.55)",
                    textDecoration: "none",
                  }}
                >
                  Contact
                </a>
              </nav>

              <div
                style={{
                  marginLeft: "auto",
                  width: "211px",
                  height: "48px",
                  paddingLeft: "8px",
                  borderLeft: "2px solid rgba(230,230,230,.52)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  userSelect: "none",
                }}
              >
                <span style={{ fontSize: "15px", fontWeight: 420, color: "rgba(240,240,240,.77)", lineHeight: 1.2 }}>
                  Timezone
                </span>
                <span style={{ fontSize: "15px", fontWeight: 440, color: "rgba(255,255,255,.93)", lineHeight: 1.2, whiteSpace: "nowrap" }}>
                  9:47 PM&nbsp; • &nbsp;14 July 2026
                </span>
              </div>

              <Link
                href="/app"
                style={{
                  width: "109px",
                  height: "42px",
                  borderRadius: "7px",
                  background: "#ffffff",
                  color: "#101010",
                  fontWeight: 460,
                  letterSpacing: "-.34px",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "16px",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,.72), 0 1px 5px rgba(0,0,0,.34)",
                  marginLeft: "clamp(20px, 1.95vw, 29px)",
                  textDecoration: "none",
                }}
              >
                Sign In
              </Link>
            </div>
          </header>

          {/* ── CENTER ALIGNED CHATBOX ──
              The wrapper is anchored by its top edge (not centered on both axes) so the
              collapsed pill sits in the middle of the screen and expands downward
              instead of jumping around while you type. */}
          <div
            className="dark vantage-prompt"
            style={{
              position: "absolute",
              left: "50%",
              top: "calc(50% - 24px)",
              transform: "translateX(-50%)",
              zIndex: 20,
              width: "min(480px, calc(100% - 32px))",
            }}
          >
            <PromptInput
              className="mx-auto"
              placeholder="Ask anything"
              onSubmit={(query, meta) => {
                // UI-only for now: model and effort selectors are visual
                alert(`Prompt submitted: "${query}" with model ${meta.model} (${meta.effort})`);
              }}
            />
          </div>

          {/* ── HERO CONTENT (Bottom-Left) ── */}
          <section
            style={{
              position: "absolute",
              left: "var(--gutter-start)",
              bottom: "var(--hero-bottom)",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              zIndex: 5,
              userSelect: "none",
            }}
          >
            <h1
              className="hero-title-font"
              style={{
                fontSize: "var(--display-size)",
                lineHeight: "var(--display-leading)",
                margin: 0,
                marginBottom: "var(--title-copy-gap)",
              }}
            >
              <span style={{ display: "block", overflow: "hidden" }}>
                <span className="line-one-transform" style={{ display: "block" }}>
                  Stop Digging
                </span>
              </span>
              <span style={{ display: "block", overflow: "hidden" }}>
                <span className="line-two-transform" style={{ display: "block" }}>
                  Through Dashboards.
                </span>
              </span>
            </h1>

            <p
              style={{
                fontSize: "var(--copy-size)",
                lineHeight: "var(--copy-leading)",
                position: "relative",
                left: "1px",
                width: "clamp(390px, 31.67vw, 500px)",
                color: "rgba(226, 229, 228, .84)",
                fontWeight: 350,
                letterSpacing: ".13px",
                textShadow: "0 1px 3px rgba(0,0,0,.7)",
                margin: "0 0 var(--copy-cta-gap) 0",
              }}
            >
              Your metrics are scattered across a dozen dashboards.<br />
              Vantage bring them into one clear signal, so every<br />
              decision is backed by data you actually trust.
            </p>

            <Link
              href="/app"
              style={{
                position: "relative",
                width: "var(--cta-width)",
                height: "var(--cta-height)",
                borderRadius: "7px",
                background: "#ffffff",
                color: "#111111",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 1px 5px rgba(0,0,0,.38)",
                fontSize: "var(--primary-control-font-size)",
                fontFamily: "inherit",
                overflow: "hidden",
                display: "inline-block",
                textDecoration: "none",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: "8.125%",
                  top: "50%",
                  transform: "translateY(calc(-50% + var(--control-baseline-shift)))",
                  fontWeight: 450,
                  letterSpacing: "-.3px",
                  whiteSpace: "nowrap",
                }}
              >
                Get Started
              </span>
              <div
                style={{
                  position: "absolute",
                  right: "3.125%",
                  top: "14.286%",
                  width: "20.625%",
                  height: "71.429%",
                  borderRadius: "7px",
                  background: "#070909",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </div>
            </Link>
          </section>

          {/* ── GLASS DEMO CARD (Bottom-Right) ── */}
          <article
            style={{
              position: "absolute",
              right: "var(--gutter-end)",
              bottom: "var(--hero-bottom)",
              width: "var(--card-width)",
              aspectRatio: "201 / 265",
              containerType: "inline-size",
              border: "1px solid rgba(255,255,255,.13)",
              borderRadius: "clamp(12px, 1.52vh, 18px)",
              background: "linear-gradient(145deg, rgba(24,22,20,.80), rgba(5,12,14,.86))",
              boxShadow: "0 2px 10px rgba(0,0,0,.44), 0 0 0 3px rgba(255,255,255,.035) inset, 0 0 0 1px rgba(0,0,0,.9)",
              backdropFilter: "blur(14px) saturate(108%)",
              WebkitBackdropFilter: "blur(14px) saturate(108%)",
              zIndex: 5,
              boxSizing: "border-box",
              overflow: "hidden",
              userSelect: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "3.5cqw",
                top: "4cqw",
                width: "92.5cqw",
                height: "92cqw",
                borderRadius: "4cqw",
                background: "#101a1e",
                overflow: "hidden",
              }}
            >
              <img
                src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23ec4899'/%3E%3Cstop offset='60%25' stop-color='%236366f1'/%3E%3Cstop offset='100%25' stop-color='%2306b6d4'/%3E%3C/linearGradient%3E%3Cfilter id='blur'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.015' numOctaves='3' result='noise'/%3E%3CfeDisplacementMap in='SourceGraphic' in2='noise' scale='45' xChannelSelector='R' yChannelSelector='G'/%3E%3C/filter%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='%23090d12'/%3E%3Ccircle cx='180' cy='190' r='140' fill='url(%23g)' filter='url(%23blur)' opacity='0.9'/%3E%3C/svg%3E"
                alt="Abstract red and blue smoke"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  filter: "brightness(.89) saturate(.93) contrast(1.03)",
                  display: "block",
                }}
              />
              <button
                type="button"
                aria-label="Play demo"
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "29cqw",
                  height: "29cqw",
                  borderRadius: "50%",
                  border: "1px solid rgba(255,255,255,.34)",
                  background: "rgba(3,5,7,.47)",
                  backdropFilter: "blur(4px)",
                  WebkitBackdropFilter: "blur(4px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  padding: 0,
                  color: "#ffffff",
                }}
              >
                <svg width="40%" height="40%" viewBox="0 0 24 24" fill="#ffffff" style={{ marginLeft: "2px" }}>
                  <polygon points="6 4 20 12 6 20 6 4"></polygon>
                </svg>
              </button>
            </div>

            <button
              type="button"
              style={{
                position: "absolute",
                left: "3.5cqw",
                bottom: "4cqw",
                width: "92.5cqw",
                height: "18.5cqw",
                borderRadius: "4cqw",
                background: "linear-gradient(145deg, rgba(26,34,36,.86), rgba(16,29,33,.9))",
                border: "1px solid rgba(255,255,255,.21)",
                color: "#ffffff",
                fontWeight: 430,
                fontSize: "clamp(11px, 7.5cqw, 15px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              Watch Demo
            </button>
          </article>
        </section>
      </main>
    </>
  );
}