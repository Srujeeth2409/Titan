"use client";

import React, { Suspense } from "react";
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
        <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <div className="w-full max-w-5xl z-10">
            <LoginForm />
          </div>
        </div>
      </DottedTrailCursor>
    </Suspense>
  );
}
