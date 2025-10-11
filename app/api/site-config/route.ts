import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const cfg = await prisma.siteConfig.findUnique({ where: { id: "singleton" } });
    return NextResponse.json({ config: cfg || null });
  } catch (e) {
    console.error("GET /api/site-config", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any)?.role as string | undefined;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: any = null;
  try { body = await req.json(); } catch {}
  const allowedKeys = new Set([
    "hero1Url","hero1Link","hero2Url","hero2Link","hero3Url","hero3Link","aboutTitle","aboutBody"
  ]);
  const data: Record<string, any> = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (allowedKeys.has(k)) data[k] = v;
  }
  try {
    const cfg = await prisma.siteConfig.upsert({
      where: { id: "singleton" },
      update: data,
      create: { id: "singleton", ...data },
    });
    return NextResponse.json({ config: cfg });
  } catch (e) {
    console.error("PATCH /api/site-config", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
