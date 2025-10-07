import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { stockQty: { gt: 0 } },
      orderBy: { name: "asc" },
      include: { images: true },
    });
    return NextResponse.json({ products });
  } catch (err) {
    console.error("/api/products GET error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any)?.role as string | undefined;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any = null;
  try { body = await req.json(); } catch {}
  const id = body?.id as string | undefined;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  try {
    const linkedCount = await prisma.invoiceItem.count({ where: { productId: id } });
    if (linkedCount > 0) {
      return NextResponse.json({ error: "Cannot delete: product has invoice items" }, { status: 400 });
    }
    await prisma.$transaction(async (tx) => {
      await tx.media.deleteMany({ where: { productId: id, kind: "PRODUCT" } });
      await tx.product.delete({ where: { id } });
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("/api/products DELETE error", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}

const UpdateProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  capacity: z.string().min(1).optional(),
  price: z.number().positive().optional(),
  stockQty: z.number().int().min(0).optional(),
  notes: z.string().max(5000).nullable().optional(),
  // accept absolute or relative URLs
  imageUrl: z.string().min(1).nullable().optional(),
  imageBlurDataUrl: z.string().min(1).nullable().optional(),
  // free-form properties edited by admin/manager only
  properties: z.record(z.string(), z.any()).nullable().optional(),
});

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any)?.role as string | undefined;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await req.text();
  let body: any = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
  const parsed = UpdateProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });
  }

  const { id, name, capacity, price, stockQty, notes, imageUrl, imageBlurDataUrl, properties } = parsed.data;
  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (imageUrl !== undefined) {
        // If provided null -> delete images. If provided string -> replace with new.
        await tx.media.deleteMany({ where: { productId: id, kind: "PRODUCT" } });
      }
      const prod = await tx.product.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(capacity !== undefined ? { capacity } : {}),
          ...(price !== undefined ? { price } : {}),
          ...(stockQty !== undefined ? { stockQty } : {}),
          ...(notes !== undefined ? { notes } : {}),
          ...(properties !== undefined ? { properties: properties as any } : {}),
          ...(imageUrl ? { images: { create: [{ url: imageUrl, kind: "PRODUCT", blurDataUrl: imageBlurDataUrl || undefined }] } } : {}),
        },
        include: { images: true },
      });
      return prod;
    });
    return NextResponse.json({ product: updated });
  } catch (err) {
    console.error("/api/products PATCH error", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

const CreateProductSchema = z.object({
  name: z.string().min(1),
  capacity: z.string().min(1),
  price: z.number().positive(),
  stockQty: z.number().int().min(0).default(0),
  notes: z.string().max(5000).optional(),
  // accept absolute or relative URLs
  imageUrl: z.string().min(1).optional(),
  imageBlurDataUrl: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Only ADMIN or MANAGER can create products
  const role = (session.user as any)?.role as string | undefined;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await req.text();
  let body: any = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
  const parsed = CreateProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });
  }

  const { name, capacity, price, stockQty, notes, imageUrl, imageBlurDataUrl } = parsed.data;
  try {
    const created = await prisma.product.create({
      data: {
        name,
        capacity,
        price,
        stockQty,
        ...(notes ? { notes } : {}),
        images: imageUrl ? { create: [{ url: imageUrl, kind: "PRODUCT", blurDataUrl: imageBlurDataUrl || undefined }] } : undefined,
      },
      include: { images: true },
    });
    return NextResponse.json({ product: created }, { status: 201 });
  } catch (err: any) {
    console.error("/api/products POST error", err);
    const msg = err?.code === "P2002" ? "Product name must be unique" : "Create failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
