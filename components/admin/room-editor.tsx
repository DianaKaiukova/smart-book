"use client";

import { ExternalLink, Trash2 } from "lucide-react";
import { useActionState, useEffect, useTransition } from "react";

import { useToast } from "@/components/layout/toaster";
import { createRoomAction, deleteRoomAction, updateRoomAction, type RoomFormState } from "@/lib/admin/actions";
import type { RoomView } from "@/lib/rooms/rooms-types";

const input = "w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm";

export function RoomEditor({ rooms }: { rooms: RoomView[] }) {
  return (
    <div className="flex flex-col gap-4">
      <RoomForm mode="create" />
      <div className="flex flex-col gap-2">
        {rooms.map((room) => (
          <RoomForm key={`${room.id}-${room.name}-${room.capacity}-${room.floor}-${room.amenities.join()}`} mode="edit" room={room} />
        ))}
      </div>
    </div>
  );
}

function RoomForm({ mode, room }: { mode: "create" | "edit"; room?: RoomView }) {
  const toast = useToast();
  const [state, action, pending] = useActionState<RoomFormState, FormData>(
    mode === "create" ? createRoomAction : updateRoomAction,
    undefined,
  );
  const [deleting, startDelete] = useTransition();

  useEffect(() => {
    if (state?.success) toast.success(state.success);
    if (state?.error) toast.error(state.error);
  }, [state, toast]);

  return (
    <form
      action={action}
      className="grid grid-cols-2 items-end gap-2 rounded-xl border border-neutral-200 bg-white p-3 sm:grid-cols-[110px_1fr_80px_80px_1fr_auto]"
    >
      <label className="flex flex-col gap-1 text-xs text-neutral-500">
        Id
        {mode === "edit" ? (
          <>
            <input type="hidden" name="id" value={room!.id} />
            <span className="py-1.5 font-mono text-sm text-neutral-900">{room!.id}</span>
          </>
        ) : (
          <input name="id" placeholder="Z.1.13" required className={`${input} font-mono`} />
        )}
      </label>
      <label className="flex flex-col gap-1 text-xs text-neutral-500">
        Name
        <input name="name" defaultValue={room?.name} required className={input} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-neutral-500">
        Floor
        <input name="floor" defaultValue={room?.floor ?? "Z-1"} required className={input} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-neutral-500">
        Capacity
        <input name="capacity" type="number" min={1} max={200} defaultValue={room?.capacity ?? 4} required className={input} />
      </label>
      <label className="col-span-2 flex flex-col gap-1 text-xs text-neutral-500 sm:col-span-1">
        Amenities (comma separated)
        <input name="amenities" defaultValue={room?.amenities.join(", ")} className={input} />
      </label>
      <div className="col-span-2 flex items-center gap-1 sm:col-span-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {mode === "create" ? "Add room" : "Save"}
        </button>
        {mode === "edit" ? (
          <>
            <a
              href={`/door/${encodeURIComponent(room!.id)}`}
              target="_blank"
              rel="noreferrer"
              title="Open door kiosk"
              className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"
            >
              <ExternalLink className="size-4" aria-hidden />
            </a>
            <button
              type="button"
              disabled={deleting}
              title="Delete room"
              onClick={() => {
                if (!confirm(`Delete ${room!.id}?`)) return;
                startDelete(async () => {
                  const result = await deleteRoomAction(room!.id);
                  if (result.ok) toast.success(result.message ?? "Deleted.");
                  else toast.error(result.error);
                });
              }}
              className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-60"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </>
        ) : null}
      </div>
    </form>
  );
}
