import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const HeroUploadSchema = z.object({
  heroNumber: z.enum(["1", "2", "3"]),
  file: z.instanceof(File),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any)?.role as string | undefined;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const heroNumber = formData.get("heroNumber") as string;
    const file = formData.get("file") as File;

    if (!file || !heroNumber) {
      return NextResponse.json({ error: "Missing file or hero number" }, { status: 400 });
    }

    // Validate hero number
    if (!["1", "2", "3"].includes(heroNumber)) {
      return NextResponse.json({ error: "Invalid hero number" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be less than 5MB" }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Process image with Sharp for optimization
    const sharp = (await import("sharp")).default;
    const processedBuffer = await sharp(buffer)
      .resize(1000, 600, {
        fit: "cover",
        position: "center"
      })
      .webp({ quality: 80 })
      .toBuffer();

    // Convert to base64 for storage or upload to Cloudinary if available
    let imageUrl: string;

    if (process.env.CLOUDINARY_URL) {
      // Upload to Cloudinary
      const cloudinary = (await import("cloudinary")).v2;
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });

      const uploadResult = await new Promise<any>((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            resource_type: "image",
            format: "webp",
            transformation: [
              { width: 1000, height: 600, crop: "fill" },
              { quality: "80" }
            ]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(processedBuffer);
      });

      imageUrl = uploadResult.secure_url;
    } else {
      // Save locally in development
      const fs = (await import("fs")).default;
      const path = (await import("path")).default;

      // Ensure uploads directory exists
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const filename = `hero${heroNumber}-${timestamp}.webp`;
      const filepath = path.join(uploadsDir, filename);

      // Write file
      fs.writeFileSync(filepath, processedBuffer);

      // Return public URL
      imageUrl = `/uploads/${filename}`;
    }

    // Update site config with the new hero image URL
    const heroUrlKey = `hero${heroNumber}Url` as const;
    const heroLinkKey = `hero${heroNumber}Link` as const;

    const cfg = await prisma.siteConfig.upsert({
      where: { id: "singleton" },
      update: {
        [heroUrlKey]: imageUrl,
      },
      create: {
        id: "singleton",
        [heroUrlKey]: imageUrl,
      },
    });

    return NextResponse.json({
      success: true,
      url: imageUrl,
      config: cfg
    });

  } catch (error) {
    console.error("Hero image upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
