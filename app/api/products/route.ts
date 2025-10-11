import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { properties: { equals: null } as any },
          { NOT: { properties: { path: ["archived"], equals: true } as any } },
        ],
      },
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
  type: z.enum(["COMPANY","OTHER"]).optional(),
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

  const { id, name, capacity, price, stockQty, notes, imageUrl, imageBlurDataUrl, properties, type } = parsed.data;
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Load current properties for merging
      const current = await tx.product.findUnique({ where: { id }, select: { properties: true } });
      const mergedProps = (() => {
        const base = (current?.properties ?? {}) as any;
        let out = base && typeof base === 'object' ? { ...base } : {} as any;
        if (properties !== undefined) {
          if (properties === null) out = {};
          else out = { ...out, ...(properties as any) };
        }
        if (type !== undefined) out.type = type;
        return out;
      })();
      if (imageUrl !== undefined) {
        // If provided null -> delete images. If provided string -> replace with new.
        await tx.media.deleteMany({ where: { productId: id, kind: "PRODUCT" } });
      }
      const updated = await tx.product.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(capacity !== undefined ? { capacity } : {}),
          ...(price !== undefined ? { price } : {}),
          ...(stockQty !== undefined ? { stockQty } : {}),
          ...(notes !== undefined ? { notes } : {}),
          ...(properties !== undefined || type !== undefined ? { properties: mergedProps as any } : {}),
          ...(imageUrl ? { images: { create: [{ url: imageUrl, kind: "PRODUCT", blurDataUrl: imageBlurDataUrl || undefined }] } } : {}),
        },
        include: { images: true },
      });

      // If stock becomes zero, attempt auto-delete if safe (no linked invoice items)
      const finalStock = stockQty !== undefined ? stockQty : updated.stockQty;
      if (typeof finalStock === "number" && finalStock <= 0) {
        const linkedCount = await tx.invoiceItem.count({ where: { productId: id } });
        if (linkedCount === 0) {
          await tx.media.deleteMany({ where: { productId: id, kind: "PRODUCT" } });
          await tx.product.delete({ where: { id } });
          return { deleted: true as const };
        } else {
          // Archive instead of delete to preserve invoice references
          await tx.media.deleteMany({ where: { productId: id, kind: "PRODUCT" } });
          const archivedName = `${updated.name} [ARCHIVED ${Date.now()}]`;
          const existingProps = (updated.properties ?? {}) as any;
          const newProps = (existingProps && typeof existingProps === 'object')
            ? { ...existingProps, archived: true }
            : { archived: true };
          const archived = await tx.product.update({
            where: { id },
            data: {
              name: archivedName,
              stockQty: 0,
              // Mark archived in JSON properties while preserving existing keys
              properties: newProps as any,
            },
            include: { images: true },
          });
          return { archived: true as const, product: archived };
        }
      }

      return { product: updated } as const;
    });

    if ('deleted' in result && result.deleted) {
      return NextResponse.json({ deleted: true });
    }
    return NextResponse.json(result);
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
  // optional free-form properties at creation
  properties: z.record(z.string(), z.any()).optional(),
  type: z.enum(["COMPANY","OTHER"]).optional(),
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

  const { name, capacity, price, stockQty, notes, imageUrl, imageBlurDataUrl, properties, type } = parsed.data;
  try {
    const created = await prisma.product.create({
      data: {
        name,
        capacity,
        price,
        stockQty,
        ...(notes ? { notes } : {}),
        ...(properties || type ? { properties: { ...(properties as any || {}), ...(type ? { type } : {}) } as any } : {}),
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
