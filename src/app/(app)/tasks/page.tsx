import { Suspense } from "react";
import TasksListClient from "./_components/TasksListClient";
import { listTasksWithFiltersAction } from "@/server/actions/userActions";
import type { EnrichedTask } from "@/server/actions/userActions";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  let tasks: EnrichedTask[] = [];
  try {
    const res = await listTasksWithFiltersAction({ type: "all", sort: "newest", status: "all" });
    if (res && res.ok) {
      tasks = res.tasks;
    }
  } catch {
    tasks = [];
  }

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12 text-sm text-white/60">
        Loading tasks…
      </div>
    }>
      <TasksListClient initialTasks={tasks} />
    </Suspense>
  );
}
