"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type GlassCardProps = Omit<HTMLMotionProps<"div">, "children"> & {
  glow?: boolean;
  children: ReactNode;
};

export function GlassCard({
  className,
  children,
  glow = false,
  ...props
}: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.35 } }}
      className={cn(
        "glass gold-border relative overflow-hidden rounded-2xl p-6 md:p-8",
        glow && "shadow-[0_0_40px_-12px_var(--glow)]",
        className,
      )}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gold/10 via-transparent to-maroon/10" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
