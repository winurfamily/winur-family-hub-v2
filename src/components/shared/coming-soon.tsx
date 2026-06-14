import { Sparkles } from "lucide-react";

interface ComingSoonProps {
  title: string;
  sprint: string;
}

export function ComingSoon({ title, sprint }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 rounded-2xl border-2 border-border bg-card shadow-card p-8 mt-6">
      <div className="w-14 h-14 rounded-full bg-accent-light flex items-center justify-center">
        <Sparkles className="w-7 h-7 text-accent" />
      </div>
      <h2 className="font-heading font-extrabold text-xl text-ink-1">{title}</h2>
      <p className="text-sm text-ink-2">Halaman ini akan dibangun di {sprint}.</p>
    </div>
  );
}
