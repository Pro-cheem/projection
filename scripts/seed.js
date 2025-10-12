// Comprehensive seed script to create initial data
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Check if products already exist
  const existingCount = await prisma.product.count();
  if (existingCount > 0) {
    console.log(`Products already exist: ${existingCount}. Skipping product creation.`);
  } else {
    // Create sample products
    await prisma.product.createMany({
      data: [
        {
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
        {
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
        {
          name: 'مبيد حشري',
          capacity: '500 مل',
          price: 45,
          stockQty: 75,
          notes: 'مبيد آمن للاستخدام المنزلي',
          properties: {
            composition: 'مادة عضوية 100%',
            features: 'غير ضار بالبيئة والحيوانات الأليفة',
            usage: 'رش حسب الحاجة عند ظهور الحشرات'
          }
        }
      ],
    });

    console.log('✅ Sample products created');
  }

  // Create site configuration if not exists
  const siteConfigExists = await prisma.siteConfig.findUnique({ where: { id: 'singleton' } });
  if (!siteConfigExists) {
    await prisma.siteConfig.create({
      data: {
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
    console.log('✅ Site configuration created');
  } else {
    console.log('ℹ️ Site configuration already exists');
  }

  // Create admin user if not exists
  const adminExists = await prisma.user.findUnique({ where: { email: 'admin@example.com' } });
  if (!adminExists) {
    const adminPassword = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
      data: {
        email: 'admin@example.com',
        name: 'Admin User',
        passwordHash: adminPassword,
        role: 'ADMIN',
        emailVerified: new Date(),
      },
    });
    console.log('✅ Admin user created');
  } else {
    console.log('ℹ️ Admin user already exists');
  }

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
