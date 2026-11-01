"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ArrowRight, Pen, Users, Zap, Sparkles } from "lucide-react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      router.push("/dashboard");
    }
  }, [router]);

  return (
    <div className="min-h-screen w-screen bg-[#0b0b0a] flex flex-col px-5 sm:px-10 lg:px-16 relative overflow-hidden noise">
      <div className="absolute inset-0 premium-grid pointer-events-none" />
      <div className="absolute -top-56 right-[-10%] w-[620px] h-[620px] rounded-full bg-[#ff7448]/10 blur-[150px]" />
      <div className="absolute bottom-[-30%] left-[-8%] w-[520px] h-[520px] rounded-full bg-[#d7a86e]/10 blur-[150px]" />

      <nav className="relative z-10 flex items-center justify-between py-6 border-b border-white/10">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f3efe6] text-[#171714]"><Pen className="h-4 w-4" /></span>
          <span className="text-[15px] font-semibold tracking-[-0.03em] text-[#f3efe6]">inkspace<span className="text-[#ff7448]">.</span></span>
        </Link>
        <div className="hidden sm:flex items-center gap-7 text-[11px] uppercase tracking-[0.18em] text-white/45">
          <span>Workspace</span><span>Real-time</span><span>For teams</span>
        </div>
        <Link href="/signin" className="flex items-center gap-2 text-xs font-medium text-[#f3efe6] hover:text-[#ff7448] transition-colors">
          Sign in <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </nav>

      <div className="relative z-10 flex flex-1 items-center py-16 sm:py-24">
        <div className="w-full max-w-6xl mx-auto">
          <div className="max-w-3xl animate-slide-up">
            <div className="inline-flex items-center gap-2 mb-8 text-[11px] uppercase tracking-[0.22em] text-[#ff9a76]">
              <Sparkles className="h-3.5 w-3.5" /> A calmer space to think together
            </div>
            <h1 className="max-w-4xl text-6xl sm:text-8xl lg:text-[8.5rem] leading-[0.86] font-semibold tracking-[-0.08em] text-[#f3efe6]">
              Make room<br /><span className="text-[#ff7448]">for ideas.</span>
            </h1>
            <p className="mt-8 max-w-lg text-base sm:text-lg leading-relaxed text-white/50">
              Inkspace is a focused, real-time canvas for teams who want to sketch, shape, and share the next thing.
            </p>
          </div>
          <div className="mt-12 flex flex-col sm:flex-row gap-3 animate-slide-up">
          <Link href="/signup">
            <button
              className="cursor-pointer flex items-center justify-center gap-3 bg-[#f3efe6] hover:bg-white px-7 py-3.5 rounded-full text-[#171714] text-sm font-semibold transition-all hover:-translate-y-0.5"
              type="button"
            >
              Start a canvas
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
          <Link href="/signin">
            <button
              className="cursor-pointer flex items-center justify-center gap-2 bg-white/[0.04] hover:bg-white/[0.09] border border-white/15 px-7 py-3.5 rounded-full text-[#f3efe6] text-sm font-semibold transition-all hover:-translate-y-0.5"
              type="button"
            >
              Sign In
            </button>
          </Link>
        </div>

          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px mt-24 border-y border-white/10 text-left max-w-4xl">
          <div className="py-6 sm:pr-8 sm:border-r border-white/10">
            <div className="flex items-center gap-2 mb-3 text-[#ff7448]"><Pen className="w-4 h-4" /><span className="text-[10px] uppercase tracking-[0.2em]">01 / Create</span></div>
            <h3 className="text-sm font-medium text-[#f3efe6] mb-1">Tools that disappear</h3>
            <p className="text-xs text-white/40 leading-relaxed">A clean canvas that keeps your thinking in focus.</p>
          </div>
          <div className="py-6 sm:px-8 sm:border-r border-white/10">
            <div className="flex items-center gap-2 mb-3 text-[#ff7448]"><Users className="w-4 h-4" /><span className="text-[10px] uppercase tracking-[0.2em]">02 / Connect</span></div>
            <h3 className="text-sm font-medium text-[#f3efe6] mb-1">Same room, in real time</h3>
            <p className="text-xs text-white/40 leading-relaxed">Invite your team and watch ideas take shape together.</p>
          </div>
          <div className="py-6 sm:pl-8">
            <div className="flex items-center gap-2 mb-3 text-[#ff7448]"><Zap className="w-4 h-4" /><span className="text-[10px] uppercase tracking-[0.2em]">03 / Move</span></div>
            <h3 className="text-sm font-medium text-[#f3efe6] mb-1">From spark to shared</h3>
            <p className="text-xs text-white/40 leading-relaxed">Rooms, history, and access controls when you need them.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
