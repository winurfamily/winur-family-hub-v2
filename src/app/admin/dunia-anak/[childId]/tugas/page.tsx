import { notFound } from "next/navigation";
import { getChildOverview } from "@/app/actions/anak-overview";
import { getTaskHistory } from "@/app/actions/anak-tasks";
import { getFamilySettings } from "@/app/actions/anak-settings";
import { currentMonth } from "@/lib/finance";
import { GenerateTaskPanel } from "../_components/generate-task-panel";
import { TaskHistory } from "../_components/task-history";
import { TodayTaskCard } from "../_components/today-task-card";

export default async function ChildTugasPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const month = currentMonth();
  const [overview, history, familySettings] = await Promise.all([
    getChildOverview(childId),
    getTaskHistory(childId, month),
    getFamilySettings(),
  ]);

  if (!overview) notFound();

  const taskCount = overview.todayTasks.filter((t) => t.type === "task" && t.status !== "skipped").length;
  const tugasCount = overview.todayTasks.filter((t) => t.type === "tugas" && t.status !== "skipped").length;

  return (
    <div className="space-y-4">
      <GenerateTaskPanel childId={childId} taskCount={taskCount} tugasCount={tugasCount} rewardDefaults={familySettings} />

      {overview.todayTasks.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-heading font-extrabold text-ink-1">Task & Tugas Hari Ini</h2>
          <div className="space-y-3">
            {overview.todayTasks.map((task) => (
              <TodayTaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}

      <TaskHistory childId={childId} initialMonth={month} initialData={history} />
    </div>
  );
}
