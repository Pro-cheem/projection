// Seed basic data: products with stock and two customers owned by admin
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'elsiaad.motawee@gmail.com';
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    throw new Error(`Admin user not found: ${adminEmail}. Run seed-admin.js first.`);
  }

  // Upsert products with stock > 0
  const products = [
    { name: 'Acid Alpha', capacity: '20L', price: 150.0, stockQty: 25 },
    { name: 'Base Beta', capacity: '10L', price: 95.0, stockQty: 40 },
    { name: 'Solvent Prime', capacity: '5L', price: 50.0, stockQty: 60 },
  ];

  for (const p of products) {
    const existing = await prisma.product.findUnique({ where: { name: p.name } });
    if (!existing) {
      await prisma.product.create({ data: p });
      console.log('Created product', p.name);
    } else {
      await prisma.product.update({ where: { id: existing.id }, data: { capacity: p.capacity, price: p.price, stockQty: p.stockQty } });
      console.log('Updated product', p.name);
    }
  }

  // Ensure two customers
  async function ensureCustomer(name, phone) {
    let c = await prisma.customer.findFirst({ where: { name, ownerId: admin.id } });
    if (!c) {
      c = await prisma.customer.create({ data: { name, ownerId: admin.id, phone, totalDebt: 0 } });
      console.log('Created customer', name);
    }
    return c;
  }
  await ensureCustomer('مصنع الشرق', '0100000001');
  await ensureCustomer('شركة الغرب', '0100000002');

  console.log('✅ Seeded basic demo data.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
