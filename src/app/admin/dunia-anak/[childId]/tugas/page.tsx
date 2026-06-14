import { notFound } from "next/navigation";
import { getChildOverview } from "@/app/actions/anak-overview";
import { getTaskHistory } from "@/app/actions/anak-tasks";
import { getFamilySettings } from "@/app/actions/anak-settings";
import { currentMonth } from "@/lib/finance";
import { TaskHistory } from "../_components/task-history";
import { TugasTabContent } from "../_components/tugas-tab-content";

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
      <TugasTabContent
        childId={childId}
        initialTasks={overview.todayTasks}
        taskCount={taskCount}
        tugasCount={tugasCount}
        rewardDefaults={familySettings}
      />

      <TaskHistory childId={childId} initialMonth={month} initialData={history} />
    </div>
  );
}
