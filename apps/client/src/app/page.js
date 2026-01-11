"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useAuth from "./hooks/useAuth";

export default function IndexPage() {
  const router = useRouter();
  const { authChecked, token, user } = useAuth();

  useEffect(() => {
    if (!authChecked) return;
    if (token && user) {
      router.replace("/chats");
    } else {
      router.replace("/login");
    }
  }, [authChecked, router, token, user]);

  return (
    <div className="min-h-[var(--app-height,100svh)] flex items-center justify-center px-4 py-6 sm:p-6">
      <div className="w-full max-w-md bg-white/85 border border-white/60 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-700">
          PulseChat
        </p>
        <p className="mt-4 text-sm text-emerald-800">Loading...</p>
      </div>
    </div>
  );
}
