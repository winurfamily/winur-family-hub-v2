"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { soundManager } from "@/lib/sound/sound-manager";

const gameButtonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl font-heading font-bold transition-all duration-100 ease-out select-none disabled:pointer-events-none disabled:opacity-50 active:translate-y-[3px] min-h-12",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-btn-primary active:shadow-btn-primary-pressed",
        secondary: "bg-secondary text-secondary-foreground shadow-btn-secondary active:shadow-btn-secondary-pressed",
        accent: "bg-accent text-accent-foreground shadow-btn-accent active:shadow-btn-accent-pressed",
        yellow: "bg-yellow text-ink-1 shadow-btn-yellow active:shadow-btn-yellow-pressed",
        outline: "bg-card text-ink-2 border-2 border-border shadow-btn-outline active:shadow-btn-outline-pressed",
      },
      size: {
        default: "px-7 py-3.5 text-base",
        sm: "px-4 py-2 text-sm rounded-xl min-h-10",
        lg: "px-8 py-4 text-lg",
        icon: "h-12 w-12 rounded-xl",
      },
      block: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
      block: false,
    },
  }
);

export interface GameButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof gameButtonVariants> {
  asChild?: boolean;
  playSound?: boolean;
}

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

const GameButton = React.forwardRef<HTMLButtonElement, GameButtonProps>(
  ({ className, variant, size, block, asChild = false, playSound = true, onClick, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const [ripples, setRipples] = React.useState<Ripple[]>([]);
    const rippleId = React.useRef(0);

    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
      if (playSound) soundManager.play("tap");
      if (!asChild) {
        const rect = e.currentTarget.getBoundingClientRect();
        const rippleSize = Math.max(rect.width, rect.height) * 1.4;
        const id = rippleId.current++;
        setRipples((prev) => [
          ...prev,
          {
            id,
            x: e.clientX - rect.left - rippleSize / 2,
            y: e.clientY - rect.top - rippleSize / 2,
            size: rippleSize,
          },
        ]);
      }
      onClick?.(e);
    };

    return (
      <Comp
        className={cn(gameButtonVariants({ variant, size, block, className }))}
        ref={ref}
        onClick={handleClick}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
              {ripples.map((r) => (
                <span
                  key={r.id}
                  className="absolute rounded-full bg-white/40 animate-ripple"
                  style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
                  onAnimationEnd={() => setRipples((prev) => prev.filter((p) => p.id !== r.id))}
                />
              ))}
            </span>
            {children}
          </>
        )}
      </Comp>
    );
  }
);
GameButton.displayName = "GameButton";

export { GameButton, gameButtonVariants };
