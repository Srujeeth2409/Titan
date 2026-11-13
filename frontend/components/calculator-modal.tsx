"use client";

import React, { useState, useEffect } from "react";
import { X, Minimize2, Maximize2 } from "lucide-react";

export function CalculatorModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"standard" | "scientific">("standard");
  const [display, setDisplay] = useState("0");
  const [equation, setEquation] = useState("");
  const [resetNext, setResetNext] = useState(false);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("titan:open-calculator", handleOpen);
    return () => window.removeEventListener("titan:open-calculator", handleOpen);
  }, []);

  const handleNum = (n: string) => {
    if (display === "0" || resetNext) {
      setDisplay(n);
      setResetNext(false);
    } else {
      setDisplay(display + n);
    }
  };

  const handleOp = (op: string) => {
    setEquation(`${display} ${op} `);
    setResetNext(true);
  };

  const handleClear = () => {
    setDisplay("0");
    setEquation("");
    setResetNext(false);
  };

  const handleEqual = () => {
    try {
      const full = equation + display;
      // Sanitize equation before eval
      const cleanExpr = full
        .replace(/×/g, "*")
        .replace(/÷/g, "/")
        .replace(/\^/g, "**")
        .replace(/π/g, "Math.PI")
        .replace(/e/g, "Math.E");

      // eslint-disable-next-line no-eval
      const res = Function(`'use strict'; return (${cleanExpr})`)();
      setDisplay(String(Number(res.toFixed(8))));
      setEquation("");
      setResetNext(true);
    } catch {
      setDisplay("Error");
      setResetNext(true);
    }
  };

  const handleScientific = (fn: string) => {
    try {
      const val = parseFloat(display);
      let res = 0;
      switch (fn) {
        case "sin":
          res = Math.sin((val * Math.PI) / 180);
          break;
        case "cos":
          res = Math.cos((val * Math.PI) / 180);
          break;
        case "tan":
          res = Math.tan((val * Math.PI) / 180);
          break;
        case "ln":
          res = Math.log(val);
          break;
        case "log":
          res = Math.log10(val);
          break;
        case "sqrt":
          res = Math.sqrt(val);
          break;
        case "sq":
          res = val * val;
          break;
        case "inv":
          res = 1 / val;
          break;
        case "pi":
          setDisplay(String(Math.PI));
          return;
        case "e":
          setDisplay(String(Math.E));
          return;
      }
      setDisplay(String(Number(res.toFixed(8))));
      setResetNext(true);
    } catch {
      setDisplay("Error");
      setResetNext(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm animate-in fade-in">
      <div
        className={`bg-slate-900/90 text-white rounded-3xl p-5 shadow-2xl border border-slate-700/60 backdrop-blur-2xl transition-all duration-300 ${
          mode === "scientific" ? "w-[480px]" : "w-[320px]"
        }`}
        style={{
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.4)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsOpen(false)}
              className="w-3.5 h-3.5 rounded-full bg-rose-500 hover:bg-rose-600 transition-colors"
            />
            <button
              onClick={() => setMode(mode === "standard" ? "scientific" : "standard")}
              className="w-3.5 h-3.5 rounded-full bg-amber-500 hover:bg-amber-600 transition-colors"
              title="Toggle Scientific Mode"
            />
            <button
              onClick={() => setIsOpen(false)}
              className="w-3.5 h-3.5 rounded-full bg-emerald-500 hover:bg-emerald-600 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400 capitalize">{mode} Mode</span>
            <button
              onClick={() => setMode(mode === "standard" ? "scientific" : "standard")}
              className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              {mode === "standard" ? "Scientific" : "Standard"}
            </button>
          </div>
        </div>

        {/* Display */}
        <div className="py-4 text-right">
          <div className="text-xs text-slate-400 h-5 font-mono overflow-hidden">{equation}</div>
          <div className="text-3xl font-light tracking-tight font-mono truncate">{display}</div>
        </div>

        {/* Keypad Grid */}
        <div className="grid grid-cols-4 gap-2 pt-2">
          {mode === "scientific" && (
            <>
              <button onClick={() => handleScientific("sin")} className="cal-btn-sci">sin</button>
              <button onClick={() => handleScientific("cos")} className="cal-btn-sci">cos</button>
              <button onClick={() => handleScientific("tan")} className="cal-btn-sci">tan</button>
              <button onClick={() => handleScientific("pi")} className="cal-btn-sci">π</button>

              <button onClick={() => handleScientific("ln")} className="cal-btn-sci">ln</button>
              <button onClick={() => handleScientific("log")} className="cal-btn-sci">log</button>
              <button onClick={() => handleScientific("sqrt")} className="cal-btn-sci">√</button>
              <button onClick={() => handleScientific("e")} className="cal-btn-sci">e</button>

              <button onClick={() => handleScientific("sq")} className="cal-btn-sci">x²</button>
              <button onClick={() => handleOp("^")} className="cal-btn-sci">xʸ</button>
              <button onClick={() => handleScientific("inv")} className="cal-btn-sci">1/x</button>
              <button onClick={() => handleNum("(")} className="cal-btn-sci">(</button>
            </>
          )}

          <button onClick={handleClear} className="cal-btn-fn">AC</button>
          <button onClick={() => setDisplay(String(-parseFloat(display)))} className="cal-btn-fn">+/-</button>
          <button onClick={() => setDisplay(String(parseFloat(display) / 100))} className="cal-btn-fn">%</button>
          <button onClick={() => handleOp("÷")} className="cal-btn-op">÷</button>

          <button onClick={() => handleNum("7")} className="cal-btn-num">7</button>
          <button onClick={() => handleNum("8")} className="cal-btn-num">8</button>
          <button onClick={() => handleNum("9")} className="cal-btn-num">9</button>
          <button onClick={() => handleOp("×")} className="cal-btn-op">×</button>

          <button onClick={() => handleNum("4")} className="cal-btn-num">4</button>
          <button onClick={() => handleNum("5")} className="cal-btn-num">5</button>
          <button onClick={() => handleNum("6")} className="cal-btn-num">6</button>
          <button onClick={() => handleOp("-")} className="cal-btn-op">-</button>

          <button onClick={() => handleNum("1")} className="cal-btn-num">1</button>
          <button onClick={() => handleNum("2")} className="cal-btn-num">2</button>
          <button onClick={() => handleNum("3")} className="cal-btn-num">3</button>
          <button onClick={() => handleOp("+")} className="cal-btn-op">+</button>

          <button onClick={() => handleNum("0")} className="cal-btn-num col-span-2">0</button>
          <button onClick={() => !display.includes(".") && handleNum(".")} className="cal-btn-num">.</button>
          <button onClick={handleEqual} className="cal-btn-op bg-indigo-600 hover:bg-indigo-500">=</button>
        </div>
      </div>

      <style jsx>{`
        .cal-btn-num {
          background: rgba(255, 255, 255, 0.08);
          color: #f8fafc;
          border-radius: 14px;
          height: 48px;
          font-size: 17px;
          font-weight: 400;
          transition: all 0.15s ease;
        }
        .cal-btn-num:hover {
          background: rgba(255, 255, 255, 0.15);
        }
        .cal-btn-fn {
          background: rgba(148, 163, 184, 0.18);
          color: #e2e8f0;
          border-radius: 14px;
          height: 48px;
          font-size: 15px;
          font-weight: 500;
        }
        .cal-btn-fn:hover {
          background: rgba(148, 163, 184, 0.28);
        }
        .cal-btn-op {
          background: #f59e0b;
          color: #ffffff;
          border-radius: 14px;
          height: 48px;
          font-size: 18px;
          font-weight: 500;
          transition: all 0.15s ease;
        }
        .cal-btn-op:hover {
          filter: brightness(1.1);
        }
        .cal-btn-sci {
          background: rgba(99, 102, 241, 0.15);
          color: #a5b4fc;
          border-radius: 14px;
          height: 48px;
          font-size: 13px;
          font-weight: 500;
          border: 1px solid rgba(99, 102, 241, 0.2);
        }
        .cal-btn-sci:hover {
          background: rgba(99, 102, 241, 0.25);
        }
      `}</style>
    </div>
  );
}

