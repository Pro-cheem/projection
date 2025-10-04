import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  phone: z.string().min(5).max(30),
  email: z.string().email(),
});

export async function POST(req: Request) {
  try {
    // Only ADMIN can create users
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // @ts-expect-error custom role on session
    const role: string | undefined = session.user?.role;
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const json = await req.json();
    const parsed = createUserSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });
    }
    const { username, phone, email } = parsed.data;

    // Create requester if not exists by email
    const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
    if (existing) {
      return NextResponse.json({ error: "User with this email or username already exists." }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        username,
        phone,
        email,
        role: "REQUESTER",
      },
      select: { id: true, username: true, phone: true, email: true, role: true },
    });

    return NextResponse.json({ message: "User created", user }, { status: 201 });
  } catch (err) {
    console.error("/api/users POST error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
