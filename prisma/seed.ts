import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create admin user if not exists
  const adminEmail = 'admin@example.com';
  const adminPassword = await hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Admin User',
      passwordHash: adminPassword,
      role: 'ADMIN',
      emailVerified: new Date(),
    },
  });

  console.log(`👤 Admin user created: ${admin.email}`);

  // Create site configuration if not exists
  const siteConfig = await prisma.siteConfig.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      hero1Url: null,
      hero1Link: null,
      hero2Url: null,
      hero2Link: null,
      hero3Url: null,
      hero3Link: null,
      aboutTitle: null,
      aboutBody: null,
    },
  });

  console.log(`⚙️ Site configuration created: ${siteConfig.id}`);

  // Create sample products for testing
  const product1 = await prisma.product.upsert({
    where: { name: 'سماد متعدد الأغراض' },
    update: {},
    create: {
      name: 'سماد متعدد الأغراض',
      capacity: '25 كيلو',
      price: 150,
      stockQty: 100,
      notes: 'سماد عالي الجودة لجميع أنواع النباتات',
      properties: {
        composition: 'N 20%, P 20%, K 20%',
        features: 'يحتوي على جميع العناصر الغذائية الأساسية',
        usage: 'استخدم 1-2 كوب لكل نبات كل شهر'
      }
    },
  });

  const product2 = await prisma.product.upsert({
    where: { name: 'مبيد فطري' },
    update: {},
    create: {
      name: 'مبيد فطري',
      capacity: '1 لتر',
      price: 75,
      stockQty: 50,
      notes: 'مبيد آمن وفعال لمكافحة الفطريات',
      properties: {
        composition: 'مادة فعالة بنسبة 25%',
        features: 'يحمي النباتات من جميع أنواع الفطريات',
        usage: 'رش مرة كل أسبوعين'
      }
    },
  });

  console.log(`🌱 Sample products created: ${product1.name}, ${product2.name}`);

  console.log('✅ Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
