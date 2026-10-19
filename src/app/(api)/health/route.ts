import { connection } from "next/server";
import { prisma } from "@/lib/prisma";

const headers = { "cache-control": "no-store" };

export async function GET() {
  await connection();
  const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", commit }, { headers });
  } catch {
    return Response.json({ status: "unavailable", commit }, { status: 503, headers });
  }
}
