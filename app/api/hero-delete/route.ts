import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const DeleteHeroSchema = z.object({
  heroNumber: z.enum(["1", "2", "3"]),
});

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any)?.role as string | undefined;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { heroNumber } = DeleteHeroSchema.parse(body);

    // Update site config to remove the hero image URL
    const heroUrlKey = `hero${heroNumber}Url` as const;

    const cfg = await prisma.siteConfig.upsert({
      where: { id: "singleton" },
      update: {
        [heroUrlKey]: null,
      },
      create: {
        id: "singleton",
        [heroUrlKey]: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `تم حذف صورة الواجهة ${heroNumber} بنجاح`,
      config: cfg
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
    }

    console.error("Hero image delete error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
