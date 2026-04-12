const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const admin = await prisma.user.findUnique({ where: { email: 'admin@fitflow.com' } });
  console.log('Current admin:', admin);
  
  if (admin && admin.role !== 'admin') {
    console.log('Forcing role to admin!');
    const updated = await prisma.user.update({
      where: { email: 'admin@fitflow.com' },
      data: { role: 'admin' }
    });
    console.log('Updated:', updated);
  }
}
check().finally(() => prisma.$disconnect());
