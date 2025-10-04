import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const PatchSchema = z.object({ collection: z.number().min(0) });

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any)?.role as string | undefined;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(_req.url);
  const collectionStr = url.searchParams.get("collection");
  let body: any = null;
  try { body = await _req.json(); } catch {}
  const candidate = body && typeof body === "object" ? body : (collectionStr ? { collection: Number(collectionStr) } : null);
  const parsed = PatchSchema.safeParse(candidate);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });

  const id = params.id;
  const { collection } = parsed.data;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const entry = await tx.journal.findUnique({ where: { id }, select: { id: true, total: true, collection: true, balance: true, customerId: true, invoiceId: true } });
      if (!entry) throw new Error("Journal entry not found");

      const newBalance = Number(entry.total as any) - collection;
      const delta = newBalance - Number(entry.balance as any);

      // Update journal
      const updatedJournal = await tx.journal.update({ where: { id }, data: { collection, balance: newBalance } });

      // Update invoice if exists
      if (entry.invoiceId) {
        await tx.invoice.update({ where: { id: entry.invoiceId }, data: { collection, balance: newBalance } });
      }

      // Update customer totalDebt with delta
      if (entry.customerId && delta !== 0) {
        await tx.customer.update({ where: { id: entry.customerId }, data: { totalDebt: { increment: delta } } });
      }

      return { updatedJournal };
    });
    return NextResponse.json({ ok: true, journal: result.updatedJournal });
  } catch (e) {
    console.error("PATCH /api/journal/[id] error", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any)?.role as string | undefined;
  if (role !== "EMPLOYEE" && role !== "MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = params.id;
  try {
    const journal = await prisma.journal.findUnique({
      where: { id },
      include: {
        invoice: {
          include: {
            items: {
              include: { product: { select: { name: true } } },
              orderBy: { id: "asc" },
            },
            customer: { select: { id: true, name: true } },
            user: { select: { id: true, name: true, email: true } },
          },
        },
        customer: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
    if (!journal) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const response = {
      id: journal.id,
      date: journal.date,
      total: Number(journal.total as any),
      collection: Number(journal.collection as any),
      balance: Number(journal.balance as any),
      customer: journal.customer,
      user: journal.user,
      invoice: journal.invoice
        ? {
            id: journal.invoice.id,
            serial: journal.invoice.serial,
            date: journal.invoice.date,
            total: Number(journal.invoice.total as any),
            collection: Number(journal.invoice.collection as any),
            balance: Number(journal.invoice.balance as any),
            customer: journal.invoice.customer,
            user: journal.invoice.user,
            items: journal.invoice.items.map((it) => ({
              id: it.id,
              productId: it.productId,
              productName: (it as any).product?.name || "",
              capacity: it.capacity,
              price: Number(it.price as any),
              quantity: it.quantity,
              total: Number(it.total as any),
            })),
          }
        : null,
    };

    return NextResponse.json(response);
  } catch (e) {
    console.error("GET /api/journal/[id] error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
