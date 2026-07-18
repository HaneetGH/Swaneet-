"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Music2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type MusicToggleProps = {
  className?: string;
};

export function MusicToggle({ className }: MusicToggleProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    const audio = new Audio("/audio/wedding-ambient.mp3");
    audio.loop = true;
    audio.volume = 0.35;
    audio.preload = "auto";
    audioRef.current = audio;

    const onError = () => setAvailable(false);
    audio.addEventListener("error", onError);

    return () => {
      audio.pause();
      audio.removeEventListener("error", onError);
      audioRef.current = null;
    };
  }, []);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio || !available) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }

    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setAvailable(false);
    }
  };

  return (
    <>
      <motion.button
        type="button"
        onClick={toggle}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        aria-label={playing ? "Mute background music" : "Play background music"}
        aria-pressed={playing}
        className={cn(
          "glass gold-border flex h-12 w-12 items-center justify-center rounded-full text-gold-soft",
          !available && "opacity-50",
          className,
        )}
        title={
          available
            ? playing
              ? "Mute music"
              : "Play music"
            : "Add audio at /public/audio/wedding-ambient.mp3"
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={playing ? "on" : "off"}
            initial={{ opacity: 0, rotate: -20 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, rotate: 20 }}
            transition={{ duration: 0.2 }}
          >
            {playing ? <Music2 size={18} /> : <VolumeX size={18} />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </>
  );
}
