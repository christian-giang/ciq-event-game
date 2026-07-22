import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { players, submissions, votes } from "@/db/schema";
import { isOurMediaUrl } from "@/lib/media/server";
import { getQuest } from "@/lib/quests";
import { getPlayerId } from "@/lib/session";
import { isFrozen } from "@/lib/settings";

const MAX_CONTRIBUTORS = 15;

const bodySchema = z.object({
  clientUuid: z.uuid(),
  questId: z.string().min(1),
  bodyText: z.string().min(1).optional(),
  mediaUrl: z.string().min(1).optional(),
  mediaKind: z.enum(["photo", "video"]).optional(),
  contributorIds: z.array(z.uuid()).max(50).optional(),
});

/** Keep only real, activated, non-blocked players; drop self and dupes. */
async function validateContributors(
  requested: string[] | undefined,
  uploaderId: string,
): Promise<string[]> {
  const unique = [...new Set(requested ?? [])].filter((id) => id !== uploaderId);
  if (unique.length === 0) return [];
  const rows = await db
    .select({ id: players.id })
    .from(players)
    .where(
      and(
        inArray(players.id, unique),
        eq(players.isActivated, true),
        eq(players.isBlocked, false),
      ),
    );
  return rows.map((r) => r.id).slice(0, MAX_CONTRIBUTORS);
}

type Content = {
  kind: "text" | "photo" | "video";
  bodyText: string | null;
  mediaUrl: string | null;
  mediaKind: "photo" | "video" | null;
  contributorIds: string[];
};

/**
 * Text submissions (media joins in Phase 4). One submission per player per
 * quest, replaceable until the freeze:
 *  - retry of the same upload (same clientUuid)      → no-op, return stored
 *  - new submission for an already-submitted quest    → replacement: the
 *    old text is overwritten and votes received so far are DELETED (voters'
 *    budgets are refunded by the delete — they can vote again).
 */
export async function POST(req: Request) {
  const playerId = await getPlayerId();
  if (!playerId) {
    return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  }

  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId),
  });
  if (!player || player.isBlocked) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  if (await isFrozen()) {
    return NextResponse.json(
      { error: "The game is over — the leaderboard is final!" },
      { status: 409 },
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const quest = await getQuest(body.questId);
  if (!quest || quest.type === "quiz" || quest.state === "unreleased") {
    return NextResponse.json({ error: "Unknown quest." }, { status: 400 });
  }
  if (quest.state !== "released") {
    return NextResponse.json(
      { error: "Submissions are closed for this quest." },
      { status: 409 },
    );
  }

  const contributorIds = await validateContributors(
    body.contributorIds,
    playerId,
  );

  let content: Content;
  if (quest.type === "text") {
    const text = body.bodyText?.trim() ?? "";
    if (!text) {
      return NextResponse.json(
        { error: "Write something first!" },
        { status: 400 },
      );
    }
    if (text.length > quest.maxChars) {
      return NextResponse.json(
        {
          error: `That's ${text.length} characters — this quest allows ${quest.maxChars}.`,
        },
        { status: 400 },
      );
    }
    content = {
      kind: "text",
      bodyText: text,
      mediaUrl: null,
      mediaKind: null,
      contributorIds,
    };
  } else {
    if (!body.mediaUrl || !body.mediaKind) {
      return NextResponse.json(
        { error: "This quest needs a photo or video." },
        { status: 400 },
      );
    }
    // Only URLs from OUR storage — no injecting arbitrary links.
    if (!isOurMediaUrl(body.mediaUrl)) {
      return NextResponse.json({ error: "Bad media URL." }, { status: 400 });
    }
    if (quest.mediaKind !== "either" && quest.mediaKind !== body.mediaKind) {
      return NextResponse.json(
        { error: `This quest wants a ${quest.mediaKind}.` },
        { status: 400 },
      );
    }
    content = {
      kind: body.mediaKind,
      bodyText: null,
      mediaUrl: body.mediaUrl,
      mediaKind: body.mediaKind,
      contributorIds,
    };
  }

  const result = await runSubmit(playerId, quest.id, content, body.clientUuid);

  return NextResponse.json({
    ok: true,
    submissionId: result.stored.id,
    bodyText: result.stored.bodyText,
    mediaUrl: result.stored.mediaUrl,
    replaced: result.replaced,
  });
}

async function runSubmit(
  playerId: string,
  questId: string,
  content: Content,
  clientUuid: string,
  retry = true,
): Promise<{
  stored: typeof submissions.$inferSelect;
  replaced: boolean;
}> {
  try {
    return await doSubmit(playerId, questId, content, clientUuid);
  } catch (err) {
    // Concurrent first submissions for the same (player, quest) with
    // different clientUuids: one hits the unique index. Retry once — the
    // second attempt sees the winner and becomes a replacement.
    if (retry && (err as { code?: string }).code === "23505") {
      return runSubmit(playerId, questId, content, clientUuid, false);
    }
    throw err;
  }
}

async function doSubmit(
  playerId: string,
  questId: string,
  content: Content,
  clientUuid: string,
) {
  return await db.transaction(async (tx) => {
    const existing = await tx.query.submissions.findFirst({
      where: and(
        eq(submissions.playerId, playerId),
        eq(submissions.questId, questId),
      ),
    });

    // Retry of an upload we already have: idempotent no-op.
    if (existing && existing.clientUuid === clientUuid) {
      return { stored: existing, replaced: false };
    }

    if (existing) {
      // Replacement: votes on the old content no longer apply.
      await tx.delete(votes).where(eq(votes.submissionId, existing.id));
      const [updated] = await tx
        .update(submissions)
        .set({
          kind: content.kind,
          bodyText: content.bodyText,
          mediaUrl: content.mediaUrl,
          mediaKind: content.mediaKind,
          contributorIds: content.contributorIds,
          clientUuid,
          createdAt: new Date(),
        })
        .where(eq(submissions.id, existing.id))
        .returning();
      return { stored: updated, replaced: true };
    }

    const [inserted] = await tx
      .insert(submissions)
      .values({
        playerId,
        questId,
        kind: content.kind,
        bodyText: content.bodyText,
        mediaUrl: content.mediaUrl,
        mediaKind: content.mediaKind,
        contributorIds: content.contributorIds,
        clientUuid,
      })
      .onConflictDoNothing({ target: submissions.clientUuid })
      .returning();

    if (!inserted) {
      // Same clientUuid raced us in another request — fetch what it wrote.
      const stored = await tx.query.submissions.findFirst({
        where: eq(submissions.clientUuid, clientUuid),
      });
      if (!stored) throw new Error("submission conflict without a row");
      return { stored, replaced: false };
    }
    return { stored: inserted, replaced: false };
  });
}
