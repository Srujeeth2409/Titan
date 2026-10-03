"use client";

import { AskBox } from "@/components/ask-box";

export default function AskPage() {
  return (
    <div className="ask-page">
      <div className="ask-page-hero">
        <h1 className="ask-page-title">Ask your corpus</h1>
        <p className="ask-page-subtitle">
          Titan retrieves across ingested documents, then answers with citations you can open and verify.
        </p>
      </div>
      <AskBox />
    </div>
  );
}
