import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  // @ts-expect-error custom
  const role: string | undefined = session?.user?.role;
  if (!session || !(role === "ADMIN" || role === "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  try {
    const where: any = {};
    if (from || to) {
      where.date = {} as any;
      if (from) (where.date as any).gte = new Date(from);
      if (to) (where.date as any).lte = new Date(to);
    }

    const grouped = await prisma.invoice.groupBy({
      by: ["customerId"],
      where,
      _sum: { total: true, collection: true },
      _count: { _all: true },
    });

    const ids = grouped.map(g => g.customerId).filter(Boolean) as string[];
    const customers = await prisma.customer.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true }
    });
    const nameMap = new Map(customers.map(c => [c.id, c.name] as const));

    const rows = grouped.map(g => ({
      customerId: g.customerId,
      name: nameMap.get(g.customerId) || "—",
      sales: Number(g._sum.total || 0),
      collections: Number(g._sum.collection || 0),
      invoiceCount: g._count._all || 0,
    }));

    // Sort by sales desc, take top 10
    const top = rows.sort((a,b)=> b.sales - a.sales).slice(0, 10);

    return NextResponse.json({ ok: true, top });
  } catch (e) {
    console.error("GET /api/customers/top", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
