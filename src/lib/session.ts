import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "wg_session";
const ADMIN_COOKIE = "wg_admin";
const SESSION_MAX_AGE_S = 7 * 24 * 60 * 60;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function createSessionValue(playerId: string): string {
  const expiresAt = Date.now() + SESSION_MAX_AGE_S * 1000;
  const payload = `${playerId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionValue(value: string): string | null {
  const lastDot = value.lastIndexOf(".");
  if (lastDot < 0) return null;
  const payload = value.slice(0, lastDot);
  const sig = value.slice(lastDot + 1);
  if (!safeEqual(sign(payload), sig)) return null;
  const [playerId, expiresAt] = payload.split(".");
  if (!playerId || !expiresAt || Date.now() > Number(expiresAt)) return null;
  return playerId;
}

export async function setPlayerSession(playerId: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionValue(playerId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_S,
    path: "/",
  });
}

export async function getPlayerId(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(SESSION_COOKIE)?.value;
  return value ? verifySessionValue(value) : null;
}

export async function clearPlayerSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function setAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, `admin.${sign("admin")}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_S,
    path: "/",
  });
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  const value = jar.get(ADMIN_COOKIE)?.value;
  return value === `admin.${sign("admin")}`;
}

export function checkAdminSecret(provided: string): boolean {
  const expected = process.env.ADMIN_SECRET;
  return !!expected && safeEqual(provided, expected);
}
