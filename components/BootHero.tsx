"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Landing from "@/components/landing/Landing";
import { PERSONAS } from "@/lib/personas";

const SPECIALISTS = Object.values(PERSONAS)
  .filter((p) => p.callsign !== "INV")
  .sort((a, b) => a.order - b.order);

const BOOT_LINES = [
  "meridian v1 · booting",
  `loading specialists … [ ${SPECIALISTS.map((p) => p.callsign).join(" ")} ] ${SPECIALISTS.length} online`,
  "the investor … standby",
  "ready",
];

export default function BootHero() {
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setBooted(true);
      return;
    }
    const t = setTimeout(() => setBooted(true), BOOT_LINES.length * 520 + 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence mode="wait">
      {!booted ? (
        <motion.main
          key="boot"
          className="flex flex-1 flex-col items-center justify-center px-6 py-20"
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
        >
          <div className="mono w-full max-w-lg text-left text-sm">
            {BOOT_LINES.map((line, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.52, duration: 0.25 }}
                className={i === BOOT_LINES.length - 1 ? "text-accent" : "text-muted"}
              >
                <span className="text-accent">&gt;</span> {line}
                {i === BOOT_LINES.length - 1 && <span className="cursor" />}
              </motion.p>
            ))}
            <button
              onClick={() => setBooted(true)}
              className="mt-6 text-xs text-muted underline-offset-4 hover:text-foreground hover:underline"
            >
              skip ↵
            </button>
          </div>
        </motion.main>
      ) : (
        <motion.div
          key="landing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-1 flex-col"
        >
          <Landing />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
