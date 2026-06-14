"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { GameButton } from "@/components/ui/game-button";
import { submitTask } from "@/app/actions/child-tasks";
import { soundManager } from "@/lib/sound/sound-manager";
import { cn } from "@/lib/utils";
import type { TaskOverviewItem } from "@/app/actions/anak-overview";

interface TugasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  childId: string;
  task: TaskOverviewItem;
}

const OPTION_LABELS = ["A", "B", "C", "D"];

/** Modal kuis Tugas: jawab semua soal pilihan ganda lalu kumpulkan untuk dinilai otomatis. */
export function TugasModal({ open, onOpenChange, childId, task }: TugasModalProps) {
  const questions = task.questions ?? [];
  const [answers, setAnswers] = useState<number[]>(() => Array(questions.length).fill(-1));
  const [result, setResult] = useState<{ score: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  const allAnswered = answers.length > 0 && answers.every((a) => a >= 0);

  const handleSelect = (qIndex: number, optIndex: number) => {
    if (result) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[qIndex] = optIndex;
      return next;
    });
  };

  const handleSubmit = () => {
    startTransition(async () => {
      const res = await submitTask(childId, task.id, answers);
      if (res.success) {
        soundManager.play("task_done");
        setResult({ score: res.score ?? 0 });
      } else {
        toast.error(res.error ?? "Gagal mengumpulkan tugas.");
      }
    });
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      setResult(null);
      setAnswers(Array(questions.length).fill(-1));
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="glass-strong max-h-[85vh] overflow-y-auto rounded-2xl border-0 sm:rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-ink-1">📘 {task.title}</DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            {questions.map((q, qi) => (
              <div key={qi} className="glass-soft rounded-xl p-3">
                <p className="mb-2 font-heading text-sm font-bold text-ink-1">
                  {qi + 1}. {q.question}
                </p>
                <div className="space-y-1.5">
                  {q.options.map((opt, oi) => (
                    <button
                      key={oi}
                      type="button"
                      onClick={() => handleSelect(qi, oi)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-sm font-bold transition-colors",
                        answers[qi] === oi
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-transparent bg-white/10 text-ink-2"
                      )}
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-current text-[10px]">
                        {OPTION_LABELS[oi]}
                      </span>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="glass-soft rounded-2xl border-2 border-secondary p-4 text-center">
              <p className="font-heading text-2xl font-extrabold text-secondary">
                {result.score}/{questions.length}
              </p>
              <p className="mt-1 text-sm font-bold text-ink-1">Tugas dikumpulkan! 🎉</p>
              <p className="mt-1 text-xs text-ink-2">Menunggu konfirmasi Ayah/Mamah untuk dapat reward.</p>
            </div>

            {questions.map((q, qi) => {
              const correct = answers[qi] === q.correct_answer;
              return (
                <div key={qi} className="glass-soft rounded-xl p-3">
                  <p className="mb-1 font-heading text-sm font-bold text-ink-1">
                    {qi + 1}. {q.question}{" "}
                    <span className={correct ? "text-secondary" : "text-destructive"}>{correct ? "✓" : "✗"}</span>
                  </p>
                  <p className="text-xs text-ink-2">
                    Jawaban benar:{" "}
                    <span className="font-bold text-secondary">
                      {OPTION_LABELS[q.correct_answer]}. {q.options[q.correct_answer]}
                    </span>
                  </p>
                  {q.explanation && <p className="mt-1 text-xs text-ink-3">{q.explanation}</p>}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <GameButton variant="accent" block disabled={!allAnswered || isPending} onClick={handleSubmit}>
              {isPending ? "Mengirim..." : "Kumpulkan Jawaban"}
            </GameButton>
          ) : (
            <GameButton variant="secondary" block onClick={() => handleClose(false)}>
              Tutup
            </GameButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
