"use client";

import { AskBox } from "@/components/ask-box";

export default function AskPage() {
  return (
    <div className="ask-page">
      {/* Hero heading */}
      <div className="ask-page-hero">
        <h1 className="ask-page-title">
          What do you want to know?
        </h1>
        <p className="ask-page-subtitle">
          Ask questions across your ingested documents. Every answer is cited and verified.
        </p>
      </div>

      {/* Ask Box */}
      <AskBox />
    </div>
  );
}
