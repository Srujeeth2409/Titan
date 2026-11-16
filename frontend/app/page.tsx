"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";

export default function HaldenLandingPage() {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Helpers
    const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
    const smoothstep = (x: number) => {
      const c = clamp(x);
      return c * c * (3 - 2 * c);
    };

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    function hexToRgb(hex: string): [number, number, number] {
      const h = hex.replace("#", "");
      if (h.length === 3) {
        return [
          parseInt(h[0] + h[0], 16),
          parseInt(h[1] + h[1], 16),
          parseInt(h[2] + h[2], 16),
        ];
      }
      return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
      ];
    }

    function lerpColor(c1: string, c2: string, t: number): string {
      const [r1, g1, b1] = hexToRgb(c1);
      const [r2, g2, b2] = hexToRgb(c2);
      const r = Math.round(lerp(r1, r2, t));
      const g = Math.round(lerp(g1, g2, t));
      const b = Math.round(lerp(b1, b2, t));
      return `rgb(${r},${g},${b})`;
    }

    // ── 1. Split Text into character spans ──
    function splitLetters(el: HTMLElement) {
      const nodes = Array.from(el.childNodes);
      el.innerHTML = "";
      const chars: HTMLElement[] = [];

      nodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || "";
          const words = text.split(/(\s+)/);
          words.forEach((w) => {
            if (/^\s+$/.test(w)) {
              el.appendChild(document.createTextNode(w));
            } else if (w.length > 0) {
              const wordSpan = document.createElement("span");
              wordSpan.style.display = "inline-block";
              wordSpan.style.whiteSpace = "nowrap";
              for (const ch of w) {
                const charSpan = document.createElement("span");
                charSpan.className = "ch";
                charSpan.textContent = ch;
                wordSpan.appendChild(charSpan);
                chars.push(charSpan);
              }
              el.appendChild(wordSpan);
            }
          });
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const elem = node as HTMLElement;
          if (elem.tagName.toLowerCase() === "br") {
            el.appendChild(document.createElement("br"));
            // ensure a space follows so words don't join when br is hidden on mobile
            el.appendChild(document.createTextNode(" "));
          } else {
            const isHl = elem.classList.contains("hl");
            const text = elem.textContent || "";
            const words = text.split(/(\s+)/);
            words.forEach((w) => {
              if (/^\s+$/.test(w)) {
                el.appendChild(document.createTextNode(w));
              } else if (w.length > 0) {
                const wordSpan = document.createElement("span");
                wordSpan.style.display = "inline-block";
                wordSpan.style.whiteSpace = "nowrap";
                for (const ch of w) {
                  const charSpan = document.createElement("span");
                  charSpan.className = "ch";
                  if (isHl) charSpan.setAttribute("data-hl", "1");
                  charSpan.textContent = ch;
                  wordSpan.appendChild(charSpan);
                  chars.push(charSpan);
                }
                el.appendChild(wordSpan);
              }
            });
          }
        }
      });
      return chars;
    }

    function paint(
      chars: HTMLElement[],
      p: number,
      spread: number,
      finalCol: string,
      accentCol: string,
      ghostCol: string,
      highlightCol?: string
    ) {
      const n = chars.length;
      for (let i = 0; i < n; i++) {
        const el = chars[i];
        const isHl = el.getAttribute("data-hl") === "1";
        const actualFinal = isHl && highlightCol ? highlightCol : finalCol;
        const t = clamp((p * (1 + spread) - i / n) / spread);

        let opacity = 0;
        let col = ghostCol;
        let blur = 8;

        if (t <= 0) {
          opacity = 0;
          col = ghostCol;
          blur = 8;
        } else if (t <= 0.35) {
          const f = t / 0.35;
          opacity = f;
          col = ghostCol;
          blur = 8 - 6.5 * f; // 8px -> 1.5px
        } else if (t <= 0.7) {
          const f = (t - 0.35) / 0.35;
          opacity = 1;
          col = lerpColor(ghostCol, accentCol, f);
          blur = 1.5 * (1 - f); // 1.5px -> 0px
        } else {
          const f = (t - 0.7) / 0.3;
          opacity = 1;
          col = lerpColor(accentCol, actualFinal, f);
          blur = 0;
        }

        el.style.opacity = opacity.toFixed(3);
        el.style.color = col;
        el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "none";
      }
    }

    // Select elements
    const h1 = document.getElementById("h1");
    const stmt = document.getElementById("stmt");
    const h2 = document.getElementById("h2");
    const nav = document.getElementById("nav");
    const row = document.getElementById("row");
    const ship = document.getElementById("ship") as HTMLImageElement | null;
    const split = document.getElementById("split");

    const h1Chars = h1 ? splitLetters(h1) : [];
    const stmtChars = stmt ? splitLetters(stmt) : [];
    const h2Chars = h2 ? splitLetters(h2) : [];

    // Initial paint at p = 0
    paint(h1Chars, 0, 0.35, "#0b1d3a", "#3f7cff", "#ffffff", "#5b7cf0");
    paint(stmtChars, 0, 0.16, "#0b1d3a", "#3f7cff", "#ffffff");
    paint(h2Chars, 0, 0.35, "#ffffff", "#8fe6f4", "#5c6f92");

    // ── 2. Canvas Bowl Glow Algorithm ──
    const canvas = document.getElementById("bg") as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const context: CanvasRenderingContext2D = ctx;

    const W = 96;
    const H = 60;
    const imgData = ctx.createImageData(W, H);
    const data32 = new Uint32Array(imgData.data.buffer);

    // Color definitions in ABGR for Uint32 Little-Endian
    const C_WHITE = 0xffffffff;
    const RIM_R = 210, RIM_G = 218, RIM_B = 255; // #d2daff
    const CORE_R = 143, CORE_G = 213, CORE_B = 241; // #8fd5f1

    // Scroll table
    const scrollKeys = [
      { q: 0.0, tip: 0.3, half: 0.34, soft: 0.22 },
      { q: 0.03, tip: 0.45, half: 0.38, soft: 0.26 },
      { q: 0.08, tip: 0.65, half: 0.38, soft: 0.22 },
      { q: 0.18, tip: 0.8, half: 0.38, soft: 0.22 },
      { q: 0.4, tip: 0.95, half: 0.38, soft: 0.19 },
      { q: 0.66, tip: 1.05, half: 0.46, soft: 0.16 },
      { q: 0.87, tip: 1.05, half: 0.66, soft: 0.13 },
      { q: 1.15, tip: 1.1, half: 0.9, soft: 0.1 },
      { q: 1.43, tip: 1.3, half: 1.6, soft: 0.1 },
      { q: 1.8, tip: 2.4, half: 3.0, soft: 0.1 },
    ];

    function getScrollTargets(q: number) {
      if (q <= scrollKeys[0].q) return { ...scrollKeys[0] };
      const last = scrollKeys[scrollKeys.length - 1];
      if (q >= last.q) return { ...last };
      for (let i = 0; i < scrollKeys.length - 1; i++) {
        const k1 = scrollKeys[i];
        const k2 = scrollKeys[i + 1];
        if (q >= k1.q && q <= k2.q) {
          const f = (q - k1.q) / (k2.q - k1.q);
          return {
            tip: lerp(k1.tip, k2.tip, f),
            half: lerp(k1.half, k2.half, f),
            soft: lerp(k1.soft, k2.soft, f),
          };
        }
      }
      return { ...last };
    }

    // Simulation state
    let curTip = -0.3;
    let curHalf = 0.3;
    let curSoft = 0.1;
    let inIntro = true;
    let introStartTime = 0;

    // Segment distance helper
    function segDistSq(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const l2 = dx * dx + dy * dy;
      if (l2 === 0) {
        const dpx = px - x1, dpy = py - y1;
        return dpx * dpx + dpy * dpy;
      }
      let t = ((px - x1) * dx + (py - y1) * dy) / l2;
      t = clamp(t);
      const qx = x1 + t * dx;
      const qy = y1 + t * dy;
      const ex = px - qx, ey = py - qy;
      return ex * ex + ey * ey;
    }

    // Polyline points cache
    const N_POINTS = 48;
    const polyX = new Float32Array(N_POINTS);
    const polyY = new Float32Array(N_POINTS);

    let rafId = 0;
    let startTime = 0;

    function render(timestamp: number) {
      if (!startTime) startTime = timestamp;
      const t = timestamp - startTime;

      // Intro logic: starts at tip -0.3, half 0.3, soft 0.1. After 0.25s, eases over 1.05s to q=0 values.
      if (inIntro) {
        if (!introStartTime) introStartTime = timestamp;
        const elapsed = (timestamp - introStartTime) / 1000;
        if (elapsed < 0.25) {
          curTip = -0.3;
          curHalf = 0.3;
          curSoft = 0.1;
        } else if (elapsed < 1.3) {
          const prog = smoothstep((elapsed - 0.25) / 1.05);
          const t0 = scrollKeys[0];
          curTip = lerp(-0.3, t0.tip, prog);
          curHalf = lerp(0.3, t0.half, prog);
          curSoft = lerp(0.1, t0.soft, prog);
        } else {
          inIntro = false;
        }
      }

      // Read scroll
      const innerH = window.innerHeight || 1;
      const innerW = window.innerWidth || 1;
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const q = scrollY / innerH;

      let tgtTip = curTip;
      let tgtHalf = curHalf;
      let tgtSoft = curSoft;

      if (!inIntro) {
        const tgt = getScrollTargets(q);
        tgtTip = tgt.tip;
        tgtHalf = tgt.half;
        tgtSoft = tgt.soft;

        // Inertia
        curTip += (tgtTip - curTip) * 0.12;
        curHalf += (tgtHalf - curHalf) * 0.12;
        curSoft += (tgtSoft - curSoft) * 0.12;
      }

      // Idle breathing wobble
      const effTip = curTip + Math.sin(t * 0.00033 + 1.3) * 0.02;
      const effHalf = curHalf + Math.sin(t * 0.0005) * 0.015;
      const effSoft = Math.max(0.01, curSoft);

      const aspect = innerW / innerH;

      // Build 48 polyline points: yy from -0.3 to effTip
      for (let i = 0; i < N_POINTS; i++) {
        const yy = -0.3 + (i / (N_POINTS - 1)) * (effTip - -0.3);
        const norm = Math.max(0, 1 - yy / effTip);
        polyX[i] = effHalf * aspect * Math.pow(norm, 0.72);
        polyY[i] = yy;
      }

      const RND = 0.25;

      // Draw 96x60 buffer
      let idx = 0;
      for (let y = 0; y < H; y++) {
        const py = y / H;
        for (let x = 0; x < W; x++) {
          const px = Math.abs(x / W - 0.5) * aspect;

          // Inside check
          const normY = py < effTip ? Math.max(0, 1 - py / effTip) : 0;
          const curveX = effHalf * aspect * Math.pow(normY, 0.72);
          const isInside = py < effTip && px < curveX;

          // Distance to polyline segments
          let minD2 = 1e9;
          for (let s = 0; s < N_POINTS - 1; s++) {
            const d2 = segDistSq(px, py, polyX[s], polyY[s], polyX[s + 1], polyY[s + 1]);
            if (d2 < minD2) minD2 = d2;
          }
          const minD = Math.sqrt(minD2);
          const rawSd = isInside ? -minD : minD;
          const sd = rawSd - RND;

          const g = 1 - smoothstep((sd + effSoft) / (2 * effSoft));

          if (g <= 0.001) {
            data32[idx++] = C_WHITE;
          } else if (g < 0.38) {
            const tc = smoothstep(g / 0.38);
            const r = Math.round(lerp(255, RIM_R, tc));
            const gr = Math.round(lerp(255, RIM_G, tc));
            const b = Math.round(lerp(255, RIM_B, tc));
            data32[idx++] = (0xff << 24) | (b << 16) | (gr << 8) | r;
          } else {
            const tc = smoothstep((g - 0.38) / 0.62);
            const r = Math.round(lerp(RIM_R, CORE_R, tc));
            const gr = Math.round(lerp(RIM_G, CORE_G, tc));
            const b = Math.round(lerp(RIM_B, CORE_B, tc));
            data32[idx++] = (0xff << 24) | (b << 16) | (gr << 8) | r;
          }
        }
      }

      context.putImageData(imgData, 0, 0);

      // Hero headline time-based letter reveal over 1.25s
      const heroElapsed = t / 1000;
      const heroP = clamp(heroElapsed / 1.25);
      paint(h1Chars, heroP, 0.35, "#0b1d3a", "#3f7cff", "#ffffff", "#5b7cf0");

      rafId = requestAnimationFrame(render);
    }

    rafId = requestAnimationFrame(render);

    // ── 3. Scroll Interactions ──
    function onScroll() {
      const innerH = window.innerHeight || 1;
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const q = scrollY / innerH;

      // Statement rise & reveal
      if (stmt) {
        const s = clamp((q - 0.69) / 0.74);
        const transY = 0.205 * Math.pow(1 - s, 2) * innerH;
        stmt.style.transform = `translateY(${transY.toFixed(2)}px)`;

        const p = clamp((q - 0.56) / 2.03);
        paint(stmtChars, p, 0.16, "#0b1d3a", "#3f7cff", "#ffffff");

        // Nav CTA pill pop
        if (nav) {
          if (p > 0.4) {
            nav.classList.add("on");
          } else {
            nav.classList.remove("on");
          }
        }
      }

      // Dark Split: headline & row & ship zoom
      if (split) {
        const splitRect = split.getBoundingClientRect();
        const splitTop = splitRect.top;
        const p2 = clamp((0.8 - splitTop / innerH) / 0.65);
        paint(h2Chars, p2, 0.35, "#ffffff", "#8fe6f4", "#5c6f92");

        if (row) {
          if (p2 > 0.92) {
            row.classList.add("visible");
          } else {
            row.classList.remove("visible");
          }
        }

        if (ship) {
          const scale = 1.08 - 0.08 * clamp(1 - splitTop / innerH);
          ship.style.transform = `scale(${scale.toFixed(4)})`;
        }
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();

    // Trigger ready after 1st frame for CSS fade-ups
    const readyTimer = setTimeout(() => {
      document.body.classList.add("ready");
    }, 50);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      clearTimeout(readyTimer);
      document.body.classList.remove("ready");
    };
  }, []);

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&display=swap"
      />

      <style
        dangerouslySetInnerHTML={{
          __html: `
        :root {
          --ink: #0b1d3a;
          --ink-2: #1d2f4f;
          --accent: #5b7cf0;
          --dot: #2fe0d0;
          --panel: #0e1f3d;
          --panel-line: rgba(255,255,255,.12);
          --gut: clamp(20px, 5.7vw, 82px);
          --ease: cubic-bezier(.22, .7, .2, 1);
        }

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        html, body {
          background: #ffffff;
          overflow-x: hidden;
          font-family: 'Inter Tight', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        a {
          color: inherit;
          text-decoration: none;
        }

        /* ── Fixed Atmosphere Background ── */
        .atmo {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background: #ffffff;
        }
        #bg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: block;
        }

        main {
          position: relative;
          z-index: 1;
        }

        /* ── Floating Pill Navbar ── */
        @keyframes navin {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .nav {
          position: fixed;
          z-index: 50;
          top: 20px;
          left: var(--gut);
          right: var(--gut);
          height: 60px;
          border-radius: 999px;
          background: #ffffff;
          display: flex;
          align-items: center;
          padding: 0 10px 0 22px;
          box-shadow: 0 1px 0 rgba(11,29,58,.04), 0 10px 30px -18px rgba(11,29,58,.25);
          opacity: 0;
          transform: translateY(-8px);
          animation: navin .9s var(--ease) .15s forwards;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 9px;
          text-decoration: none;
        }
        .brand-name {
          font-size: 17px;
          font-weight: 500;
          letter-spacing: -0.02em;
          color: var(--ink);
        }

        .nav-links {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 31px;
        }
        .nav-link {
          font-size: 14px;
          font-weight: 500;
          letter-spacing: -0.005em;
          color: var(--ink);
          opacity: 0.92;
          transition: opacity 0.2s;
        }
        .nav-link:hover {
          opacity: 0.55;
        }

        .nav-right {
          margin-left: auto;
          display: flex;
          align-items: center;
        }
        .nav-login {
          font-size: 14px;
          font-weight: 500;
          color: var(--ink);
          padding: 0 14px;
          transition: padding .35s var(--ease);
        }
        .nav.on .nav-login {
          padding: 0 0 0 14px;
        }

        .navcta {
          width: 42px;
          height: 42px;
          overflow: hidden;
          border-radius: 999px;
          margin-left: -42px;
          transform: scale(0);
          transform-origin: 100% 50%;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          transition: transform .35s var(--ease), width .65s var(--ease) .22s, margin .35s var(--ease);
        }
        .navcta .btn {
          width: 142px;
          flex-shrink: 0;
        }
        .navcta .lbl {
          opacity: 0;
          transition: opacity .4s var(--ease) .45s;
        }
        .nav.on .navcta {
          width: 142px;
          margin-left: 16px;
          transform: scale(1);
        }
        .nav.on .navcta .lbl {
          opacity: 1;
        }

        /* ── Button with Dot to Chevron Hover ── */
        .btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          height: 42px;
          padding: 0 46px 0 18px;
          border-radius: 999px;
          background: var(--ink);
          color: #ffffff;
          font-size: 13.5px;
          font-weight: 500;
          letter-spacing: -0.01em;
          white-space: nowrap;
          text-decoration: none;
          cursor: pointer;
          border: none;
          outline: none;
        }
        .btn .dot {
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: var(--dot);
          box-shadow: 0 0 10px rgba(47,224,208,.7);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: width .45s var(--ease), height .45s var(--ease), right .45s var(--ease), box-shadow .45s var(--ease);
        }
        .btn .dot svg {
          opacity: 0;
          transform: translateX(-4px);
          transition: opacity .3s var(--ease) .05s, transform .3s var(--ease) .05s;
        }
        .btn:hover .dot {
          width: 32px;
          height: 32px;
          right: 5px;
          box-shadow: none;
        }
        .btn:hover .dot svg {
          opacity: 1;
          transform: translateX(0);
        }

        /* Large Hero CTA Button */
        .btn.lg {
          height: 62px;
          padding: 0 62px 0 28px;
          font-size: 17px;
        }
        .btn.lg .dot {
          width: 14px;
          height: 14px;
          right: 24px;
        }
        .btn.lg:hover .dot {
          width: 48px;
          height: 48px;
          right: 7px;
        }

        /* ── Hero Section (100vh, min 640px) ── */
        .hero {
          position: relative;
          width: 100%;
          height: 100vh;
          min-height: 640px;
          overflow: hidden;
        }
        #h1 {
          position: absolute;
          top: 21.5vh;
          left: var(--gut);
          font-weight: 400;
          font-size: clamp(34px, 4.65vw, 70px);
          line-height: 1.03;
          letter-spacing: -0.035em;
          white-space: nowrap;
          color: var(--ink);
        }
        #h1 .hl {
          color: var(--accent);
        }

        .trust {
          position: absolute;
          top: 58vh;
          left: var(--gut);
          font-size: clamp(15px, 1.28vw, 19px);
          letter-spacing: -0.015em;
          color: var(--ink-2);
        }

        .hero-cta {
          position: absolute;
          bottom: 7.5vh;
          left: var(--gut);
        }

        /* ── Logo Grid (4x2) ── */
        .logos {
          position: absolute;
          right: 0;
          width: 50%;
          top: 55vh;
          bottom: 0;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          grid-template-rows: repeat(2, 1fr);
        }
        .logo-cell {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #3e4d68;
        }
        /* 1px left line on all cells */
        .logo-cell::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 1px;
          background: linear-gradient(to bottom, rgba(11,29,58,.08), rgba(11,29,58,.05));
        }
        /* 1px top line on row 2 (cells 5-8) */
        .logo-cell.row-2::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 1px;
          background: rgba(11,29,58,.06);
        }

        .logo-item {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: .06em;
        }

        /* Fade-up animations */
        .fade-up {
          opacity: 0;
          transform: translateY(14px);
        }
        body.ready .fade-up {
          animation: fu .9s var(--ease) forwards;
          animation-delay: var(--d);
        }
        @keyframes fu {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* ── Statement (Pinned) ── */
        .statement {
          position: relative;
          height: 306vh;
          margin-top: -31vh;
          pointer-events: none;
        }
        .pin {
          position: sticky;
          top: 0;
          height: 100vh;
        }
        #stmt {
          position: absolute;
          top: 41.5vh;
          left: 0;
          right: 0;
          text-align: center;
          font-weight: 400;
          font-size: clamp(20px, 2.8vw, 42px);
          line-height: 1.16;
          letter-spacing: -0.03em;
          color: var(--ink);
          white-space: nowrap;
          will-change: transform;
        }

        /* ── Dark Split Panel ── */
        .split {
          position: relative;
          z-index: 2;
          background: var(--panel);
          color: #ffffff;
          min-height: 100vh;
          display: grid;
          grid-template-columns: 58.3% 41.7%;
        }
        .split .l {
          position: relative;
          padding-left: var(--gut);
          display: flex;
          flex-direction: column;
        }
        .split .guide-line {
          position: absolute;
          top: 0;
          bottom: 0;
          left: var(--gut);
          width: 1px;
          background: var(--panel-line);
        }

        #h2 {
          font-weight: 400;
          font-size: clamp(32px, 3.15vw, 48px);
          line-height: 1.08;
          letter-spacing: -0.03em;
          padding: 21vh 0 0 6.2vw;
          color: #ffffff;
        }

        #row {
          margin-top: 6.4vh;
          border-top: 1px solid var(--panel-line);
          display: grid;
          grid-template-columns: 1fr 1.05fr;
          gap: 24px;
          padding: 3vh 6vw 6vh 6.2vw;
          opacity: 0;
          transform: translateY(14px);
          transition: opacity .9s var(--ease), transform .9s var(--ease);
        }
        #row.visible {
          opacity: 1;
          transform: translateY(0);
        }

        #row h3 {
          font-weight: 400;
          font-size: clamp(17px, 1.4vw, 21px);
          color: #ffffff;
        }
        #row p {
          font-size: clamp(13px, 1.1vw, 16px);
          line-height: 1.38;
          color: rgba(255, 255, 255, 0.5);
          max-width: 20em;
        }
        #row p strong {
          color: #ffffff;
          font-weight: 500;
        }

        .split .r {
          position: relative;
          overflow: hidden;
          width: 100%;
          height: 100%;
          min-height: 100vh;
        }
        #ship {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform-origin: 50% 60%;
          display: block;
        }

        /* ── Responsive (<= 820px) ── */
        @media (max-width: 820px) {
          .nav-links {
            display: none;
          }
          .nav {
            height: 54px;
            top: 12px;
          }
          .nav.on .navcta {
            margin-left: 8px;
          }
          .nav-login {
            padding: 0 6px;
          }

          #h1 {
            top: 17vh;
            font-size: 7.4vw;
            white-space: normal;
          }
          .trust {
            top: 44vh;
          }
          .logos {
            width: 100%;
            top: 50vh;
            bottom: 18vh;
          }
          .logo-item span {
            display: none;
          }
          .hero-cta {
            bottom: 6vh;
          }

          #stmt {
            white-space: normal;
            font-size: 23px;
            max-width: 15em;
            margin: 0 auto;
          }
          #stmt br {
            display: none;
          }

          .split {
            grid-template-columns: 1fr;
            grid-template-rows: auto 70vh;
          }
          .split .r {
            min-height: 70vh;
          }
          #h2 {
            padding: 16vh 0 0 6vw;
          }
          #row {
            grid-template-columns: 1fr;
            padding: 3vh 6vw 6vh;
          }
        }
      `,
        }}
      />

      {/* ── Fixed Atmosphere (Canvas Bowl Glow) ── */}
      <div className="atmo">
        <canvas id="bg" width="96" height="60" />
      </div>

      {/* ── Fixed Pill Navbar ── */}
      <header className="nav" id="nav">
        <Link href="/" className="brand">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="11" r="11" fill="#5b7cf0" />
            <path
              d="M5 10.2c2.3-1.6 4.7-1.6 7 0s4.7 1.6 7 0"
              stroke="#ffffff"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M5 14.2c2.3-1.6 4.7-1.6 7 0s4.7 1.6 7 0"
              stroke="#ffffff"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          <span className="brand-name">Halden</span>
        </Link>

        <nav className="nav-links">
          <a href="#platform" className="nav-link">
            Platform
          </a>
          <a href="#solutions" className="nav-link">
            Solutions
          </a>
          <a href="#security" className="nav-link">
            Security
          </a>
          <a href="#company" className="nav-link">
            Company
          </a>
          <a href="#resources" className="nav-link">
            Resources
          </a>
        </nav>

        <div className="nav-right">
          <Link href="/login" className="nav-login">
            Login
          </Link>
          <div className="navcta">
            <Link href="/login" className="btn">
              <span className="lbl">Get a demo</span>
              <span className="dot">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M4.5 2.5 8 6l-3.5 3.5"
                    stroke="#0b1d3a"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ── 1. Hero ── */}
        <section className="hero" id="hero">
          <h1 id="h1">
            Meet <span className="hl">Hal</span>, your AI teammate
            <br />
            for port operators
          </h1>

          <p className="trust fade-up" style={{ "--d": "1.15s" } as React.CSSProperties}>
            Port operators trust Halden
          </p>

          <div className="hero-cta fade-up" style={{ "--d": "1.3s" } as React.CSSProperties}>
            <Link href="/login" className="btn lg">
              Get a demo
              <span className="dot">
                <svg width="16" height="16" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M4.5 2.5 8 6l-3.5 3.5"
                    stroke="#0b1d3a"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </Link>
          </div>

          {/* 4x2 Logo Grid */}
          <div className="logos">
            {/* Cell 1: OCEANEX */}
            <div className="logo-cell fade-up" style={{ "--d": "1.25s" } as React.CSSProperties}>
              <div className="logo-item">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M2 7.5c2.5-2 5.5-2 8 0s5.5 2 8 0"
                    stroke="#3e4d68"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                  <path
                    d="M2 13c2.5-2 5.5-2 8 0s5.5 2 8 0"
                    stroke="#3e4d68"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                </svg>
                <span>OCEANEX</span>
              </div>
            </div>

            {/* Cell 2: Nordhavn */}
            <div className="logo-cell fade-up" style={{ "--d": "1.32s" } as React.CSSProperties}>
              <div
                className="logo-item"
                style={{
                  fontFamily: "Georgia, serif",
                  fontWeight: "bold",
                  fontStyle: "italic",
                  fontSize: "15px",
                  letterSpacing: "0.02em",
                }}
              >
                <span>Nordhavn</span>
              </div>
            </div>

            {/* Cell 3: BLUEGATE */}
            <div className="logo-cell fade-up" style={{ "--d": "1.39s" } as React.CSSProperties}>
              <div className="logo-item">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="2" y="10" width="3.5" height="10" fill="#3e4d68" rx="0.8" />
                  <rect x="8" y="5" width="3.5" height="15" fill="#3e4d68" rx="0.8" />
                  <rect x="14" y="8" width="3.5" height="12" fill="#3e4d68" rx="0.8" />
                </svg>
                <span>BLUEGATE</span>
              </div>
            </div>

            {/* Cell 4: KELPWAY */}
            <div className="logo-cell fade-up" style={{ "--d": "1.46s" } as React.CSSProperties}>
              <div className="logo-item" style={{ fontSize: "11px", fontWeight: 500, letterSpacing: ".32em" }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <polygon points="10,2 18,18 2,18" stroke="#3e4d68" strokeWidth="2" strokeLinejoin="round" />
                </svg>
                <span>KELPWAY</span>
              </div>
            </div>

            {/* Cell 5: TIDELINE */}
            <div className="logo-cell row-2 fade-up" style={{ "--d": "1.42s" } as React.CSSProperties}>
              <div
                className="logo-item"
                style={{
                  fontSize: "16px",
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  border: "2px solid #3e4d68",
                  borderRadius: "4px",
                  padding: "2px 7px",
                }}
              >
                <span>TIDELINE</span>
              </div>
            </div>

            {/* Cell 6: HARBORIX */}
            <div className="logo-cell row-2 fade-up" style={{ "--d": "1.49s" } as React.CSSProperties}>
              <div className="logo-item">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M4 2v16M16 2v16M4 10h12" stroke="#3e4d68" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <span>HARBORIX</span>
              </div>
            </div>

            {/* Cell 7: seaflux */}
            <div className="logo-cell row-2 fade-up" style={{ "--d": "1.56s" } as React.CSSProperties}>
              <div className="logo-item" style={{ fontSize: "15px", fontWeight: 500, textTransform: "lowercase" }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="7.5" stroke="#3e4d68" strokeWidth="2" />
                  <circle cx="10" cy="10" r="2.2" fill="#3e4d68" />
                </svg>
                <span>seaflux</span>
              </div>
            </div>

            {/* Cell 8: PORTERRA */}
            <div className="logo-cell row-2 fade-up" style={{ "--d": "1.63s" } as React.CSSProperties}>
              <div className="logo-item" style={{ fontSize: "11px", letterSpacing: ".24em" }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <polygon points="10,3 19,17 1,17" fill="#3e4d68" />
                </svg>
                <span>PORTERRA</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. Statement (Pinned) ── */}
        <section className="statement" id="statement">
          <div className="pin">
            <p id="stmt">
              Hal is an AI teammate
              <br />
              that tracks vessels, books berths, files customs,
              <br />
              coordinates crews, escalates and does anything
              <br />
              in between to keep a port moving
            </p>
          </div>
        </section>

        {/* ── 3. Dark Split ── */}
        <section className="split" id="split">
          <div className="l">
            <div className="guide-line" />
            <h2 id="h2">
              AI teammate that operates
              <br />
              like you work
            </h2>

            <div id="row">
              <h3>Port operators</h3>
              <p>
                <strong>Berth faster. Clear more. Stop chasing manifests.</strong> Hal runs
                scheduling, bookings, customs filings, and more — so your team stays focused on
                throughput and safety.
              </p>
            </div>
          </div>

          <div className="r">
            <img
              id="ship"
              src="https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261029_050506_a830ff21-4c71-4272-bc39-b61cacb54463.png&w=1400&q=85"
              alt="Aerial view of a container ship sailing up a misty fjord"
            />
          </div>
        </section>
      </main>
    </>
  );
}
