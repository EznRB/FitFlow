const { prisma, disconnectPrisma } = require('../src/config/prisma');
const bcrypt = require('bcryptjs');

async function fix() {
  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('admin123', salt);
    
    await prisma.user.update({
      where: { email: 'admin@fitflow.com' },
      data: { passwordHash: passwordHash }
    });
    console.log('Senha de admin@fitflow.com atualizada para admin123');
  } catch (err) {
    console.error('Erro ao atualizar admin:', err.message);
  } finally {
    await disconnectPrisma();
  }
}

fix();
