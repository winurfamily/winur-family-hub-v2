"use client";

import { useEffect, useState, useTransition } from "react";
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

  const allAnswered = questions.length > 0 && answers.length === questions.length && answers.every((a) => a >= 0);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setAnswers(Array(questions.length).fill(-1));
  }, [open, task.id, questions.length]);

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
      <DialogContent className="glass-strong flex max-h-[min(92dvh,720px)] w-[calc(100vw-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0 sm:rounded-3xl">
        <DialogHeader className="shrink-0 border-b border-white/20 px-4 pb-3 pt-4 pr-12 sm:px-6 sm:pt-5">
          <DialogTitle className="font-heading text-ink-1">📘 {task.title}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch] [touch-action:pan-y] sm:px-6">
          {!result ? (
            questions.length === 0 ? (
              <div className="glass-soft rounded-xl p-4 text-center text-sm font-bold text-ink-2">
                Soal belum tersedia. Coba tutup lalu buka lagi.
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((q, qi) => (
                  <div key={qi} className="glass-soft rounded-xl p-3">
                    <p className="mb-2 break-words font-heading text-sm font-bold text-ink-1">
                      {qi + 1}. {q.question}
                    </p>
                    <div className="space-y-1.5">
                      {q.options.map((opt, oi) => (
                        <button
                          key={oi}
                          type="button"
                          onClick={() => handleSelect(qi, oi)}
                          className={cn(
                            "flex w-full items-start gap-2 rounded-xl border-2 px-3 py-2 text-left text-sm font-bold transition-colors",
                            answers[qi] === oi
                              ? "border-accent bg-accent/10 text-accent"
                              : "border-transparent bg-white/10 text-ink-2"
                          )}
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-current text-[10px]">
                            {OPTION_LABELS[oi]}
                          </span>
                          <span className="min-w-0 flex-1 whitespace-normal break-words">{opt}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
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
                    <p className="mb-1 break-words font-heading text-sm font-bold text-ink-1">
                      {qi + 1}. {q.question}{" "}
                      <span className={correct ? "text-secondary" : "text-destructive"}>{correct ? "✓" : "✗"}</span>
                    </p>
                    <p className="text-xs text-ink-2">
                      Jawaban benar:{" "}
                      <span className="font-bold text-secondary">
                        {OPTION_LABELS[q.correct_answer]}. {q.options[q.correct_answer]}
                      </span>
                    </p>
                    {q.explanation && <p className="mt-1 break-words text-xs text-ink-3">{q.explanation}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-white/20 px-4 py-4 sm:px-6">
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
