import { db } from "@workspace/db";
import { activityLogsTable } from "@workspace/db";

export interface LogActivityInput {
  userId?: number | null;
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
}

/** Catat aktivitas ke activity_logs. Best-effort: kegagalan tidak dilempar. */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await db.insert(activityLogsTable).values({
      userId: input.userId ?? null,
      action: input.action,
      description: input.description,
      metadata: JSON.stringify(input.metadata ?? {}),
    });
  } catch {
    /* non-fatal */
  }
}
