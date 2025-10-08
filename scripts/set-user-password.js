const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

function getArg(name){
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i+1] : undefined;
}

(async () => {
  const email = getArg('email');
  const password = getArg('password');
  if (!email || !password) { console.error('Usage: node scripts/set-user-password.js --email <EMAIL> --password <PASSWORD>'); process.exit(1); }
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { console.error('User not found'); process.exit(2); }
    const passwordHash = await bcrypt.hash(String(password), 10);
    const updated = await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    console.log(JSON.stringify({ id: updated.id, email: updated.email, ok: true }));
  } catch (e) {
    console.error(e?.message || e);
    process.exit(3);
  } finally {
    await prisma.$disconnect();
  }
})();
