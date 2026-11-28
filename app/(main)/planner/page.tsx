import { CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AddDeadlineForm } from "@/components/planner/add-deadline-form";
import {
  ClearPlanButton,
  DeleteDeadlineButton,
  GeneratePlanButton,
} from "@/components/planner/planner-controls";
import { requireUser } from "@/lib/auth/session";
import { listDeadlines } from "@/lib/planner/planner-service";

export const metadata: Metadata = { title: "Study planner" };

const dueFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });

export default function PlannerPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Study planner</h1>
        <p className="text-sm text-ink-muted">
          Add your deadlines — SmartBook finds the gaps around your classes and books spaced focus blocks.
        </p>
      </div>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-subtle" />}>
        <PlannerContent />
      </Suspense>
    </div>
  );
}

async function PlannerContent() {
  const user = await requireUser();
  const deadlines = await listDeadlines(user.id);
  const hasDeadlines = deadlines.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <GeneratePlanButton disabled={!hasDeadlines} />
        <ClearPlanButton />
        <AddDeadlineForm />
      </div>

      {hasDeadlines ? (
        <ul className="flex flex-col gap-2">
          {deadlines.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold text-ink">
                  {d.title}
                  {d.subject ? <span className="ml-2 text-xs font-normal text-ink-muted">{d.subject}</span> : null}
                </span>
                <span className="flex items-center gap-3 text-xs text-ink-secondary">
                  <span className="flex items-center gap-1">
                    <CalendarClock className="size-3.5" aria-hidden />
                    due {dueFmt.format(new Date(d.dueDate))}
                  </span>
                  <span>{d.hours}h needed</span>
                  <span className={d.plannedBlocks > 0 ? "text-accent" : "text-ink-muted"}>
                    {d.plannedBlocks} block{d.plannedBlocks === 1 ? "" : "s"} planned
                  </span>
                </span>
              </div>
              <DeleteDeadlineButton id={d.id} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-ink-muted">
          No deadlines yet. Add one, then generate a plan.
        </p>
      )}

      <p className="text-sm text-ink-muted">
        Planned focus blocks appear on your{" "}
        <Link href="/calendar" className="font-medium text-accent hover:underline">
          calendar
        </Link>{" "}
        in amber. Re-generating always re-optimises around your latest schedule.
      </p>
    </div>
  );
}
