import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const role = (session.user as any)?.role as string | undefined;
    // Resolve current user id robustly
    let userId: string | undefined = (session.user as any)?.id || (session as any).user?.id;
    if (!userId) {
      const su: any = session.user || {};
      // Try by username (unique)
      if (su?.username) {
        try { const u = await prisma.user.findUnique({ where: { username: su.username } }); if (u) userId = u.id; } catch {}
      }
      // Try by email (unique)
      if (!userId && su?.email) {
        try { const u = await prisma.user.findUnique({ where: { email: su.email } }); if (u) userId = u.id; } catch {}
      }
      // Try by name (not unique, best-effort)
      if (!userId && su?.name) {
        try { const u = await prisma.user.findFirst({ where: { name: su.name } }); if (u) userId = u.id; } catch {}
      }
    }

    const where: any = {};
    if (role === "EMPLOYEE" && userId) {
      where.ownerId = userId;
    }

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, phone: true, totalDebt: true },
    });
    return NextResponse.json({ customers });
  } catch (e) {
    console.error("GET /api/customers", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Allow EMPLOYEE, MANAGER, or ADMIN to create customers
  const role = (session.user as any).role as string | undefined;
  if (role !== "EMPLOYEE" && role !== "MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Resolve current user id reliably
  let userId: string | undefined = (session.user as any)?.id || (session as any).user?.id;
  if (!userId) {
    const su: any = session.user || {};
    // Try username first
    if (su?.username) {
      try { const u = await prisma.user.findUnique({ where: { username: su.username } }); if (u) userId = u.id; } catch {}
    }
    // Then email
    if (!userId && su?.email) {
      try { const u = await prisma.user.findUnique({ where: { email: su.email } }); if (u) userId = u.id; } catch {}
    }
    // Then name as best-effort
    if (!userId && su?.name) {
      try { const u = await prisma.user.findFirst({ where: { name: su.name } }); if (u) userId = u.id; } catch {}
    }
    // Fallback to ADMIN_EMAIL if provided
    if (!userId && process.env.ADMIN_EMAIL) {
      try { const admin = await prisma.user.findUnique({ where: { email: String(process.env.ADMIN_EMAIL) } }); if (admin) userId = admin.id; } catch {}
    }
  }

  const body = await req.json().catch(() => null);
  if (!body?.name || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  if (!userId) {
    return NextResponse.json({ error: "Unable to resolve current user. Please login as EMPLOYEE/MANAGER/ADMIN or set ADMIN_EMAIL user." }, { status: 400 });
  }

  try {
    const created = await prisma.customer.create({
      data: {
        name: String(body.name).trim(),
        email: body.email ? String(body.email) : null,
        phone: body.phone ? String(body.phone) : null,
        ownerId: userId,
      },
      select: { id: true, name: true, email: true, phone: true, totalDebt: true },
    });
    return NextResponse.json({ customer: created }, { status: 201 });
  } catch (e: any) {
    console.error("POST /api/customers", e);
    const msg = (e?.code === 'P2003') ? 'Foreign key error: owner user not found' : (e?.message || 'Create failed');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
