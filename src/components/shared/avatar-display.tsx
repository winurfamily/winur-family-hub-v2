"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { colorForName } from "@/lib/avatar-color";

interface AvatarDisplayProps {
  src?: string | null;
  name: string;
  color?: string;
  size?: number;
  className?: string;
}

/**
 * Avatar dengan fallback CSS (lingkaran warna + inisial) jika
 * gambar avatar/PNG belum tersedia atau gagal dimuat.
 */
export function AvatarDisplay({ src, name, color, size = 80, className }: AvatarDisplayProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src as string}
        alt={name}
        onError={() => setFailed(true)}
        className={cn("rounded-full object-cover border-2 border-border bg-white", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-heading font-extrabold text-white border-2 border-border shrink-0",
        className
      )}
      style={{ width: size, height: size, backgroundColor: color ?? colorForName(name), fontSize: size * 0.4 }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
