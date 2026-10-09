"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  HelpCircle,
  Lightbulb,
  ChevronRight,
  Trophy,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowLeftRight,
  Home,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { useToast } from "@/components/ui/Toast";
import { formatAPN, cn } from "@/lib/utils";
import { completeQuizTaskAction, initiateTaskAction } from "@/server/actions/taskActions";
import { useRouter } from "next/navigation";

type PublicQuestion =
  | { type?: "mc"; question: string; options: string[] }
  | { type: "tf"; question: string; options?: ["True", "False"] }
  | { type: "match"; question: string; leftPairs: string[]; rightPairs: string[] };

export type InitiatedQuiz = {
  taskSessionToken: string;
  task: {
    id: string;
    title: string;
    reward: number;
    description?: string;
    questions: PublicQuestion[];
    questionCount: number;
  };
};

export default function QuizFlowRenderer({ quizId, onExit }: { quizId: string; onExit: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [initData, setInitData] = useState<InitiatedQuiz | null>(null);
  const [initErr, setInitErr] = useState<string | null>(null);
  const [initLoading, setInitLoading] = useState(true);

  const [step, setStep] = useState(0);
  const [mcAnswers, setMcAnswers] = useState<Record<number, number>>({});
  const [matchAnswers, setMatchAnswers] = useState<Record<number, number[]>>({});
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [feedback, setFeedback] = useState<null | {
    perQuestion: { qIndex: number; correct: boolean; feedback: string }[];
    score: number;
    total: number;
    pct: number;
    passed: boolean;
    reward: number;
    alreadyPaid: boolean;
  }>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setInitLoading(true);
    initiateTaskAction({ taskId: quizId }).then((res: any) => {
      if (cancelled) return;
      if (!res.ok) {
        setInitErr(res.error ?? "Failed to start quiz");
        toast({ title: res.error ?? "Failed to start quiz", variant: "error" });
      } else {
        setInitData(res as InitiatedQuiz);
      }
      setInitLoading(false);
    });
    return () => { cancelled = true; };
  }, [quizId, toast]);

  if (initLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-white/60">
          <Loader2 className="mx-auto mb-2 animate-spin text-apron-gold" size={20} />
          Loading quiz…
        </CardContent>
      </Card>
    );
  }

  if (initErr || !initData) {
    return (
      <Card>
        <CardContent className="space-y-3 py-8 text-center">
          <AlertCircle className="mx-auto text-red-300" size={24} />
          <div className="text-sm text-red-200">{initErr ?? "Quiz unavailable"}</div>
          <Button variant="outline" onClick={onExit}>Back to quizzes</Button>
        </CardContent>
      </Card>
    );
  }

  const qs = initData.task.questions;
  const q = qs[step];
  const total = qs.length;
  const threshold = Math.max(1, Math.ceil(total / 2));
  const isFinalStep = step + 1 >= total;
  const isLast = feedback !== null;

  function answerMC(i: number) {
    if (revealed.has(step)) return;
    setMcAnswers((m) => ({ ...m, [step]: i }));
  }

  function pickMatch(leftIdx: number, rightIdx: number) {
    if (revealed.has(step)) return;
    setMatchAnswers((m) => {
      const cur = m[step] ?? (q?.type === "match" ? q.leftPairs.map(() => -1) : []);
      const next = cur.slice();
      const existingPos = next.indexOf(rightIdx);
      if (existingPos !== -1 && existingPos !== leftIdx) next[existingPos] = -1;
      next[leftIdx] = rightIdx;
      return { ...m, [step]: next };
    });
  }

  function isAnswered(): boolean {
    if (!q) return false;
    if (q.type === "match") {
      const arr = matchAnswers[step];
      if (!arr) return false;
      return arr.length === q.leftPairs.length && arr.every((v) => typeof v === "number" && v >= 0);
    }
    return typeof mcAnswers[step] === "number";
  }

  function revealAndAdvance() {
    if (!isAnswered()) return;
    setRevealed((s) => new Set(s).add(step));
  }

  function nextQ() {
    if (!isFinalStep) {
      setStep(step + 1);
      return;
    }
    const answers = qs.map((_qq, i) => {
      const qq = qs[i];
      if (qq.type === "match") {
        return { qIndex: i, value: matchAnswers[i] ?? qq.leftPairs.map(() => -1) };
      }
      return { qIndex: i, value: typeof mcAnswers[i] === "number" ? mcAnswers[i] : -1 };
    });
    setSubmitting(true);
    completeQuizTaskAction({
      taskSessionToken: initData!.taskSessionToken,
      answers,
    } as any).then((res: any) => {
      setSubmitting(false);
      if (!res.ok) {
        toast({ title: res.error ?? "Submit failed", variant: "error" });
        setInitErr(res.error ?? "Submit failed");
        return;
      }
      setFeedback({
        perQuestion: res.feedback ?? [],
        score: res.score,
        total: res.total,
        pct: res.pct,
        passed: res.passed,
        reward: res.reward,
        alreadyPaid: res.alreadyPaid,
      });
      if (res.passed && res.reward > 0) {
        toast({ title: `Earned +${formatAPN(res.reward)} APN!`, variant: "success" });
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <HelpCircle size={22} className="text-apron-gold" /> {initData.task.title}
          </h1>
          {initData.task.description ? (
            <p className="mt-1 text-sm text-white/60">{initData.task.description}</p>
          ) : null}
          <p className="mt-1 text-xs text-white/50">
            Pass threshold: {threshold}/{total} correct
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onExit} aria-label="Exit quiz">
          Exit
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Question"
          value={`${Math.min(step + 1, total)} / ${total}`}
          icon={HelpCircle}
        />
        <StatCard
          label="Reward"
          value={formatAPN(initData.task.reward)}
          icon={Trophy}
          iconColor="text-apron-gold"
        />
      </div>

      {isLast ? (
        <FinalCard
          passed={feedback!.passed}
          score={feedback!.score}
          total={feedback!.total}
          pct={feedback!.pct}
          reward={feedback!.reward}
          alreadyPaid={feedback!.alreadyPaid}
          perQuestion={feedback!.perQuestion}
          onExit={onExit}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base leading-relaxed">
              Q{step + 1}. {q?.question}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(!q || q.type === undefined || q.type === "mc") && q && (
              <MultiChoiceStep
                options={q.options}
                picked={mcAnswers[step]}
                revealed={revealed.has(step)}
                onPick={answerMC}
              />
            )}
            {q && q.type === "tf" && (
              <TrueFalseStep
                picked={mcAnswers[step]}
                revealed={revealed.has(step)}
                onPick={answerMC}
              />
            )}
            {q && q.type === "match" && (
              <MatchStep
                leftPairs={q.leftPairs}
                rightPairs={q.rightPairs}
                mapping={matchAnswers[step] ?? q.leftPairs.map(() => -1)}
                revealed={revealed.has(step)}
                onPick={pickMatch}
              />
            )}

            {revealed.has(step) ? (
              <div className="flex justify-end">
                <Button onClick={nextQ} loading={submitting}>
                  {isFinalStep ? "Finish & submit" : "Next question"}
                  <ChevronRight size={16} />
                </Button>
              </div>
            ) : (
              <div className="flex justify-end">
                <Button onClick={revealAndAdvance} disabled={!isAnswered()}>
                  <Lightbulb size={16} /> Check answer
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MultiChoiceStep({
  options,
  picked,
  revealed,
  onPick,
}: {
  options: string[];
  picked: number | undefined;
  revealed: boolean;
  onPick: (i: number) => void;
}) {
  return (
    <div className="grid gap-2">
      {options.map((opt, i) => {
        const isPicked = picked === i;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onPick(i)}
            disabled={revealed}
            aria-label={`Option ${String.fromCharCode(65 + i)}: ${opt}`}
            className={cn(
              "w-full rounded-xl border p-3 text-left text-sm transition",
              "bg-white/5 hover:bg-white/10 disabled:cursor-not-allowed",
              revealed && isPicked
                ? "border-apron-pink/70 border-2 bg-apron-pink/15"
                : revealed
                ? "border-white/10 opacity-70"
                : isPicked
                ? "border-apron-gold/60 bg-apron-gold/10"
                : "border-white/10",
            )}
          >
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs text-white/80">
              {String.fromCharCode(65 + i)}
            </span>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function TrueFalseStep({
  picked,
  revealed,
  onPick,
}: {
  picked: number | undefined;
  revealed: boolean;
  onPick: (i: number) => void;
}) {
  const pills = [
    { idx: 0, label: "True" },
    { idx: 1, label: "False" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {pills.map(({ idx, label }) => {
        const isPicked = picked === idx;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onPick(idx)}
            disabled={revealed}
            aria-label={label}
            className={cn(
              "rounded-xl border py-5 text-center text-base font-semibold transition",
              "bg-white/5 hover:bg-white/10 disabled:cursor-not-allowed",
              revealed && isPicked
                ? "border-apron-pink/70 border-2 bg-apron-pink/15"
                : revealed
                ? "border-white/10 opacity-70"
                : isPicked
                ? "border-apron-gold/60 bg-apron-gold/10"
                : "border-white/10",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function MatchStep({
  leftPairs,
  rightPairs,
  mapping,
  revealed,
  onPick,
}: {
  leftPairs: string[];
  rightPairs: string[];
  mapping: number[];
  revealed: boolean;
  onPick: (leftIdx: number, rightIdx: number) => void;
}) {
  const [activeLeft, setActiveLeft] = useState<number | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-white/60">
        <ArrowLeftRight size={12} /> Match each item on the left to its pair on the right
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          {leftPairs.map((l, i) => {
            const matched = mapping[i] ?? -1;
            const isActive = activeLeft === i;
            return (
              <button
                key={i}
                type="button"
                disabled={revealed}
                onClick={() => !revealed && setActiveLeft(isActive ? null : i)}
                aria-label={`Left ${i + 1}: ${l}`}
                className={cn(
                  "rounded-lg border p-3 text-left text-sm transition",
                  "bg-white/5 hover:bg-white/10",
                  isActive
                    ? "border-apron-gold/70 bg-apron-gold/10"
                    : matched >= 0
                    ? "border-white/20 bg-white/10"
                    : "border-white/10",
                )}
              >
                <div className="text-[10px] uppercase tracking-wide text-white/50">
                  {i + 1}.
                </div>
                <div className="text-sm text-white">{l}</div>
                {matched >= 0 && (
                  <div className="mt-1 text-[11px] text-apron-gold/90">
                    ↔ {rightPairs[matched]}
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-2">
          {rightPairs.map((r, j) => {
            const isUsed = mapping.includes(j);
            const canClick = activeLeft !== null && !revealed && (!isUsed || mapping[activeLeft] === j);
            return (
              <button
                key={j}
                type="button"
                disabled={revealed || !canClick}
                onClick={() => {
                  if (activeLeft === null) return;
                  onPick(activeLeft, j);
                  setActiveLeft(null);
                }}
                aria-label={`Right ${j + 1}: ${r}`}
                className={cn(
                  "rounded-lg border p-3 text-left text-sm transition",
                  canClick ? "bg-white/5 hover:bg-apron-gold/10" : "bg-white/5 opacity-60",
                  "border-white/10",
                )}
              >
                <div className="text-[10px] uppercase tracking-wide text-white/50">
                  {String.fromCharCode(65 + j)}.
                </div>
                <div className="text-sm text-white">{r}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FinalCard({
  passed,
  score,
  total,
  pct,
  reward,
  alreadyPaid,
  perQuestion,
  onExit,
}: {
  passed: boolean;
  score: number;
  total: number;
  pct: number;
  reward: number;
  alreadyPaid: boolean;
  perQuestion: { qIndex: number; correct: boolean; feedback: string }[];
  onExit: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {passed ? (
            <><Trophy size={20} className="text-apron-gold" /> Great job! You passed!</>
          ) : (
            <><AlertCircle size={20} className="text-red-300" /> Close! Try again tomorrow.</>
          )}
        </CardTitle>
        <p className="mt-1 text-sm text-white/60">
          Final score:{" "}
          <span className="font-semibold text-white">{score} / {total}</span>
          {" "}· {pct}%
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-white/80">
          {passed && reward > 0
            ? alreadyPaid
              ? "Reward was already claimed for this period."
              : `Your reward of +${formatAPN(reward)} APN has been added to your Task Balance.`
            : passed
            ? "You passed but no reward was issued."
            : "You didn't reach the pass threshold this time."}
        </p>
        {perQuestion.length > 0 && (
          <div className="rounded-xl border border-white/10 p-3">
            <div className="mb-2 text-xs font-semibold text-white/70">
              Per-question feedback
            </div>
            <ul className="space-y-2 text-xs">
              {perQuestion.map((p, i) => (
                <li key={i} className="flex items-start gap-2">
                  {p.correct ? (
                    <CheckCircle2 size={12} className="mt-0.5 text-emerald-300" />
                  ) : (
                    <AlertCircle size={12} className="mt-0.5 text-red-300" />
                  )}
                  <span className="text-white/80">
                    Q{p.qIndex + 1}: {p.feedback}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap gap-3 pt-2">
          <Button variant="outline" onClick={onExit}>
            <Home size={14} /> Back to Quiz Center
          </Button>
          <Link href="/dashboard">
            <Button variant="ghost">
              <RefreshCw size={14} /> Return to Dashboard
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
