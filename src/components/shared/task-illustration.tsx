import {
  Brush,
  Smile,
  Moon,
  BookOpen,
  HeartPulse,
  HandHeart,
  Calculator,
  FlaskConical,
  BookText,
  Languages,
  Globe,
  Star,
  Sparkles,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { findTaskCategory } from "@/lib/constants";
import type { TaskType } from "@/lib/supabase/types";

const ICON_MAP: Record<string, LucideIcon> = {
  Brush,
  Smile,
  Moon,
  BookOpen,
  HeartPulse,
  HandHeart,
  Calculator,
  FlaskConical,
  BookText,
  Languages,
  Globe,
  Star,
};

/**
 * Ilustrasi default berdasarkan kategori task/tugas, dipakai saat task
 * dipublikasikan tanpa gambar AI (image_url kosong).
 */
export function TaskIllustration({
  type,
  category,
  className,
  iconClassName,
}: {
  type: TaskType;
  category?: string | null;
  className?: string;
  iconClassName?: string;
}) {
  const cat = findTaskCategory(type, category);
  const Icon = (cat && ICON_MAP[cat.icon]) || (type === "tugas" ? ListChecks : Sparkles);
  const gradient = cat?.gradient ?? (type === "tugas" ? "from-accent-light to-accent/30" : "from-primary/20 to-primary/40");

  return (
    <div className={cn("flex items-center justify-center bg-gradient-to-br", gradient, className)}>
      <Icon className={cn("text-white drop-shadow", iconClassName ?? "w-1/2 h-1/2")} />
    </div>
  );
}
