"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  className?: string;
  align?: "left" | "center";
};

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  className,
  align = "center",
}: SectionHeadingProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "mb-12 md:mb-16",
        align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl text-left",
        className,
      )}
    >
      {eyebrow ? (
        <p className="mb-3 font-body text-xs uppercase tracking-[0.35em] text-gold-soft/80">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="font-display text-3xl tracking-wide text-cream sm:text-4xl md:text-5xl">
        <span className="gradient-text animate-shimmer">{title}</span>
      </h2>
      <div
        className={cn(
          "mt-5 h-px w-24 bg-gradient-to-r from-transparent via-gold to-transparent",
          align === "center" && "mx-auto",
        )}
      />
      {subtitle ? (
        <p className="mt-5 font-body text-base leading-relaxed text-muted md:text-lg">
          {subtitle}
        </p>
      ) : null}
    </motion.div>
  );
}
