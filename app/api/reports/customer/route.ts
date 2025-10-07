import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Allow EMPLOYEE, MANAGER, ADMIN
  const role = (session.user as any)?.role as string | undefined;
  if (role !== "EMPLOYEE" && role !== "MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get("customerId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!customerId) return NextResponse.json({ error: "customerId is required" }, { status: 400 });

  try {
    // If EMPLOYEE, ensure the customer belongs to the current user
    const userId = (session.user as any)?.id || (session as any).user?.id;
    const customerWhere: any = { id: customerId };
    if (role === "EMPLOYEE") {
      customerWhere.ownerId = userId;
    }
    // current customer debt
    const customer = await prisma.customer.findFirst({ where: customerWhere, select: { id: true, name: true, totalDebt: true } });
    if (!customer) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const where: any = { customerId };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) { const dt = new Date(to); dt.setHours(23,59,59,999); where.date.lte = dt; }
    }

    // journal entries (each corresponds to an invoice)
    const entries = await prisma.journal.findMany({
      where,
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        total: true,
        collection: true,
        balance: true,
        invoice: { select: { id: true, serial: true } },
      }
    });

    // Also provide invoices for compatibility (same filter)
    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { date: "asc" },
      select: { id: true, serial: true, date: true, total: true, collection: true, balance: true, items: { select: { productId: true, quantity: true, price: true, total: true } } }
    });

    const totals = entries.reduce((acc, e) => {
      acc.total += Number(e.total as any);
      acc.collection += Number(e.collection as any);
      acc.balance += Number(e.balance as any);
      return acc;
    }, { total: 0, collection: 0, balance: 0 });

    return NextResponse.json({ customer, entries, invoices, totals });
  } catch (e) {
    console.error("/api/reports/customer GET error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
