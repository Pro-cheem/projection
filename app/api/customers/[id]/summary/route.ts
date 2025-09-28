import { type NextRequest, NextResponse } from 'next/server';
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
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // @ts-expect-error custom role
  const role: string | undefined = session.user?.role;
  // @ts-expect-error id on session
  const sessionUserId: string | undefined = session.user?.id || (session.user as any)?.sub;

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const customer = await prisma.customer.findUnique({ where: { id }, select: { id: true, name: true, email: true, phone: true, ownerId: true, totalDebt: true } });
    if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Authorization: ADMIN/MANAGER or the owner rep of the customer.
    if (!(role === "ADMIN" || role === "MANAGER" || (sessionUserId && sessionUserId === customer.ownerId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = request.nextUrl;
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

    return NextResponse.json({
      ok: true,
      customer,
      invoices,
      totals: {
        invoiceCount: agg._count?._all || 0,
        salesTotal: agg._sum.total || 0,
        collectionsTotal: agg._sum.collection || 0,
        balancesTotal: agg._sum.balance || 0,
      },
    });
  } catch (err) {
    console.error("/api/customers/[id]/summary GET error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
