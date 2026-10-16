"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { PromptInput } from "@/components/prompt-input";

const SECTION_IDS = ["home", "about", "services", "contact"] as const;

const navLinks = [
    { id: "home", label: "Home", href: "/" },
    { id: "about", label: "About", href: "#about" },
    { id: "services", label: "Services", href: "#services" },
    { id: "contact", label: "Contact", href: "#contact" },
];

const values = [
    {
        title: "Clarity",
        text: "One definition per metric, one place to read it. No more debating whose number is right.",
    },
    {
        title: "Trust",
        text: "Every answer points back to the data behind it, so decisions rest on evidence.",
    },
    {
        title: "Speed",
        text: "Ask in plain language and get the signal in seconds instead of waiting on a report.",
    },
];

const services = [
    {
        num: "01",
        title: "Data unification",
        text: "Connect the tools and sources your team already uses and bring every metric into one consistent view.",
    },
    {
        num: "02",
        title: "Natural-language answers",
        text: "Ask questions the way you would ask a colleague and get a direct answer drawn from all your data.",
    },
    {
        num: "03",
        title: "Source-verified insights",
        text: "Each answer comes with its sources and a confidence score, so you can check it before you act on it.",
    },
    {
        num: "04",
        title: "Onboarding and support",
        text: "Hands-on setup and ongoing help, so your team gets value from day one and keeps getting it.",
    },
];

const delay = (ms: number) => ({ "--d": `${ms}ms` } as CSSProperties);

export default function HomePage() {
    const [scrolled, setScrolled] = useState(false);
    const [active, setActive] = useState<string>("home");
    const [sent, setSent] = useState(false);

    useEffect(() => {
        document.documentElement.classList.add("vx-js");

        // Header gets a frosted background once the page scrolls
        const onScroll = () => setScrolled(window.scrollY > 24);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });

        // Reveal-on-scroll
        const revealObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-visible");
                        revealObserver.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.12 }
        );
        document.querySelectorAll(".vx-reveal").forEach((el) => revealObserver.observe(el));

        // Highlight the nav item for the section in view
        const sectionObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) setActive(entry.target.id);
                });
            },
            { rootMargin: "-45% 0px -50% 0px" }
        );
        SECTION_IDS.forEach((id) => {
            const el = document.getElementById(id);
            if (el) sectionObserver.observe(el);
        });

        return () => {
            window.removeEventListener("scroll", onScroll);
            revealObserver.disconnect();
            sectionObserver.disconnect();
            document.documentElement.classList.remove("vx-js");
        };
    }, []);

    const handleContactSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        // UI-only for now: connect this to your backend or an email service
        setSent(true);
    };

    const navLinkStyle = (isActive: boolean): CSSProperties => ({
        position: "relative",
        fontSize: "16px",
        fontWeight: 430,
        letterSpacing: "-.36px",
        color: isActive ? "#ffffff" : "rgba(229,229,230,.77)",
        textShadow: "0 1px 3px rgba(0,0,0,.55)",
        textDecoration: "none",
        transition: "color .2s",
    });

    return (
        <div className="page-root">
            <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }

        html, body {
          width: 100%;
          overflow-x: hidden;
          background: #000000 !important;
          margin: 0;
          padding: 0;
          font-family: "Reference Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
          color: #ffffff;
          -webkit-font-smoothing: antialiased;
        }

        .page-root {
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
          background: #000;
          isolation: isolate;
        }

        /* ── Hero (full screen) ── */
        .screen-container {
          position: relative;
          width: 100%;
          height: 100vh;
          height: 100svh;
          min-height: 620px;
          overflow: hidden;
          isolation: isolate;
          background: #000;
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

        /* ── Fixed header ── */
        .vx-header {
          position: fixed;
          top: var(--header-top);
          left: var(--gutter-start);
          right: var(--gutter-end);
          height: 48px;
          display: flex;
          align-items: flex-start;
          white-space: nowrap;
          z-index: 60;
        }

        .vx-header-bg {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: calc(var(--header-top) + 48px + 14px);
          z-index: 55;
          background: rgba(0, 0, 0, .62);
          -webkit-backdrop-filter: blur(14px) saturate(1.2);
          backdrop-filter: blur(14px) saturate(1.2);
          border-bottom: 1px solid rgba(255, 255, 255, .07);
          opacity: 0;
          pointer-events: none;
          transition: opacity .3s ease;
        }

        .vx-header-bg.on {
          opacity: 1;
        }

        .vx-nav-link:hover {
          color: #ffffff !important;
        }

        /* ── Content sections ── */
        .vx-section {
          position: relative;
          padding: clamp(88px, 14vh, 160px) var(--gutter-end) clamp(88px, 14vh, 160px) var(--gutter-start);
          background: #000;
          border-top: 1px solid rgba(255, 255, 255, .07);
        }

        .vx-section.alt {
          background: #070707;
        }

        .vx-container {
          max-width: 1200px;
          margin: 0 auto;
        }

        .vx-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 22px;
          font-size: 13px;
          font-weight: 500;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, .55);
        }

        .vx-eyebrow::before {
          content: "";
          width: 28px;
          height: 1px;
          background: rgba(255, 255, 255, .4);
        }

        .vx-h2 {
          max-width: 760px;
          font-family: "Reference Display", "Reference Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
          font-weight: 500;
          font-size: clamp(34px, 4.6vw, 60px);
          line-height: 1.06;
          letter-spacing: -0.035em;
          color: #ffffff;
          margin: 0;
        }

        .vx-dim {
          color: rgba(211, 207, 207, .6);
        }

        .vx-lead {
          max-width: 520px;
          margin: 26px 0 0;
          font-size: 17px;
          line-height: 1.65;
          font-weight: 350;
          color: rgba(226, 229, 228, .72);
        }

        /* About */
        .vx-about-grid {
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          gap: clamp(40px, 7vw, 120px);
          align-items: start;
        }

        .vx-values {
          border-top: 1px solid rgba(255, 255, 255, .1);
        }

        .vx-value {
          display: grid;
          grid-template-columns: 120px 1fr;
          gap: 20px;
          padding: 28px 0;
          border-bottom: 1px solid rgba(255, 255, 255, .1);
        }

        .vx-value h3 {
          margin: 0;
          font-size: 17px;
          font-weight: 500;
          color: #fff;
        }

        .vx-value p {
          margin: 0;
          font-size: 15px;
          line-height: 1.65;
          font-weight: 350;
          color: rgba(226, 229, 228, .68);
        }

        /* Services */
        .vx-services-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 18px;
          margin-top: clamp(40px, 6vh, 64px);
        }

        .vx-card {
          position: relative;
          height: 100%;
          padding: 30px 30px 34px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, .09);
          background: linear-gradient(160deg, rgba(255, 255, 255, .05), rgba(255, 255, 255, .015));
          transition: border-color .3s ease, transform .3s ease, background .3s ease;
        }

        .vx-card:hover {
          border-color: rgba(255, 255, 255, .22);
          transform: translateY(-3px);
          background: linear-gradient(160deg, rgba(255, 255, 255, .07), rgba(255, 255, 255, .02));
        }

        .vx-card-num {
          font-size: 13px;
          font-weight: 500;
          letter-spacing: .1em;
          color: rgba(255, 255, 255, .4);
        }

        .vx-card h3 {
          margin: 46px 0 10px;
          font-size: 22px;
          font-weight: 500;
          letter-spacing: -0.02em;
          color: #fff;
        }

        .vx-card p {
          margin: 0;
          max-width: 440px;
          font-size: 15px;
          line-height: 1.65;
          font-weight: 350;
          color: rgba(226, 229, 228, .68);
        }

        /* Contact */
        .vx-contact-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: clamp(40px, 7vw, 120px);
          align-items: start;
        }

        .vx-contact-mail {
          display: inline-block;
          margin-top: 34px;
          padding-bottom: 4px;
          font-size: 20px;
          color: #fff;
          border-bottom: 1px solid rgba(255, 255, 255, .35);
          transition: border-color .2s;
        }

        .vx-contact-mail:hover {
          border-color: #fff;
        }

        .vx-form {
          padding: 30px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, .09);
          background: linear-gradient(160deg, rgba(255, 255, 255, .05), rgba(255, 255, 255, .015));
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .vx-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .vx-field label {
          font-size: 13px;
          font-weight: 450;
          color: rgba(255, 255, 255, .6);
        }

        .vx-input {
          width: 100%;
          padding: 13px 14px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, .12);
          background: rgba(255, 255, 255, .04);
          color: #fff;
          font: inherit;
          font-size: 15px;
          outline: none;
          transition: border-color .2s, background .2s, box-shadow .2s;
        }

        .vx-input::placeholder {
          color: rgba(255, 255, 255, .34);
        }

        .vx-input:focus {
          border-color: rgba(255, 255, 255, .45);
          background: rgba(255, 255, 255, .06);
          box-shadow: 0 0 0 3px rgba(255, 255, 255, .06);
        }

        textarea.vx-input {
          min-height: 130px;
          resize: vertical;
        }

        .vx-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 46px;
          padding: 0 22px;
          border: none;
          border-radius: 7px;
          background: #ffffff;
          color: #101010;
          font: inherit;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          box-shadow: 0 1px 5px rgba(0, 0, 0, .38);
          transition: transform .2s ease, opacity .2s;
        }

        .vx-btn:hover {
          transform: translateY(-1px);
          opacity: .92;
        }

        .vx-sent {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 22px 4px;
        }

        .vx-sent strong {
          font-size: 22px;
          font-weight: 500;
          letter-spacing: -0.02em;
        }

        .vx-sent span {
          font-size: 15px;
          line-height: 1.6;
          color: rgba(226, 229, 228, .7);
        }

        .vx-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          margin-top: clamp(64px, 10vh, 110px);
          padding-top: 28px;
          border-top: 1px solid rgba(255, 255, 255, .1);
          font-size: 13px;
          color: rgba(255, 255, 255, .45);
        }

        .vx-footer a {
          color: rgba(255, 255, 255, .7);
          transition: color .2s;
        }

        .vx-footer a:hover {
          color: #fff;
        }

        /* Reveal on scroll (only hidden once JS is running) */
        .vx-js .vx-reveal {
          opacity: 0;
          transform: translateY(18px);
          transition: opacity .7s cubic-bezier(.2, .7, .2, 1), transform .7s cubic-bezier(.2, .7, .2, 1);
          transition-delay: var(--d, 0ms);
        }

        .vx-js .vx-reveal.is-visible {
          opacity: 1;
          transform: none;
        }

        /* Responsive */
        @media (max-width: 1100px) {
          .vx-timezone {
            display: none !important;
          }
        }

        @media (max-width: 900px) {
          .vx-about-grid,
          .vx-contact-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .vx-services-grid {
            grid-template-columns: 1fr;
          }
          .vx-value {
            grid-template-columns: 1fr;
            gap: 8px;
          }
        }
      `}</style>

            {/* ── FIXED HEADER ── */}
            <div className={`vx-header-bg ${scrolled ? "on" : ""}`} />
            <header className="vx-header">
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
                        <clipPath id="brand-disc-tsx"><circle cx="12.5" cy="12.5" r="12.5" /></clipPath>
                        <g clipPath="url(#brand-disc-tsx)">
                            <rect width="25" height="25" fill="#ededed" />
                            <path d="M12.5 0 L25 12.5 L12.5 25 Z" fill="#050606" />
                            <path d="M0 12.5 L12.5 0 L12.5 12.5 Z" fill="#737778" />
                            <path d="M12.5 12.5 L25 12.5 L12.5 25 Z" fill="#fafafa" opacity="0.85" />
                            <path d="M0 12.5 L12.5 12.5 L6.25 25 Z" fill="#0a0b0b" />
                            <polygon points="12.5,4 18,12.5 12.5,21 7,12.5" fill="#ffffff" />
                            <polygon points="12.5,7 15.5,12.5 12.5,18 9.5,12.5" fill="#0a0b0b" />
                        </g>
                    </svg>
                </Link>

                <div style={{ display: "flex", alignItems: "flex-start", width: "100%" }}>
                    <nav
                        style={{
                            marginLeft: "clamp(36px, 3.03vw, 48px)",
                            gap: "clamp(28px, 2.9vw, 43px)",
                            position: "relative",
                            top: "7px",
                            display: "flex",
                        }}
                    >
                        {navLinks.map((link) => {
                            const isActive = active === link.id;
                            const underline = (
                                <span
                                    style={{
                                        position: "absolute",
                                        bottom: "-8px",
                                        left: 0,
                                        right: 0,
                                        height: "2px",
                                        background: "rgba(255,255,255,.82)",
                                        borderRadius: "1px",
                                        opacity: isActive ? 1 : 0,
                                        transform: isActive ? "scaleX(1)" : "scaleX(.4)",
                                        transformOrigin: "left center",
                                        transition: "opacity .25s, transform .25s",
                                    }}
                                />
                            );
                            return link.href.startsWith("#") ? (
                                <a key={link.id} href={link.href} className="vx-nav-link" style={navLinkStyle(isActive)}>
                                    {link.label}
                                    {underline}
                                </a>
                            ) : (
                                <Link key={link.id} href={link.href} className="vx-nav-link" style={navLinkStyle(isActive)}>
                                    {link.label}
                                    {underline}
                                </Link>
                            );
                        })}
                    </nav>

                    <div
                        className="vx-timezone"
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
                        href="/login"
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
                            flexShrink: 0,
                        }}
                    >
                        Sign In
                    </Link>
                </div>
            </header>

            <main>
                {/* ════════════ HERO ════════════ */}
                <section id="home" className="screen-container">
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

                    {/* ── CENTER ALIGNED CHATBOX ── */}
                    <div
                        style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            top: "calc(50% - 24px)",
                            zIndex: 20,
                            display: "flex",
                            justifyContent: "center",
                            padding: "0 16px",
                            pointerEvents: "none", // empty space around the box stays click-through
                        }}
                    >
                        <div style={{ width: "100%", maxWidth: 480, pointerEvents: "auto" }}>
                            <PromptInput
                                placeholder="Ask anything"
                                onSubmit={(query, meta) => {
                                    // UI-only for now: model and effort selectors are visual
                                    alert(`Prompt submitted: "${query}" with model ${meta.model} (${meta.effort})`);
                                }}
                            />
                        </div>
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

                {/* ════════════ ABOUT ════════════ */}
                <section id="about" className="vx-section">
                    <div className="vx-container">
                        <div className="vx-about-grid">
                            <div className="vx-reveal">
                                <span className="vx-eyebrow">About</span>
                                <h2 className="vx-h2">
                                    One clear signal, <span className="vx-dim">not a dozen dashboards.</span>
                                </h2>
                                <p className="vx-lead">
                                    Vantage connects the tools your team already uses and turns scattered metrics into a single,
                                    trustworthy view. Less tab-hopping, fewer arguments about whose number is right, and more time
                                    spent acting on what the data says.
                                </p>
                            </div>

                            <div className="vx-values">
                                {values.map((v, i) => (
                                    <div key={v.title} className="vx-value vx-reveal" style={delay(i * 90)}>
                                        <h3>{v.title}</h3>
                                        <p>{v.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ════════════ SERVICES ════════════ */}
                <section id="services" className="vx-section alt">
                    <div className="vx-container">
                        <div className="vx-reveal">
                            <span className="vx-eyebrow">Services</span>
                            <h2 className="vx-h2">
                                Everything you need to <span className="vx-dim">trust your numbers.</span>
                            </h2>
                        </div>

                        <div className="vx-services-grid">
                            {services.map((s, i) => (
                                <div key={s.num} className="vx-reveal" style={delay((i % 2) * 90)}>
                                    <article className="vx-card">
                                        <span className="vx-card-num">{s.num}</span>
                                        <h3>{s.title}</h3>
                                        <p>{s.text}</p>
                                    </article>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ════════════ CONTACT ════════════ */}
                <section id="contact" className="vx-section">
                    <div className="vx-container">
                        <div className="vx-contact-grid">
                            <div className="vx-reveal">
                                <span className="vx-eyebrow">Contact</span>
                                <h2 className="vx-h2">
                                    Let&apos;s make your data <span className="vx-dim">speak clearly.</span>
                                </h2>
                                <p className="vx-lead">
                                    Tell us about your setup and what you would like to see. We will get back to you with next steps.
                                </p>
                                <a className="vx-contact-mail" href="mailto:hello@example.com">
                                    hello@example.com
                                </a>
                            </div>

                            <div className="vx-reveal" style={delay(100)}>
                                {sent ? (
                                    <div className="vx-form">
                                        <div className="vx-sent" role="status">
                                            <strong>Thanks, message received.</strong>
                                            <span>We will be in touch soon.</span>
                                        </div>
                                    </div>
                                ) : (
                                    <form className="vx-form" onSubmit={handleContactSubmit}>
                                        <div className="vx-field">
                                            <label htmlFor="contact-name">Name</label>
                                            <input id="contact-name" name="name" className="vx-input" type="text" placeholder="Your name" required />
                                        </div>
                                        <div className="vx-field">
                                            <label htmlFor="contact-email">Email</label>
                                            <input id="contact-email" name="email" className="vx-input" type="email" placeholder="you@company.com" required />
                                        </div>
                                        <div className="vx-field">
                                            <label htmlFor="contact-message">Message</label>
                                            <textarea id="contact-message" name="message" className="vx-input" placeholder="What are you trying to solve?" required />
                                        </div>
                                        <button type="submit" className="vx-btn">
                                            Send message
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <line x1="5" y1="12" x2="19" y2="12" />
                                                <polyline points="12 5 19 12 12 19" />
                                            </svg>
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>

                        <footer className="vx-footer">
                            <span>© {new Date().getFullYear()} Vantage. All rights reserved.</span>
                            <a href="#home">Back to top ↑</a>
                        </footer>
                    </div>
                </section>
            </main>
        </div>
    );
}