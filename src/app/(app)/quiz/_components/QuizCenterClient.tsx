"use client";

import { useState } from "react";
import Link from "next/link";
import {
  HelpCircle,
  Trophy,
  Play,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { useToast } from "@/components/ui/Toast";
import { formatAPN, formatDateTime } from "@/lib/utils";
import type { QuizSummary } from "@/server/actions/userActions";
import QuizFlowRenderer from "./QuizFlowRenderer";

export default function QuizCenterClient({ initialQuizzes }: { initialQuizzes: QuizSummary[] }) {
  const toast = useToast();
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);

  if (activeQuizId) {
    return (
      <QuizFlowRenderer
        quizId={activeQuizId}
        onExit={() => setActiveQuizId(null)}
      />
    );
  }

  const totalReward = initialQuizzes.reduce((s, q) => s + q.reward, 0);
  const available = initialQuizzes.filter((q) => q.state === "available").length;
  const completed = initialQuizzes.filter((q) => q.state === "completed").length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <HelpCircle size={22} className="text-apron-gold" /> Daily Quiz Center
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Complete quizzes to earn APN rewards. Each quiz can be attempted once per 24 hours.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Quizzes" value={initialQuizzes.length} icon={HelpCircle} />
        <StatCard label="Available" value={available} icon={Play} iconColor="text-apron-gold" />
        <StatCard label="Completed (24h)" value={completed} icon={CheckCircle2} iconColor="text-emerald-300" />
        <StatCard label="Reward pool" value={formatAPN(totalReward)} icon={Trophy} iconColor="text-apron-pink" />
      </div>

      {initialQuizzes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-white/70">
            <AlertCircle className="mx-auto mb-2 text-white/50" size={20} />
            No quizzes are available right now. Check back later!
            <div className="mt-3 flex justify-center">
              <Link href="/tasks">
                <Button variant="outline" size="sm">
                  Browse other tasks
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {initialQuizzes.map((q) => (
            <QuizListRow
              key={q.id}
              quiz={q}
              onStart={() => setActiveQuizId(q.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QuizListRow({ quiz, onStart }: { quiz: QuizSummary; onStart: () => void }) {
  const toast = useToast();
  const disabled = quiz.state === "cooldown" || quiz.state === "completed";
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-white/70">
              <HelpCircle size={11} /> Quiz
            </span>
            {quiz.state === "completed" ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
                <CheckCircle2 size={11} /> Completed
                {typeof quiz.lastScore === "number" && ` · ${quiz.lastScore}`}
              </span>
            ) : quiz.state === "cooldown" ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-200">
                <Clock size={11} /> On cooldown
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-apron-gold/30 bg-apron-gold/10 px-2 py-0.5 text-[11px] font-medium text-apron-gold">
                <Play size={11} /> Ready
              </span>
            )}
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/60">
              {quiz.questionCount} Qs
            </span>
          </div>
          <CardTitle className="mt-2 text-base">{quiz.title}</CardTitle>
          {quiz.description ? (
            <p className="mt-1 text-sm text-white/60">{quiz.description}</p>
          ) : null}
          {quiz.cooldownUntil && quiz.state !== "available" ? (
            <p className="mt-2 text-[11px] text-white/50">
              Next attempt: {formatDateTime(quiz.cooldownUntil)}
            </p>
          ) : null}
          {quiz.expiresAt ? (
            <p className="mt-1 text-[11px] text-white/50">
              Expires: {formatDateTime(quiz.expiresAt)}
            </p>
          ) : null}
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-white/60">Reward</div>
          <div className="text-lg font-semibold text-gradient-gold">
            +{formatAPN(quiz.reward)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Button
          className="w-full"
          disabled={disabled}
          onClick={onStart}
          aria-label={`Start quiz ${quiz.title}`}
        >
          {quiz.state === "completed" ? "View result (disabled)" : quiz.state === "cooldown" ? "Cooldown" : "Start quiz"}
        </Button>
      </CardContent>
    </Card>
  );
}
