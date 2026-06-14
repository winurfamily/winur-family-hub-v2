"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, ListChecks, ImageIcon } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskIllustration } from "@/components/shared/task-illustration";
import { generateTaskDraft, publishTask, type TaskDraft } from "@/app/actions/anak-tasks";
import type { TugasQuestionInput } from "@/lib/validation/dunia-anak";
import { REWARD, getTaskCategories } from "@/lib/constants";

export function GenerateTaskPanel({
  childId,
  taskCount,
  tugasCount,
}: {
  childId: string;
  taskCount: number;
  tugasCount: number;
}) {
  const router = useRouter();
  const [type, setType] = useState<"task" | "tugas" | null>(null);
  const [category, setCategory] = useState<string>("");
  const [useAiImage, setUseAiImage] = useState(true);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rewardMoney, setRewardMoney] = useState(0);
  const [rewardPoint, setRewardPoint] = useState(0);
  const [rewardXp, setRewardXp] = useState(0);
  const [questions, setQuestions] = useState<TugasQuestionInput[]>([]);
  const [isGenerating, startGenerate] = useTransition();
  const [isPublishing, startPublish] = useTransition();

  const taskMax = taskCount >= REWARD.MAX_TASK_PER_DAY;
  const tugasMax = tugasCount >= REWARD.MAX_TUGAS_PER_DAY;

  const reset = () => {
    setType(null);
    setCategory("");
    setUseAiImage(true);
    setDraft(null);
    setTitle("");
    setDescription("");
    setQuestions([]);
  };

  const selectType = (genType: "task" | "tugas") => {
    setType(genType);
    setCategory(getTaskCategories(genType)[0].value);
  };

  const handleGenerate = () => {
    if (!type || !category) return;
    startGenerate(async () => {
      const res = await generateTaskDraft(childId, type, category, useAiImage);
      if (!res.success || !res.draft) {
        toast.error(res.error ?? "Gagal generate dari AI.");
        return;
      }
      setDraft(res.draft);
      setTitle(res.draft.title);
      setDescription(res.draft.description);
      setRewardMoney(res.draft.rewardMoney);
      setRewardPoint(res.draft.rewardPoint);
      setRewardXp(res.draft.rewardXp);
      setQuestions(res.draft.questions ?? []);
    });
  };

  const updateQuestion = (index: number, patch: Partial<TugasQuestionInput>) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        const options = [...q.options] as [string, string, string, string];
        options[oIndex] = value;
        return { ...q, options };
      })
    );
  };

  const handlePublish = () => {
    if (!type || !draft) return;
    startPublish(async () => {
      const res = await publishTask({
        childId,
        type,
        title,
        description,
        imageUrl: draft.imageUrl ?? undefined,
        category: draft.category,
        rewardMoney,
        rewardPoint,
        rewardXp,
        questions: type === "tugas" ? questions : undefined,
      });

      if (!res.success) {
        toast.error(res.error ?? "Gagal mempublikasikan.");
        return;
      }

      toast.success(`${type === "tugas" ? "Tugas" : "Task"} berhasil dipublikasikan.`);
      reset();
      router.refresh();
    });
  };

  const categories = type ? getTaskCategories(type) : [];

  return (
    <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4 space-y-3">
      <h2 className="font-heading font-extrabold text-ink-1 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-accent" /> Generate dengan AI
      </h2>

      {!type && !draft && (
        <div className="grid grid-cols-2 gap-2">
          <GameButton type="button" variant="primary" disabled={taskMax} onClick={() => selectType("task")}>
            {`Task (${taskCount}/${REWARD.MAX_TASK_PER_DAY})`}
          </GameButton>
          <GameButton type="button" variant="accent" disabled={tugasMax} onClick={() => selectType("tugas")}>
            {`Tugas (${tugasCount}/${REWARD.MAX_TUGAS_PER_DAY})`}
          </GameButton>
        </div>
      )}

      {(taskMax || tugasMax) && !type && !draft && (
        <p className="text-xs text-ink-3">
          {taskMax && "Task hari ini sudah maksimal. "}
          {tugasMax && "Tugas hari ini sudah maksimal."}
        </p>
      )}

      {type && !draft && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Kategori {type === "tugas" ? "Kuis" : "Tugas"}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih kategori" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-ink-3">
              AI akan membuat ide {type === "tugas" ? "kuis" : "tugas"} sesuai kategori ini, bukan acak.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-xl border-2 border-border p-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-ink-3" />
              <div>
                <p className="text-sm font-bold text-ink-1">Generate gambar dengan AI</p>
                <p className="text-xs text-ink-3">Jika tidak, dipakai ilustrasi default sesuai kategori.</p>
              </div>
            </div>
            <Switch checked={useAiImage} onCheckedChange={setUseAiImage} />
          </div>

          {!useAiImage && (
            <TaskIllustration type={type} category={category} className="w-full h-28 rounded-xl border-2 border-border" />
          )}

          <div className="flex gap-2">
            <GameButton type="button" variant="outline" onClick={reset} disabled={isGenerating}>
              Batal
            </GameButton>
            <GameButton type="button" variant="secondary" block onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? "Membuat..." : "Generate"}
            </GameButton>
          </div>
        </div>
      )}

      {draft && type && (
        <div className="space-y-3">
          {draft.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draft.imageUrl} alt={title} className="rounded-xl border-2 border-border w-full max-h-48 object-cover" />
          ) : (
            <TaskIllustration type={type} category={draft.category} className="rounded-xl border-2 border-border w-full h-32" />
          )}

          <div className="space-y-1">
            <Label>Judul</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Deskripsi</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label>Saldo (Rp)</Label>
              <Input type="number" min={0} value={rewardMoney} onChange={(e) => setRewardMoney(Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-1">
              <Label>Point</Label>
              <Input type="number" min={0} value={rewardPoint} onChange={(e) => setRewardPoint(Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-1">
              <Label>XP</Label>
              <Input type="number" min={0} value={rewardXp} onChange={(e) => setRewardXp(Number(e.target.value) || 0)} />
            </div>
          </div>

          {type === "tugas" && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <ListChecks className="w-4 h-4" /> Soal Pilihan Ganda (5)
              </Label>
              {questions.map((q, qi) => (
                <div key={qi} className="rounded-xl border-2 border-border p-3 space-y-2">
                  <p className="text-xs font-bold text-ink-3">Soal {qi + 1}</p>
                  <Input value={q.question} onChange={(e) => updateQuestion(qi, { question: e.target.value })} />
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${qi}`}
                        checked={q.correct_answer === oi}
                        onChange={() => updateQuestion(qi, { correct_answer: oi })}
                        className="shrink-0 accent-secondary"
                      />
                      <Input value={opt} onChange={(e) => updateOption(qi, oi, e.target.value)} />
                    </div>
                  ))}
                  <Input
                    value={q.explanation ?? ""}
                    placeholder="Penjelasan jawaban"
                    onChange={(e) => updateQuestion(qi, { explanation: e.target.value })}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <GameButton type="button" variant="outline" onClick={reset} disabled={isPublishing}>
              Batal
            </GameButton>
            <GameButton type="button" variant="secondary" block onClick={handlePublish} disabled={isPublishing}>
              {isPublishing ? "Mempublikasikan..." : "Publikasikan"}
            </GameButton>
          </div>
        </div>
      )}
    </div>
  );
}
