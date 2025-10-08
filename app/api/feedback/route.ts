import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const FeedbackSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب").max(200),
  phone: z.string().min(5, "رقم الهاتف مطلوب").max(50),
  message: z.string().min(5, "الرسالة مطلوبة").max(5000),
});
export async function POST(req: Request) {
  try {
    const raw = await req.text();
    let body: any = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
    const parsed = FeedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });
    }
    const { name, phone, message } = parsed.data;
    const fb = await prisma.feedback.create({ data: { name, phone, message } });
    return NextResponse.json({ feedback: { id: fb.id } }, { status: 201 });
  } catch (err) {
    console.error("/api/feedback POST error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  // Only MANAGER can read feedback
  // @ts-expect-error custom role
  const role: string | undefined = session?.user?.role;
  if (role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  try {
    if (action === "count") {
      const count = await prisma.feedback.count();
      return NextResponse.json({ count });
    }
    const items = await prisma.feedback.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ feedback: items });
  } catch (err) {
    console.error("/api/feedback GET error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
