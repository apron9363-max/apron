import { Suspense } from "react";
import QuizCenterClient from "./_components/QuizCenterClient";
import { listQuizzesAction } from "@/server/actions/userActions";
import type { QuizSummary } from "@/server/actions/userActions";

export const dynamic = "force-dynamic";

export default async function QuizPage() {
  let quizzes: QuizSummary[] = [];
  try {
    const res = await listQuizzesAction({});
    if (res && res.ok) {
      quizzes = res.quizzes;
    }
  } catch {
    quizzes = [];
  }

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12 text-sm text-white/60">
        Loading quizzes…
      </div>
    }>
      <QuizCenterClient initialQuizzes={quizzes} />
    </Suspense>
  );
}
