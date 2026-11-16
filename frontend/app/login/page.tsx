"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import LoginForm from "@/components/ui/login-form";
import DottedTrailCursor from "@/components/ui/dotted-trail-cursor";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-white text-zinc-400">
          Loading...
        </div>
      }
    >
      <DottedTrailCursor
        backgroundColor="#ffffff"
        dotColor="#cbd5e1"
        activeDotColor="#ffffff"
        colorA="#6366f1"
        colorB="#a855f7"
        dotSpacing={32}
        dotRadius={1.2}
        glowRadius={280}
        headRadius={70}
      >
        <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
          {/* Floating Back to Home button */}
          <div className="fixed top-5 left-5 sm:top-7 sm:left-7 z-30">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs sm:text-sm font-medium text-zinc-700 hover:text-zinc-950 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-md border border-zinc-200/90 dark:border-zinc-800 shadow-sm hover:shadow transition-all hover:-translate-x-0.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to home</span>
            </Link>
          </div>

          <div className="w-full max-w-5xl z-10 my-auto">
            <LoginForm />
          </div>
        </div>
      </DottedTrailCursor>
    </Suspense>
  );
}
