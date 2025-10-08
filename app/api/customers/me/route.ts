import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // @ts-expect-error custom
  const role: string | undefined = session.user?.role;
  const email: string | undefined = (session.user as any)?.email;

  if (role !== "REQUESTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!email) return NextResponse.json({ error: "No email on session" }, { status: 400 });

  try {
    const customer = await prisma.customer.findFirst({ where: { email: email }, select: { id: true } });
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    return NextResponse.json({ id: customer.id });
  } catch (e) {
    console.error("GET /api/customers/me", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
