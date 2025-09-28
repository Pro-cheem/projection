import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

type ReqBody = {
  items: { id: string; qty: number }[];
  customer: { name?: string; phone?: string; email: string };
  note?: string;
};

async function ensureRequester(email: string, name?: string, phone?: string) {
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({ 
      data: { 
        email, 
        name: name || null, 
        phone: phone || null, 
        role: "REQUESTER" 
      } as any 
    });
  }
  return user;
}

function buildTransport() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (host && port && user && pass) {
    return nodemailer.createTransport({ 
      host, 
      port, 
      secure: port === 465, 
      auth: { user, pass } 
    });
  }
  return null;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  let body: ReqBody | null = null;
  try { 
    body = await req.json(); 
  } catch (e) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "Invalid items" }, { status: 400 });
  }
  
  if (!body.customer?.email) {
    return NextResponse.json({ error: "Customer email is required" }, { status: 400 });
  }

  try {
    const prodIds = body.items.map(i => i.id);
    const products = await prisma.product.findMany({ 
      where: { id: { in: prodIds } }, 
      select: { id: true, name: true, price: true, stockQty: true } 
    });
    const prodMap = new Map(products.map(p => [p.id, p]));

    for (const it of body.items) {
      const p = prodMap.get(it.id);
      if (!p) return NextResponse.json({ error: `Product not found: ${it.id}` }, { status: 400 });
      if (it.qty <= 0) return NextResponse.json({ error: `Invalid qty for ${p.name}` }, { status: 400 });
      if ((p.stockQty ?? 0) <= 0) return NextResponse.json({ error: `Product out of stock: ${p.name}` }, { status: 400 });
    }

    const user = session?.user?.email 
      ? await ensureRequester(session.user.email as string, session.user.name as string | undefined) 
      : await ensureRequester(body.customer.email, body.customer.name, body.customer.phone);

    const created = await prisma.purchaseRequest.create({
      data: {
        requesterId: user.id,
        note: body.note || null,
        items: {
          create: body.items.map((it) => ({
            productId: it.id,
            quantity: it.qty,
            priceAtRequest: prodMap.get(it.id)!.price,
          })),
        },
      },
      include: { items: { include: { product: true } } },
    });

    const transport = buildTransport();
    const toEmail = process.env.ORDERS_EMAIL_TO || "elsiaad.motawee@gmail.com";
    
    if (transport) {
      try {
        const lines = created.items
          .map((it) => `- ${it.product.name} x ${it.quantity} @ ${String(it.priceAtRequest)}`)
          .join("\n");
          
        await transport.sendMail({
          from: process.env.SMTP_FROM || toEmail,
          to: toEmail,
          subject: `New Order #${created.id}`,
          text: `New order received from ${user.email} (${user.name || "-"}).\n\nItems:\n${lines}\n\nNote: ${created.note || "-"}`,
        });
      } catch (emailError) {
        console.error("Failed to send order email:", emailError);
      }
    }

    return NextResponse.json({ ok: true, order: { id: created.id } }, { status: 201 });
  } catch (err) {
    console.error("/api/orders POST error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  // @ts-expect-error custom role
  const role: string | undefined = session.user?.role;
  if (!(role === "ADMIN" || role === "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  
  const url = new URL(req.url);
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  
  const where: any = {};
  if (fromStr || toStr) {
    where.createdAt = {};
    if (fromStr) { 
      const d = new Date(fromStr); 
      if (!isNaN(d.getTime())) where.createdAt.gte = d; 
    }
    if (toStr) { 
      const d = new Date(toStr); 
      if (!isNaN(d.getTime())) { 
        d.setHours(23,59,59,999); 
        where.createdAt.lte = d; 
      } 
    }
  }
  
  try {
    const orders = await prisma.purchaseRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        requester: { 
          select: { 
            id: true, 
            name: true, 
            email: true 
          } 
        },
        items: { 
          include: { 
            product: { 
              select: { 
                id: true, 
                name: true, 
                price: true 
              } 
            } 
          } 
        },
      },
      take: 200,
    });
    
    return NextResponse.json({ ok: true, orders });
  } catch (err) {
    console.error("/api/orders GET error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

