import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    // Require auth to view orders (EMPLOYEE/MANAGER/ADMIN)
    // @ts-expect-error custom
    const role = session?.user?.role as string | undefined;
    if (!session || !["EMPLOYEE", "MANAGER", "ADMIN"].includes(role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const where: any = {};
    if (status === "pending") where.status = "PENDING";
    if (status === "received") where.status = "RECEIVED";
    const orders = await prisma.webOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ orders });
  } catch (e) {
    console.error("GET /api/web-orders", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body?.name || "").trim();
    const phone = String(body?.phone || "").trim();
    const address = String(body?.address || "").trim();
    const items = Array.isArray(body?.items) ? body.items : [];
    const total = Number(body?.total || 0);
    if (!name || !phone || !address || !items.length) {
      return NextResponse.json({ error: "Invalid order payload" }, { status: 400 });
    }
    const created = await prisma.webOrder.create({
      data: {
        name,
        phone,
        address,
        items,
        total,
      },
      select: { id: true, createdAt: true },
    });
    return NextResponse.json({ ok: true, order: created });
  } catch (e) {
    console.error("POST /api/web-orders", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    // @ts-expect-error custom
    const role = session?.user?.role as string | undefined;
    if (!session || !["EMPLOYEE", "MANAGER", "ADMIN"].includes(role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const receivedByName = (session?.user as any)?.name || (session?.user as any)?.username || null;
    const receivedById = (session?.user as any)?.id || null;
    const updated = await prisma.webOrder.update({
      where: { id },
      data: {
        status: "RECEIVED",
        receivedAt: new Date(),
        receivedBy: receivedByName,
        receivedById: receivedById,
      },
      select: { id: true, status: true, receivedAt: true, receivedBy: true },
    });
    return NextResponse.json({ ok: true, order: updated });
  } catch (e) {
    console.error("PATCH /api/web-orders", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
