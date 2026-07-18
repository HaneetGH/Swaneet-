"use client";

import { AnimatePresence, motion } from "framer-motion";
import { wedding } from "@/data/wedding";
import { Button } from "./Button";

type OpenInvitationProps = {
  open: boolean;
  onOpen: () => void;
};

export function OpenInvitation({ open, onOpen }: OpenInvitationProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-[#07060a]"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
        >
          <motion.div
            className="pointer-events-none absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-gold/10 blur-[100px]" />
            <div className="absolute bottom-1/4 left-1/4 h-56 w-56 rounded-full bg-maroon/20 blur-[90px]" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.05, filter: "blur(8px)" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 mx-6 max-w-lg text-center"
          >
            <p className="mb-6 font-body text-[10px] uppercase tracking-[0.45em] text-gold/70">
              You are cordially invited
            </p>
            <h2 className="font-script text-5xl leading-tight text-gold-soft sm:text-6xl">
              {wedding.couple.groom.firstName}
              <span className="mx-3 block font-display text-xl tracking-[0.4em] text-gold/50 sm:inline sm:text-2xl">
                &
              </span>
              {wedding.couple.bride.firstName}
            </h2>
            <p className="mt-6 font-body text-sm tracking-wide text-muted">
              12<sup>th</sup> & 13<sup>th</sup> August 2026 · Jagadhri
            </p>
            <div className="mt-10">
              <Button onClick={onOpen} aria-label="Open the invitation">
                Open Invitation
              </Button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
