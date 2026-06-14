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
import { generateTaskDraft, publishTask, getTaskCountsForDate, type TaskDraft } from "@/app/actions/anak-tasks";
import type { TugasQuestionInput, FamilySettingsInput } from "@/lib/validation/dunia-anak";
import { REWARD, getTaskCategories } from "@/lib/constants";
import { todayISODate, formatDate } from "@/lib/format";

function emptyQuestions(): TugasQuestionInput[] {
  return Array.from({ length: 5 }, () => ({
    question: "",
    options: ["", "", "", ""] as [string, string, string, string],
    correct_answer: 0,
    explanation: "",
  }));
}

export function GenerateTaskPanel({
  childId,
  taskCount,
  tugasCount,
  rewardDefaults,
  dayDate,
  onDateChange,
  onPublished,
}: {
  childId: string;
  taskCount: number;
  tugasCount: number;
  rewardDefaults: FamilySettingsInput | null;
  dayDate: string;
  onDateChange: (date: string) => void;
  onPublished?: () => void;
}) {
  const router = useRouter();
  const today = todayISODate();
  const [counts, setCounts] = useState({ taskCount, tugasCount });
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
  const [isLoadingCounts, startCounts] = useTransition();

  const taskMax = counts.taskCount >= REWARD.MAX_TASK_PER_DAY;
  const tugasMax = counts.tugasCount >= REWARD.MAX_TUGAS_PER_DAY;

  const handleDateChange = (value: string) => {
    onDateChange(value);
    if (value === today) {
      setCounts({ taskCount, tugasCount });
      return;
    }
    startCounts(async () => {
      const result = await getTaskCountsForDate(childId, value);
      setCounts(result);
    });
  };

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

  const handleManual = () => {
    if (!type || !category) return;
    const money =
      type === "task" ? rewardDefaults?.defaultTaskMoney ?? REWARD.TASK_MONEY : rewardDefaults?.defaultTugasMoney ?? REWARD.TUGAS_MONEY;
    const point =
      type === "task" ? rewardDefaults?.defaultTaskPoint ?? REWARD.TASK_POINT : rewardDefaults?.defaultTugasPoint ?? REWARD.TUGAS_POINT;
    const xp = type === "task" ? rewardDefaults?.defaultTaskXp ?? REWARD.TASK_XP : rewardDefaults?.defaultTugasXp ?? REWARD.TUGAS_XP;
    const initialQuestions = type === "tugas" ? emptyQuestions() : [];

    setDraft({
      title: "",
      description: "",
      imageUrl: null,
      category,
      rewardMoney: money,
      rewardPoint: point,
      rewardXp: xp,
      questions: initialQuestions,
    });
    setTitle("");
    setDescription("");
    setRewardMoney(money);
    setRewardPoint(point);
    setRewardXp(xp);
    setQuestions(initialQuestions);
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

    if (title.trim().length < 2) {
      toast.error("Judul minimal 2 karakter.");
      return;
    }

    if (type === "tugas") {
      const isIncomplete = questions.some((q) => !q.question.trim() || q.options.some((opt) => !opt.trim()));
      if (questions.length !== 5 || isIncomplete) {
        toast.error("Lengkapi 5 soal dan semua pilihan jawaban.");
        return;
      }
    }

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
        dayDate,
      });

      if (!res.success) {
        toast.error(res.error ?? "Gagal mempublikasikan.");
        return;
      }

      const label = type === "tugas" ? "Tugas" : "Task";
      const dateLabel = dayDate === today ? "" : ` untuk ${formatDate(dayDate)}`;
      toast.success(`${label} berhasil dipublikasikan${dateLabel}.`);
      setCounts((prev) =>
        type === "task" ? { ...prev, taskCount: prev.taskCount + 1 } : { ...prev, tugasCount: prev.tugasCount + 1 }
      );
      reset();
      router.refresh();
      onPublished?.();
    });
  };

  const categories = type ? getTaskCategories(type) : [];

  return (
    <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4 space-y-3">
      <h2 className="font-heading font-extrabold text-ink-1 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-accent" /> Tambah Task & Tugas
      </h2>

      {!draft && (
        <div className="space-y-1">
          <Label>Tanggal</Label>
          <Input type="date" value={dayDate} onChange={(e) => handleDateChange(e.target.value)} disabled={!!type} />
          <p className="text-xs text-ink-3">
            {isLoadingCounts
              ? "Memuat jumlah task..."
              : dayDate === today
                ? "Task & tugas akan tampil hari ini."
                : `Task & tugas akan tampil pada ${formatDate(dayDate)}.`}
          </p>
        </div>
      )}

      {!type && !draft && (
        <div className="grid grid-cols-2 gap-2">
          <GameButton type="button" variant="primary" disabled={taskMax || isLoadingCounts} onClick={() => selectType("task")}>
            {`Task (${counts.taskCount}/${REWARD.MAX_TASK_PER_DAY})`}
          </GameButton>
          <GameButton type="button" variant="accent" disabled={tugasMax || isLoadingCounts} onClick={() => selectType("tugas")}>
            {`Tugas (${counts.tugasCount}/${REWARD.MAX_TUGAS_PER_DAY})`}
          </GameButton>
        </div>
      )}

      {(taskMax || tugasMax) && !type && !draft && (
        <p className="text-xs text-ink-3">
          {taskMax && "Task pada tanggal ini sudah maksimal. "}
          {tugasMax && "Tugas pada tanggal ini sudah maksimal."}
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
            <GameButton type="button" variant="yellow" onClick={handleManual} disabled={isGenerating}>
              Isi Manual
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
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Judul ${type === "tugas" ? "tugas" : "task"}`} />
          </div>

          <div className="space-y-1">
            <Label>Deskripsi</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Instruksi singkat untuk anak"
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
                  <Input
                    value={q.question}
                    onChange={(e) => updateQuestion(qi, { question: e.target.value })}
                    placeholder="Tulis pertanyaan"
                  />
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${qi}`}
                        checked={q.correct_answer === oi}
                        onChange={() => updateQuestion(qi, { correct_answer: oi })}
                        className="shrink-0 accent-secondary"
                      />
                      <Input
                        value={opt}
                        onChange={(e) => updateOption(qi, oi, e.target.value)}
                        placeholder={`Pilihan ${String.fromCharCode(65 + oi)} (pilih radio jika benar)`}
                      />
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
