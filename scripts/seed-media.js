// Seed LOGO and BACKGROUND media records to satisfy /api/media
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // choose some existing public assets; API accepts absolute or relative URLs
  const logoUrl = "/uploads/Untitled-1-01-mfyggy41.webp";
  const backgroundUrl = "/uploads/fastzencosize-mfyhqass.webp";

  // Create LOGO
  await prisma.media.create({ data: { kind: 'LOGO', url: logoUrl } });
  console.log('Seeded LOGO:', logoUrl);

  // Create BACKGROUND
  await prisma.media.create({ data: { kind: 'BACKGROUND', url: backgroundUrl } });
  console.log('Seeded BACKGROUND:', backgroundUrl);
}

main()
  .catch((e) => {
    console.error('Seed media error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
