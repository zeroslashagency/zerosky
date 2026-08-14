'use client';

import { motion } from 'framer-motion';

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.12 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100, damping: 20 } },
};

export function LoginVisual() {
  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="relative hidden h-full min-h-[100dvh] overflow-hidden lg:flex lg:flex-col lg:justify-between lg:px-10 lg:py-10 xl:px-12"
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- external picsum seed kept stable, remotePatterns not yet strict */}
      <img
        src="https://picsum.photos/seed/zerosky-kitchen-1680/1200/1600"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Fade to background (§8 hero fade) */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/20 via-zinc-950/40 to-zinc-950/80" />
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/60 via-transparent to-transparent" />

      <motion.p variants={item} className="relative text-xs font-medium tracking-[0.18em] text-white/70">
        ZEROSKY — OPEN SOURCE POS
      </motion.p>

      <motion.div variants={item} className="relative">
        <p className="max-w-[22ch] text-[28px] font-semibold leading-[1.05] tracking-tighter text-white xl:text-[34px]">
          Service that never blocks the pass.
        </p>
        <p className="mt-3 max-w-[32ch] text-sm leading-relaxed text-white/70">
          Billing, KOT and offline-first — built for India’s rush hour, 12-hour shifts and choppy networks.
        </p>
        <div className="mt-6 flex gap-2">
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur">Offline-first</span>
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur">GST-ready</span>
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur">KDS</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
