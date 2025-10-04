import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const InvoiceSchema = z.object({
  serial: z.string().trim().min(1),
  date: z.string().optional(), // ISO date string
  customerId: z.string().trim().min(1),
  collection: z.coerce.number().min(0).default(0),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.coerce.number().int().min(1),
    })
  ).min(0).default([]),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Only EMPLOYEE, MANAGER, or ADMIN can create invoices
  const role = (session.user as any)?.role as string | undefined;
  if (role !== "EMPLOYEE" && role !== "MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bodyRaw = await req.text();
  let body: any;
  try { body = bodyRaw ? JSON.parse(bodyRaw) : null; } catch { body = null; }
  const parsed = InvoiceSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.flatten();
    console.error("/api/invoices invalid payload", { body, fieldErrors: details.fieldErrors });
    return NextResponse.json({ error: "Invalid invoice payload", details }, { status: 400 });
  }

  const { serial, date, customerId, items, collection } = parsed.data;
  const userId = (session.user as any).id || (session as any).user?.id;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Fetch products and current stock
      let itemsBuilt: { productId: string; productName: string; capacity: string; price: number; quantity: number; total: number }[] = [];
      let total = 0;
      if (items.length > 0) {
        const productIds = items.map((i) => i.productId);
        const products = await tx.product.findMany({
          where: { id: { in: productIds } },
          // Include product name for journal items
          select: { id: true, name: true, capacity: true, price: true, stockQty: true } as any,
        }) as any as Array<{ id: string; name: string; capacity: string; price: any; stockQty: number }>;
        if (products.length !== productIds.length) {
          throw new Error("Some products were not found");
        }

        // Build items and validate stock
        itemsBuilt = items.map((i) => {
          const p = products.find((pp) => pp.id === i.productId)!;
          const price = Number(p.price as any);
          const qty = i.quantity;
          if (typeof p.stockQty === "number" && p.stockQty < qty) {
            throw new Error(`Insufficient stock for product ${p.id}`);
          }
          const t = price * qty;
          return {
            productId: i.productId,
            productName: p.name,
            capacity: p.capacity,
            price,
            quantity: qty,
            total: t,
          } as {
            productId: string;
            productName: string;
            capacity: string;
            price: number;
            quantity: number;
            total: number;
          };
        });

        total = itemsBuilt.reduce((acc, it) => acc + it.total, 0);
      }
      const collected = Number(collection || 0);
      const balance = total - collected;

      // Ensure serial is unique; if exists, append a short random suffix and try again a few times
      let finalSerial = serial;
      for (let attempt = 0; attempt < 3; attempt++) {
        const existing = await tx.invoice.findUnique({ where: { serial: finalSerial } });
        if (!existing) break;
        const suffix = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
        finalSerial = `${serial}-${suffix}`;
      }

      // Create invoice with items
      const invoice = await tx.invoice.create({
        data: {
          serial: finalSerial,
          date: date ? new Date(date) : new Date(),
          customerId,
          userId,
          total,
          collection: collected,
          balance,
          ...(itemsBuilt.length > 0 ? {
            items: {
              create: itemsBuilt.map((it) => ({
                productId: it.productId,
                capacity: it.capacity,
                price: it.price,
                quantity: it.quantity,
                total: it.total,
              }))
            }
          } : {}),
        },
        include: { items: true },
      });

      // Decrement stock for each product based on built items
      if (itemsBuilt.length > 0) {
        for (const it of itemsBuilt) {
          await tx.product.update({
            where: { id: it.productId },
            data: { stockQty: { decrement: it.quantity } } as any,
          });
        }
      }

      // Update customer total debt
      if (balance !== 0) {
        await tx.customer.update({
          where: { id: customerId },
          data: { totalDebt: { increment: balance } },
        });
      }

      // Journal entry
      const journal = await tx.journal.create({
        data: {
          date: invoice.date,
          invoiceId: invoice.id,
          userId,
          customerId,
          total,
          collection: collected,
          balance,
        },
      });

      // Create journal items for each invoice line (guard if client not regenerated yet)
      if (itemsBuilt.length > 0) {
        const jItemDelegate = (tx as any).journalItem;
        if (jItemDelegate && typeof jItemDelegate.createMany === "function") {
          await jItemDelegate.createMany({
            data: itemsBuilt.map((it) => ({
              journalId: journal.id,
              productId: it.productId,
              productName: it.productName,
              capacity: it.capacity,
              price: it.price,
              quantity: it.quantity,
              total: it.total,
            })),
          });
        } else {
          console.warn("JournalItem delegate is unavailable. Run prisma generate after schema migration.");
        }
      }

      console.log("/api/invoices created", { serial: finalSerial, total, collected, balance, itemCount: itemsBuilt.length });
      return { invoice, total, balance, collected, itemCount: itemsBuilt.length };
    });

    return NextResponse.json(
      { invoiceId: result.invoice.id, serial: result.invoice.serial, total: result.total, balance: result.balance, collection: result.collected, itemCount: result.itemCount },
      { status: 201 }
    );
  } catch (e) {
    console.error("POST /api/invoices error", e);
    const msg = e instanceof Error ? e.message : "Invoice creation failed";
    const status = msg.includes("Insufficient stock") || msg.includes("not found") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
