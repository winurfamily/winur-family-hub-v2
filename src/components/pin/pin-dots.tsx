"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PinDotsProps {
  length: number;
  filled: number;
  shake?: boolean;
}

export function PinDots({ length, filled, shake }: PinDotsProps) {
  return (
    <motion.div
      className="flex justify-center gap-3 my-4"
      animate={shake ? { x: [0, -8, 8, -8, 8, 0] } : {}}
      transition={{ duration: 0.4 }}
    >
      {Array.from({ length }).map((_, i) => {
        const isFilled = i < filled;
        return (
          <motion.div
            key={i}
            className={cn(
              "w-[18px] h-[18px] rounded-full border-2 border-border bg-white",
              isFilled && "bg-accent border-accent shadow-[0_0_0_4px_rgba(124,58,237,0.2)]"
            )}
            animate={isFilled ? { scale: [1, 1.15, 1] } : { scale: 1 }}
            transition={{ duration: 0.2 }}
          />
        );
      })}
    </motion.div>
  );
}
