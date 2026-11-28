import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { NewCourseForm } from "@/components/teach/new-course-form";
import { requireTeacher } from "@/lib/auth/session";
import { listTeacherCourses } from "@/lib/courses/courses-service";

export const metadata: Metadata = { title: "Teach" };

export default function TeachPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">My courses</h1>
          <p className="text-sm text-ink-muted">Schedule classes for the semester and manage who's enrolled.</p>
        </div>
      </div>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-subtle" />}>
        <TeachContent />
      </Suspense>
    </div>
  );
}

async function TeachContent() {
  const user = await requireTeacher();
  const courses = await listTeacherCourses(user.id);

  return (
    <div className="flex flex-col gap-4">
      <NewCourseForm />
      {courses.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-ink-muted">
          No courses yet. Create one to schedule its weekly sessions.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {courses.map((c) => (
            <li key={c.id}>
              <Link
                href={`/teach/${c.id}`}
                className="flex h-full flex-col gap-2 rounded-2xl border border-line bg-white p-4 transition-colors hover:border-accent"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-sm text-ink-muted">{c.code}</span>
                  <span className="text-xs text-ink-muted">{c.studentCount} enrolled</span>
                </div>
                <span className="text-[15px] font-semibold text-ink">{c.title}</span>
                <div className="mt-1 flex flex-col gap-1 text-xs text-ink-secondary">
                  {c.schedule.length === 0 ? (
                    <span className="text-ink-muted">No sessions scheduled yet</span>
                  ) : (
                    c.schedule.map((s, i) => <span key={i}>🕑 {s}</span>)
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
