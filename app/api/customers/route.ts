import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const role = (session.user as any)?.role as string | undefined;
    const userId = (session.user as any)?.id || (session as any).user?.id;

    const where: any = {};
    if (role === "EMPLOYEE") {
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
  const userId = (session.user as any).id || (session as any).user?.id;

  const body = await req.json().catch(() => null);
  if (!body?.name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  try {
    const created = await prisma.customer.create({
      data: {
        name: body.name,
        email: body.email || null,
        phone: body.phone || null,
        ownerId: userId,
      },
      select: { id: true, name: true, email: true, phone: true },
    });
    return NextResponse.json({ customer: created }, { status: 201 });
  } catch (e) {
    console.error("POST /api/customers", e);
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}
