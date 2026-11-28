import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AddStudentsForm } from "@/components/teach/add-students-form";
import { CancelSeriesButton } from "@/components/teach/cancel-series-button";
import { ScheduleClassForm } from "@/components/teach/schedule-class-form";
import { requireTeacher } from "@/lib/auth/session";
import { getCourseDetail } from "@/lib/courses/courses-service";
import { listRooms } from "@/lib/rooms/rooms";

export default function CoursePage({ params }: PageProps<"/teach/[courseId]">) {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/teach" className="flex items-center gap-1 self-start text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> All courses
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-subtle" />}>
        <CourseContent params={params} />
      </Suspense>
    </div>
  );
}

async function CourseContent({ params }: { params: Promise<{ courseId: string }> }) {
  const user = await requireTeacher();
  const courseId = (await params).courseId;
  const [course, rooms] = await Promise.all([getCourseDetail(user, courseId), listRooms()]);
  if (!course) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-sm text-ink-muted">{course.code}</span>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{course.title}</h1>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Weekly sessions</h2>
        {course.series.length === 0 ? (
          <p className="text-sm text-ink-muted">No sessions yet — add one below.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {course.series.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-2.5 text-sm"
              >
                <span>🕑 {s.label}</span>
                <CancelSeriesButton seriesId={s.id} />
              </li>
            ))}
          </ul>
        )}
        <ScheduleClassForm
          courseId={course.id}
          rooms={rooms.map((r) => ({ id: r.id, name: r.name, category: r.category }))}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Roster ({course.roster.length})
          </h2>
          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            {course.roster.length === 0 ? (
              <p className="p-6 text-center text-sm text-ink-muted">No students yet.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-line">
                  {course.roster.map((r) => (
                    <tr key={r.email}>
                      <td className="px-4 py-2.5">{r.name ?? r.email}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{r.name ? r.email : ""}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span
                          className={
                            r.status === "ACTIVE"
                              ? "rounded-full bg-success-soft px-2 py-0.5 text-xs text-success"
                              : "rounded-full bg-subtle px-2 py-0.5 text-xs text-ink-muted"
                          }
                        >
                          {r.status === "ACTIVE" ? "active" : "pending"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <AddStudentsForm courseId={course.id} />
      </section>
    </div>
  );
}
