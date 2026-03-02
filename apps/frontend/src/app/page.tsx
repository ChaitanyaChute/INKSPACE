"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Pen, Users, Zap } from "lucide-react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      router.push("/dashboard");
    }
  }, [router]);

  return (
    <div className="min-h-screen w-screen bg-[#0a0a0f] flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-600/10 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full bg-violet-600/10 blur-[120px]" />

      <div className="relative z-10 max-w-2xl w-full text-center animate-slide-up">
        {/* Logo mark */}
        <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-sm text-gray-400">
          <Pen className="w-3.5 h-3.5 text-indigo-400" />
          Real-time collaborative whiteboard
        </div>

        <h1 className="text-6xl sm:text-7xl font-bold text-white mb-4 tracking-tight">
          Ink<span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">space</span>
        </h1>
        <p className="text-lg text-gray-400 mb-10 max-w-md mx-auto leading-relaxed">
          Draw, brainstorm, and create together in real-time. Share your canvas with anyone, anywhere.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
          <Link href="/signup">
            <button
              className="cursor-pointer flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-8 py-3.5 rounded-xl text-white font-semibold transition-all shadow-lg shadow-indigo-600/25 hover:shadow-indigo-500/30 hover:-translate-y-0.5"
              type="button"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
          <Link href="/signin">
            <button
              className="cursor-pointer flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-8 py-3.5 rounded-xl text-white font-semibold transition-all hover:-translate-y-0.5"
              type="button"
            >
              Sign In
            </button>
          </Link>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-3">
              <Pen className="w-4 h-4 text-indigo-400" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">Multiple Tools</h3>
            <p className="text-xs text-gray-500 leading-relaxed">Rectangles, circles, arrows, pencil, text, and more.</p>
          </div>
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors">
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center mb-3">
              <Users className="w-4 h-4 text-violet-400" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">Live Collaboration</h3>
            <p className="text-xs text-gray-500 leading-relaxed">See changes from others appear instantly on your canvas.</p>
          </div>
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3">
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">Room Management</h3>
            <p className="text-xs text-gray-500 leading-relaxed">Invite members, manage access, and control your rooms.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
