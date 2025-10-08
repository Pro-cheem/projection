const { PrismaClient } = require('@prisma/client');

function getArg(name, fallback){
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && process.argv[idx+1]) return process.argv[idx+1];
  return fallback;
}

(async () => {
  const prisma = new PrismaClient();
  const name = getArg('name', null);
  const email = getArg('email', null);
  const role = getArg('role', 'MANAGER');
  if (!email) { console.error('Missing --email'); process.exit(1); }
  try {
    let user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      if (user.role !== role) {
        user = await prisma.user.update({ where: { id: user.id }, data: { role } });
      }
    } else {
      user = await prisma.user.create({ data: { name: name || email.split('@')[0], email, role } });
    }
    console.log(JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role }));
  } catch (e) {
    console.error(e?.message || e);
    process.exit(2);
  } finally {
    await prisma.$disconnect();
  }
})();
