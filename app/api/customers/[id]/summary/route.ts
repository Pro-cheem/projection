import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = "force-dynamic";

function parseDateRange(url: URL) {
  const fromStr = url.searchParams.get('from');
  const toStr = url.searchParams.get('to');
  let gte: Date | undefined;
  let lte: Date | undefined;
  
  if (fromStr) {
    const d = new Date(fromStr);
    if (!isNaN(d.getTime())) gte = d;
  }
  if (toStr) {
    const d = new Date(toStr);
    if (!isNaN(d.getTime())) lte = d;
  }
  return { gte, lte };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // @ts-expect-error custom role
  const role: string | undefined = session.user?.role;
  // @ts-expect-error id on session
  const sessionUserId: string | undefined = session.user?.id || (session.user as any)?.sub;
  const sessionEmail: string | undefined = (session.user as any)?.email;

  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  try {
    const customer = await prisma.customer.findUnique({ where: { id }, select: { id: true, name: true, email: true, phone: true, ownerId: true, totalDebt: true } });
    if (!customer) return Response.json({ error: "Not found" }, { status: 404 });

    // Authorization: ADMIN/MANAGER, the owner rep, or the REQUESTER whose email matches the customer's email
    const requesterSelf = role === "REQUESTER" && sessionEmail && customer.email && sessionEmail.toLowerCase() === customer.email.toLowerCase();
    if (!(role === "ADMIN" || role === "MANAGER" || (sessionUserId && sessionUserId === customer.ownerId) || requesterSelf)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = req.nextUrl;
    const { gte, lte } = parseDateRange(url);
    const dateFilter = gte || lte ? { date: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) } } : {};

    const invoices = await prisma.invoice.findMany({
      where: { customerId: id, ...(dateFilter as any) },
      orderBy: { date: "desc" },
      select: { id: true, serial: true, date: true, total: true, collection: true, balance: true, user: { select: { id: true, name: true } } },
      take: 100,
    });

    const agg = await prisma.invoice.aggregate({
      where: { customerId: id, ...(dateFilter as any) },
      _sum: { total: true, collection: true, balance: true },
      _count: { _all: true },
    });

    // Build daily series for chart (collections and balances per day)
    const seriesMap: Record<string, { date: string; collection: number; balance: number }> = {};
    for (const inv of invoices) {
      const d = new Date(inv.date);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (!seriesMap[key]) seriesMap[key] = { date: key, collection: 0, balance: 0 };
      seriesMap[key].collection += Number(inv.collection || 0);
      seriesMap[key].balance += Number(inv.balance || 0);
    }
    const series = Object.values(seriesMap).sort((a,b)=> a.date.localeCompare(b.date));

    return Response.json({
      ok: true,
      customer,
      invoices,
      totals: {
        invoiceCount: agg._count?._all || 0,
        salesTotal: agg._sum.total || 0,
        collectionsTotal: agg._sum.collection || 0,
        balancesTotal: agg._sum.balance || 0,
      },
      series,
    });
  } catch (err) {
    console.error("/api/customers/[id]/summary GET error", err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
