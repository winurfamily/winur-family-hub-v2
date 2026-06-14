"use client";

import { useState, useTransition } from "react";
import { GenerateTaskPanel } from "./generate-task-panel";
import { TodayTaskCard } from "./today-task-card";
import { getTasksForDate } from "@/app/actions/anak-tasks";
import type { TaskOverviewItem } from "@/app/actions/anak-overview";
import type { FamilySettingsInput } from "@/lib/validation/dunia-anak";
import { todayISODate, formatDate } from "@/lib/format";

export function TugasTabContent({
  childId,
  initialTasks,
  taskCount,
  tugasCount,
  rewardDefaults,
}: {
  childId: string;
  initialTasks: TaskOverviewItem[];
  taskCount: number;
  tugasCount: number;
  rewardDefaults: FamilySettingsInput | null;
}) {
  const today = todayISODate();
  const [dayDate, setDayDate] = useState(today);
  const [tasks, setTasks] = useState(initialTasks);
  const [isLoadingTasks, startLoadingTasks] = useTransition();

  const reloadTasks = (date: string) => {
    startLoadingTasks(async () => {
      const result = await getTasksForDate(childId, date);
      setTasks(result);
    });
  };

  const handleDateChange = (value: string) => {
    setDayDate(value);
    reloadTasks(value);
  };

  return (
    <>
      <GenerateTaskPanel
        childId={childId}
        taskCount={taskCount}
        tugasCount={tugasCount}
        rewardDefaults={rewardDefaults}
        dayDate={dayDate}
        onDateChange={handleDateChange}
        onPublished={() => reloadTasks(dayDate)}
      />

      <div className="space-y-2">
        <h2 className="font-heading font-extrabold text-ink-1">
          {dayDate === today ? "Task & Tugas Hari Ini" : `Task & Tugas ${formatDate(dayDate)}`}
        </h2>
        {isLoadingTasks ? (
          <p className="text-sm text-ink-2 text-center py-4">Memuat...</p>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-ink-2 text-center py-4">Belum ada task & tugas untuk tanggal ini.</p>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <TodayTaskCard key={task.id} task={task} onChanged={() => reloadTasks(dayDate)} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
