import Link from "next/link";
import { GraduationCap, BookOpen, Award, Clock, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function SkillAcademyPage() {
  const courses = [
    {
      title: "Content Creation 101",
      tag: "New",
      duration: "2h 30m",
      level: "Beginner",
      coins: 50,
    },
    {
      title: "Facebook Ads Fundamentals",
      tag: "Popular",
      duration: "3h 10m",
      level: "Intermediate",
      coins: 120,
    },
    {
      title: "Freelancing on Global Platforms",
      tag: "New",
      duration: "1h 45m",
      level: "Beginner",
      coins: 80,
    },
    {
      title: "Graphic Design with Canva",
      tag: "Hot",
      duration: "2h 15m",
      level: "Beginner",
      coins: 70,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <GraduationCap size={22} className="text-apron-gold" /> Skill Academy
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Learn new skills, earn APN bonuses for completed courses.
        </p>
      </div>

      <Card className="!border-apron-gold/30 !bg-gradient-to-br from-apron-gold/10 to-apron-pink/10">
        <CardContent className="pt-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-apron-gold font-semibold">
                Welcome, scholar
              </div>
              <div className="mt-1 text-xl font-bold text-white">
                Complete 3 courses this week to unlock a bonus.
              </div>
              <div className="mt-1 text-sm text-white/70">
                Earn up to 500 APN extra.
              </div>
            </div>
            <Award className="text-apron-gold" size={32} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {courses.map((c) => (
          <Card key={c.title}>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-apron-gold/15 border border-apron-gold/30 text-[10px] font-semibold uppercase tracking-wide text-apron-gold px-2 py-0.5">
                    {c.tag}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-white/10 border border-white/15 text-[10px] uppercase tracking-wide text-white/70 px-2 py-0.5">
                    {c.level}
                  </span>
                </div>
                <CardTitle className="mt-2 text-base">{c.title}</CardTitle>
                <div className="mt-1 text-xs text-white/60 flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {c.duration}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-white/60">Earn</div>
                <div className="text-base font-bold text-gradient-gold">
                  +{c.coins} APN
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm">
                <BookOpen size={14} /> Preview
              </Button>
              <Button size="sm">
                Start <ArrowRight size={14} />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
