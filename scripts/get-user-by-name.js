const { PrismaClient } = require('@prisma/client');

function getArg(name, fallback){
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && process.argv[idx+1]) return process.argv[idx+1];
  return fallback;
}

(async () => {
  const name = getArg('name');
  if (!name) { console.error('Missing --name'); process.exit(1); }
  const prisma = new PrismaClient();
  try {
    const u = await prisma.user.findFirst({ where: { name }, select: { id: true, name: true, email: true, role: true } });
    if (!u) { console.error('User not found'); process.exit(2); }
    console.log(JSON.stringify(u));
  } catch (e) {
    console.error(e?.message || e);
    process.exit(3);
  } finally {
    await prisma.$disconnect();
  }
})();
