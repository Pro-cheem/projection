const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true } });
    console.log(JSON.stringify(users, null, 2));
  } catch (e) {
    console.error(e?.message || e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
