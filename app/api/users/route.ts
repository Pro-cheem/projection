import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcrypt";

const createUserSchema = z.object({
  name: z.string().max(100).optional(),
  username: z.string().min(3).max(50),
  phone: z.string().min(5).max(30),
  email: z.string().email(),
  password: z.string().min(4).max(100),
  role: z.enum(["REQUESTER", "EMPLOYEE", "MANAGER", "ADMIN"]).default("REQUESTER"),
});

export async function POST(req: Request) {
  try {
    // Only MANAGER can create users
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // @ts-expect-error custom role on session
    const role: string | undefined = session.user?.role;
    if (role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const json = await req.json();
    const parsed = createUserSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });
    }
    const { name, username, phone } = parsed.data;
    const email = parsed.data.email.toLowerCase();
    const newUserRole = parsed.data.role;
    const password = parsed.data.password;

    // Create requester if not exists by email
    const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
    if (existing) {
      return NextResponse.json({ error: "User with this email or username already exists." }, { status: 409 });
    }

    const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;

    const user = await prisma.user.create({
      data: {
        name: name && name.trim() ? name.trim() : undefined,
        username,
        phone,
        email,
        role: newUserRole,
        ...(passwordHash ? { passwordHash } : {}),
      },
      select: { id: true, name: true, username: true, phone: true, email: true, role: true },
    });

    return NextResponse.json({ message: "User created", user }, { status: 201 });
  } catch (err) {
    console.error("/api/users POST error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
