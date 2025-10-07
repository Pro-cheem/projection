import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  // @ts-expect-error custom role on session
  const role = session?.user?.role as string | undefined;
  if (!session || (role !== "ADMIN" && role !== "MANAGER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const roleFilter = searchParams.get("role") as any | null;

  const users = await prisma.user.findMany({
    where: roleFilter ? { role: roleFilter } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ users });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  // @ts-expect-error custom role on session
  const role = session?.user?.role as string | undefined;
  if (!session || (role !== "ADMIN" && role !== "MANAGER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  // If password present -> only MANAGER can update passwords
  if (typeof body.password === "string" && body.password.length >= 4) {
    if (role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    try {
      const passwordHash = await bcrypt.hash(String(body.password), 10);
      const updated = await prisma.user.update({
        where: { id: String(body.userId) },
        data: { passwordHash },
        select: { id: true, name: true, username: true, email: true, phone: true, role: true },
      });
      return NextResponse.json({ user: updated, ok: true });
    } catch (e) {
      console.error("PATCH /api/admin/users password error", e);
      return NextResponse.json({ error: "Password update failed" }, { status: 500 });
    }
  }

  // Else expect role change (allowed to ADMIN/MANAGER with restricted targets)
  if (!body?.role) {
    return NextResponse.json({ error: "role is required when password is not provided" }, { status: 400 });
  }
  const targetRole = String(body.role);
  // Allow switching between REQUESTER and EMPLOYEE for ADMIN/MANAGER
  // Allow promoting to MANAGER only if current session is ADMIN
  if (![`REQUESTER`, `EMPLOYEE`, `MANAGER`].includes(targetRole)) {
    return NextResponse.json({ error: "Invalid role change" }, { status: 400 });
  }
  if (targetRole === "MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Only ADMIN can promote to MANAGER" }, { status: 403 });
  }
  try {
    const updated = await prisma.user.update({
      where: { id: String(body.userId) },
      data: { role: targetRole as any },
      select: { id: true, name: true, username: true, email: true, phone: true, role: true },
    });
    return NextResponse.json({ user: updated, ok: true });
  } catch (e) {
    console.error("PATCH /api/admin/users error", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  // @ts-expect-error custom role on session
  const role = session?.user?.role as string | undefined;
  if (!session || (role !== "ADMIN" && role !== "MANAGER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
  try {
    // Only allow deleting REQUESTER or EMPLOYEE
    const target = await prisma.user.findUnique({ where: { id: String(userId) }, select: { id: true, role: true } });
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (target.role !== "REQUESTER" && target.role !== "EMPLOYEE") {
      return NextResponse.json({ error: "Cannot delete this role" }, { status: 400 });
    }
    await prisma.user.delete({ where: { id: String(userId) } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/admin/users error", e);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
