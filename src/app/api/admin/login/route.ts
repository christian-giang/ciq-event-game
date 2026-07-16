import { NextResponse } from "next/server";
import { z } from "zod";
import { isRateLimited, recordLoginAttempt, requestIp } from "@/lib/rate-limit";
import { checkAdminSecret, setAdminSession } from "@/lib/session";

// Same uniform-failure discipline as the player login.
function failure() {
  return NextResponse.json(
    { error: "That code didn't work." },
    { status: 401 },
  );
}

const bodySchema = z.object({ secret: z.string().min(1).max(200) });

export async function POST(req: Request) {
  const ip = requestIp(req);

  if (await isRateLimited(ip)) {
    return failure();
  }

  let secret: string;
  try {
    secret = bodySchema.parse(await req.json()).secret;
  } catch {
    await recordLoginAttempt(ip, false);
    return failure();
  }

  const ok = checkAdminSecret(secret);
  await recordLoginAttempt(ip, ok);

  if (!ok) {
    return failure();
  }

  await setAdminSession();
  return NextResponse.json({ ok: true });
}
