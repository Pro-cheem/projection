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
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // @ts-expect-error custom id on session
  const userId: string | undefined = session.user?.id || (session.user as any)?.sub;
  if (!userId) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }
  let body: ReqBody | null = null;
  try { 
    body = await req.json(); 
  } catch (e) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "Invalid items" }, { status: 400 });
  }
  
  if (!body.customer?.name || !body.customer?.email || !body.customer?.phone) {
    return NextResponse.json({ error: "Customer name, email and phone are required" }, { status: 400 });
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

    // Ensure a Customer owned by the current user
    const emailLc = String(body.customer.email).toLowerCase();
    let customer = await prisma.customer.findFirst({ where: { ownerId: userId, email: emailLc } });
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          ownerId: userId,
          name: body.customer.name!,
          email: emailLc,
          phone: body.customer.phone!,
          totalDebt: 0,
        },
      });
    } else {
      // keep customer info fresh
      customer = await prisma.customer.update({ where: { id: customer.id }, data: { name: body.customer.name!, phone: body.customer.phone! } });
    }

    const created = await prisma.purchaseRequest.create({
      data: {
        requesterId: userId,
        customerId: customer.id,
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
          text: `New order received by user ${String(session.user?.email || session.user?.name || userId)} for customer ${customer.name} <${customer.email}>.\n\nItems:\n${lines}\n\nNote: ${created.note || "-"}`,
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
  // @ts-expect-error custom
  const role: string | undefined = session.user?.role;
  // @ts-expect-error id present
  const userId: string | undefined = session.user?.id || (session.user as any)?.sub;
  
  const url = new URL(req.url);
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  
  const where: any = {};
  if (!(role === "ADMIN" || role === "MANAGER")) {
    // Regular users: only their own orders
    where.requesterId = userId || "__none__";
  }
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

