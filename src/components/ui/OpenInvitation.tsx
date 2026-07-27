"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { wedding } from "@/data/wedding";

type OpenInvitationProps = {
  open: boolean;
  onOpen: () => void;
};

type Phase = "sealed" | "unrolling" | "revealed" | "exiting";

const easeLuxury = [0.22, 1, 0.36, 1] as const;

/** Mobile stays ~340; desktop gets a fuller scroll presence */
function useScrollMetrics() {
  const [metrics, setMetrics] = useState({
    parchment: 340,
    sealedRoll: 72,
    openRoll: 18,
  });

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => {
      setMetrics(
        mq.matches
          ? { parchment: 480, sealedRoll: 96, openRoll: 22 }
          : { parchment: 340, sealedRoll: 72, openRoll: 18 },
      );
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return metrics;
}

function ScrollRod({ side }: { side: "top" | "bottom" }) {
  return (
    <div
      className={`absolute left-1/2 z-30 h-5 w-[118%] -translate-x-1/2 md:h-7 ${
        side === "top" ? "-top-2.5 md:-top-3.5" : "-bottom-2.5 md:-bottom-3.5"
      }`}
    >
      <div className="absolute inset-y-1 left-0 right-0 rounded-full bg-gradient-to-r from-[#6a5420] via-[#e8d5a3] to-[#6a5420] shadow-[0_4px_16px_rgba(0,0,0,0.45)]" />
      <div className="absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-gradient-to-br from-gold-soft to-gold-deep shadow-md md:h-5 md:w-5" />
      <div className="absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-gradient-to-br from-gold-soft to-gold-deep shadow-md md:h-5 md:w-5" />
      <div className="absolute inset-x-6 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-[#fff6d8]/50 to-transparent" />
    </div>
  );
}

export function OpenInvitation({ open, onOpen }: OpenInvitationProps) {
  const [phase, setPhase] = useState<Phase>("sealed");
  const [busy, setBusy] = useState(false);
  const scroll = useScrollMetrics();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleOpen = () => {
    if (busy || phase !== "sealed") return;
    setBusy(true);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      onOpen();
      return;
    }

    setPhase("unrolling");
    window.setTimeout(() => setPhase("revealed"), 1800);
    window.setTimeout(() => setPhase("exiting"), 3600);
    window.setTimeout(() => onOpen(), 4400);
  };

  const isOpen =
    phase === "unrolling" || phase === "revealed" || phase === "exiting";

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center overflow-x-hidden overflow-y-auto overscroll-none bg-[#07060a] py-10"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: easeLuxury }}
        >
          {/* Atmosphere */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
          >
            <motion.div
              className="absolute left-1/2 top-[30%] h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-gold/15 blur-[120px]"
              animate={{
                opacity: isOpen ? 0.9 : 0.4,
                scale: isOpen ? 1.2 : 1,
              }}
              transition={{ duration: 1.5, ease: easeLuxury }}
            />
            <div className="absolute bottom-[15%] left-[10%] h-64 w-64 rounded-full bg-maroon/25 blur-[100px]" />
            {Array.from({ length: 16 }).map((_, i) => (
              <motion.span
                key={i}
                className="absolute rounded-full bg-gold-soft/70"
                style={{
                  left: `${6 + ((i * 19) % 88)}%`,
                  top: `${10 + ((i * 27) % 75)}%`,
                  width: i % 3 === 0 ? 6 : 3,
                  height: i % 3 === 0 ? 8 : 3,
                  borderRadius: i % 3 === 0 ? "60% 40% 60% 40%" : "999px",
                }}
                animate={{
                  opacity: [0.15, 0.85, 0.2],
                  y: [0, -18, 0],
                  rotate: [0, 40, 0],
                }}
                transition={{
                  duration: 3.4 + (i % 5) * 0.35,
                  delay: i * 0.1,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(7,6,10,0.45)_65%,rgba(7,6,10,0.95)_100%)]" />
          </div>

          <motion.div
            className="relative z-10 flex w-full max-w-lg flex-col items-center px-5 md:max-w-3xl md:px-8"
            animate={
              phase === "exiting"
                ? { opacity: 0, scale: 1.06, filter: "blur(12px)" }
                : { opacity: 1, scale: 1, filter: "blur(0px)" }
            }
            transition={{ duration: 0.85, ease: easeLuxury }}
          >
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: phase === "exiting" ? 0 : 1, y: 0 }}
              className="mb-8 font-body text-[10px] uppercase tracking-[0.5em] text-gold/70 md:mb-10 md:text-xs md:tracking-[0.55em]"
            >
              A royal scroll invitation
            </motion.p>

            {/* Rolled / unrolling scroll */}
            <div className="relative flex w-full justify-center">
              <motion.div
                className={`relative w-full max-w-[340px] md:max-w-[560px] ${
                  phase === "sealed" ? "pb-[5.5rem] md:pb-28" : ""
                }`}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, ease: easeLuxury }}
              >
                {/* Ground shadow */}
                <motion.div
                  className="absolute -bottom-5 left-1/2 h-6 w-[55%] -translate-x-1/2 rounded-full bg-black/50 blur-xl md:-bottom-7 md:h-8"
                  animate={{
                    width: isOpen ? "78%" : "55%",
                    opacity: isOpen ? 0.35 : 0.55,
                  }}
                  transition={{ duration: 1.4, ease: easeLuxury }}
                />

                {/* Top rolled cylinder (always visible, shrinks as scroll opens) */}
                <motion.div
                  className="relative z-20 mx-auto"
                  animate={{
                    height: isOpen ? scroll.openRoll : scroll.sealedRoll,
                    width: isOpen ? "100%" : "92%",
                  }}
                  transition={{ duration: 1.5, ease: easeLuxury }}
                >
                  <div className="absolute inset-0 overflow-hidden rounded-full border border-gold/40 bg-gradient-to-b from-[#3a2f22] via-[#1f1812] to-[#120e0b] shadow-[0_10px_30px_rgba(0,0,0,0.55)]">
                    {/* Roll rings */}
                    <div className="absolute inset-y-0 left-[8%] w-px bg-gold/20" />
                    <div className="absolute inset-y-0 left-[22%] w-px bg-gold/15" />
                    <div className="absolute inset-y-0 left-[50%] w-px bg-gold/25" />
                    <div className="absolute inset-y-0 left-[78%] w-px bg-gold/15" />
                    <div className="absolute inset-y-0 left-[92%] w-px bg-gold/20" />
                    <div className="absolute inset-x-0 top-1/3 h-px bg-gradient-to-r from-transparent via-gold/35 to-transparent" />
                    <div className="absolute inset-x-0 top-2/3 h-px bg-gradient-to-r from-transparent via-black/40 to-transparent" />
                  </div>
                  <ScrollRod side="top" />
                </motion.div>

                {/* Unfurling parchment */}
                <motion.div
                  className="relative z-10 mx-auto origin-top overflow-hidden"
                  initial={{ height: 0 }}
                  animate={{
                    height: isOpen ? scroll.parchment : 0,
                  }}
                  transition={{ duration: 1.55, ease: [0.65, 0.05, 0.36, 1] }}
                  style={{ width: "100%" }}
                >
                  <div
                    className="relative mx-auto border-x border-gold/30 bg-gradient-to-b from-[#f6edd8] via-[#efe2c4] to-[#e8d5a3] px-6 py-8 shadow-[inset_0_0_40px_rgba(107,29,42,0.08)] md:px-12 md:py-12"
                    style={{ minHeight: scroll.parchment }}
                  >
                    {/* Parchment texture */}
                    <div className="pointer-events-none absolute inset-0 opacity-[0.12] bg-[repeating-linear-gradient(0deg,transparent,transparent_14px,rgba(107,29,42,0.25)_15px)]" />
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(90,60,20,0.12)_100%)]" />

                    {/* Side curls */}
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-[#c4a574]/50 to-transparent md:w-6" />
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-[#c4a574]/50 to-transparent md:w-6" />

                    <motion.div
                      className="relative flex h-full flex-col items-center justify-center text-center"
                      initial={{ opacity: 0, y: 24 }}
                      animate={{
                        opacity: isOpen ? 1 : 0,
                        y: isOpen ? 0 : 24,
                      }}
                      transition={{ duration: 0.9, delay: 0.55, ease: easeLuxury }}
                    >
                      <div className="mb-3 flex items-center gap-3 text-[#6b1d2a]/70 md:mb-5 md:gap-4">
                        <span className="text-sm md:text-base">☬</span>
                        <span className="font-display text-xl md:text-3xl">ੴ</span>
                        <span className="text-sm md:text-base">☬</span>
                      </div>

                      <p className="font-body text-[9px] uppercase tracking-[0.35em] text-[#6b1d2a]/65 md:text-xs md:tracking-[0.4em]">
                        You are cordially invited
                      </p>

                      <h2 className="mt-4 font-script text-4xl leading-tight text-[#6b1d2a] sm:text-5xl md:mt-6 md:text-7xl">
                        {wedding.couple.groom.firstName}
                        <span className="mx-2 block font-display text-base tracking-[0.35em] text-[#9a7b2f] sm:inline md:mx-3 md:text-xl">
                          &
                        </span>
                        {wedding.couple.bride.firstName}
                      </h2>

                      <div className="my-5 h-px w-24 bg-gradient-to-r from-transparent via-[#9a7b2f] to-transparent md:my-7 md:w-36" />

                      <p className="font-body text-xs tracking-[0.18em] text-[#6b1d2a]/75 md:text-base md:tracking-[0.22em]">
                        12<sup>th</sup> & 13<sup>th</sup> August 2026
                      </p>
                      <p className="mt-2 font-body text-[11px] text-[#6b1d2a]/60 md:mt-3 md:text-sm">
                        Maple Garden · Buria Road, Jagadhri
                      </p>
                      <p className="mt-5 font-script text-xl text-[#9a7b2f] md:mt-7 md:text-3xl">
                        {wedding.hashtag}
                      </p>
                    </motion.div>
                  </div>

                  <ScrollRod side="bottom" />
                </motion.div>

                {/* Ribbon / seal across rolled scroll — sits in reserved padding, not over the CTA */}
                <AnimatePresence>
                  {phase === "sealed" ? (
                    <motion.button
                      type="button"
                      aria-label="Unroll the invitation scroll"
                      onClick={handleOpen}
                      className="absolute left-1/2 top-[34px] z-30 flex -translate-x-1/2 flex-col items-center focus:outline-none md:top-[46px]"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.6, y: 24 }}
                      transition={{ duration: 0.45 }}
                    >
                      <span className="mb-2 h-8 w-[2px] bg-gradient-to-b from-transparent via-[#8b1e2d] to-[#8b1e2d] md:h-10" />
                      <motion.span
                        className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full md:h-24 md:w-24"
                        whileHover={{ scale: 1.06 }}
                        whileTap={{ scale: 0.96 }}
                        animate={{ y: [0, -3, 0] }}
                        transition={{ duration: 2.6, repeat: Infinity }}
                      >
                        <span className="absolute inset-0 rounded-full bg-gradient-to-br from-[#8b1e2d] via-[#6b1d2a] to-[#3f1018] shadow-[0_8px_28px_rgba(107,29,42,0.55)]" />
                        <span className="absolute inset-[3px] rounded-full border border-gold/45" />
                        <span className="relative font-script text-2xl text-gold-soft md:text-4xl">
                          S
                        </span>
                        <motion.span
                          className="pointer-events-none absolute inset-0 rounded-full bg-gold/20"
                          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
                          transition={{ duration: 2.6, repeat: Infinity }}
                        />
                      </motion.span>
                    </motion.button>
                  ) : null}
                </AnimatePresence>

                {/* Seal burst particles */}
                <AnimatePresence>
                  {isOpen ? (
                    <>
                      {Array.from({ length: 10 }).map((_, i) => (
                        <motion.span
                          key={i}
                          className="pointer-events-none absolute left-1/2 top-10 z-50 h-2 w-2 rounded-full bg-[#6b1d2a]"
                          initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                          animate={{
                            opacity: 0,
                            x: Math.cos((i / 10) * Math.PI * 2) * 80,
                            y: Math.sin((i / 10) * Math.PI * 2) * 40 + 10,
                            scale: 0.15,
                          }}
                          transition={{ duration: 0.75, ease: "easeOut" }}
                        />
                      ))}
                    </>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            </div>

            <AnimatePresence mode="wait">
              {phase === "sealed" ? (
                <motion.div
                  key="cta"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.55, delay: 0.2 }}
                  className="mt-8 text-center md:mt-10"
                >
                  <p className="font-body text-[11px] tracking-[0.28em] text-muted md:text-sm">
                    Break the seal to unroll
                  </p>
                  <motion.button
                    type="button"
                    onClick={handleOpen}
                    disabled={busy}
                    className="mt-5 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-gold-deep via-gold to-gold-soft px-8 py-3 font-body text-sm uppercase tracking-[0.22em] text-[#1a1208] shadow-[0_0_30px_-8px_var(--glow)] disabled:opacity-60 md:mt-6 md:px-10 md:py-3.5 md:text-base"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Unroll Invitation
                  </motion.button>
                </motion.div>
              ) : null}

              {phase === "unrolling" ? (
                <motion.p
                  key="unrolling"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-12 font-body text-[11px] uppercase tracking-[0.35em] text-gold/70 md:mt-14 md:text-sm"
                >
                  Unrolling your invitation…
                </motion.p>
              ) : null}

              {phase === "revealed" || phase === "exiting" ? (
                <motion.p
                  key="welcome"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: phase === "exiting" ? 0 : 1, y: 0 }}
                  className="mt-12 font-script text-2xl text-gold-soft md:mt-14 md:text-4xl"
                >
                  Welcome to our celebration
                </motion.p>
              ) : null}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
