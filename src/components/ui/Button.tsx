"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type ButtonProps = HTMLMotionProps<"button"> & {
  variant?: "primary" | "ghost" | "outline";
};

export function Button({
  className,
  variant = "primary",
  children,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-7 py-3 font-body text-sm tracking-[0.18em] uppercase transition-colors duration-300",
        variant === "primary" &&
          "bg-gradient-to-r from-gold-deep via-gold to-gold-soft text-[#1a1208] shadow-[0_0_30px_-8px_var(--glow)]",
        variant === "ghost" && "bg-white/5 text-cream hover:bg-white/10",
        variant === "outline" &&
          "border border-gold/40 text-gold-soft hover:bg-gold/10",
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
