/**
 * ============================================================================
 * FitFlow Caraguá — Service de Alunos
 * ============================================================================
 * Centraliza a lógica de negócio dos estudantes da academia.
 * Atua duplamente entre as tabelas `User` (autenticação) e `Student` (dados).
 */

const { prisma } = require('../config/prisma');
const AppError = require('../utils/AppError');
const bcrypt = require('bcryptjs');
const planosService = require('./planos.service');

class AlunosService {
  /**
   * Lista todos os alunos (desconsidera os desativados fisicamente caso 
   * regras mudem, mas foca em carregar planos e emails associados).
   */
  async listar() {
    return prisma.student.findMany({
      where: {
        user: { active: true }, // Filtra apenas usuários não-deletados (soft-delete).
      },
      include: {
        user: {
          select: { name: true, email: true },
        },
        plan: {
          select: { name: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Busca um aluno específico carregando todos seus vínculos.
   */
  async buscarPorId(id) {
    const aluno = await prisma.student.findUnique({
      where: { id: Number(id) },
      include: {
        user: { select: { name: true, email: true, active: true } },
        plan: { select: { name: true, price: true } },
      },
    });

    if (!aluno) throw new AppError('Aluno não encontrado.', 404);
    return aluno;
  }

  /**
   * Realiza a Matrícula (Criação de User e Student em transação única).
   */
  async criar(data) {
    const { name, email, cpf, phone, birthDate, address, notes, planId } = data;

    // 1. Validação de Unicidade
    const emailExists = await prisma.user.findUnique({ where: { email } });
    if (emailExists) throw new AppError('Já existe um usuário com este e-mail.', 400);

    if (cpf) {
      const cpfExists = await prisma.student.findUnique({ where: { cpf } });
      if (cpfExists) throw new AppError('Este CPF já está cadastrado no sistema.', 400);
    }

    // 2. Senha Padrão
    // Por enquanto, todos os alunos ganham 'fitflow123' como primeira senha.
    const salt = await bcrypt.genSalt(10);
    const defaultPassword = await bcrypt.hash('fitflow123', salt);

    // 3. Verifica o plano escolhido e calcula o vencimento
    let planStartDate = null;
    let planEndDate = null;

    if (planId) {
      const plano = await planosService.buscarPorId(planId);
      if (!plano.active) throw new AppError('Não é possível matricular em um plano inativo.', 400);
      
      planStartDate = new Date();
      planEndDate = planosService.calcularVencimento(plano.durationDays, planStartDate);
    }

    // 4. Nested Write (Prisma): Cria User e já vincula o Student na mesma transação.
    const novoAluno = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: defaultPassword,
        role: 'student',
        student: {
          create: {
            cpf: cpf || null,
            phone: phone || null,
            birthDate: birthDate ? new Date(birthDate) : null,
            address: address || null,
            notes: notes || null,
            planId: planId ? Number(planId) : null,
            planStartDate,
            planEndDate,
            status: 'active', // Status logístico/financeiro da mensalidade
          },
        },
      },
      include: {
        student: true,
      },
    });

    return novoAluno;
  }

  /**
   * Edita dados do Aluno. Requer update tanto em User (nome/email)
   * quanto em Student (cpf/telefone...).
   */
  async atualizar(id, data) {
    const studentId = Number(id);
    const { name, email, cpf, phone, birthDate, address, notes, status, planId } = data;

    // Garante que o aluno alvo existe
    const alunoAlvo = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true },
    });
    if (!alunoAlvo) throw new AppError('Aluno não encontrado.', 404);

    // Valida colisões de Email e CPF pertencentes a DE FATO outras pessoas
    if (email && email !== alunoAlvo.user.email) {
      const emailEmUso = await prisma.user.findUnique({ where: { email } });
      if (emailEmUso) throw new AppError('E-mail já pertence a outra conta.', 400);
    }

    if (cpf && cpf !== alunoAlvo.cpf) {
      const cpfEmUso = await prisma.student.findUnique({ where: { cpf } });
      if (cpfEmUso) throw new AppError('CPF já cadastrado para outro aluno.', 400);
    }

    // Verificação de alteração de plano
    let updatePlanData = {};
    if (planId && Number(planId) !== alunoAlvo.planId) {
      const plano = await planosService.buscarPorId(planId);
      if (!plano.active) throw new AppError('Não é possível alterar para um plano inativo.', 400);
      
      const startDate = new Date();
      updatePlanData = {
        planId: Number(planId),
        planStartDate: startDate,
        planEndDate: planosService.calcularVencimento(plano.durationDays, startDate)
      };
    } else if (planId === null) {
      // Se mandar null explícito, removemos o plano e as datas.
      updatePlanData = {
        planId: null,
        planStartDate: null,
        planEndDate: null
      };
    }

    // Como as informações estão distribuídas, faremos um update encadeado ($transaction).
    const resultado = await prisma.$transaction([
      prisma.user.update({
        where: { id: alunoAlvo.userId },
        data: {
          name: name ?? alunoAlvo.user.name,
          email: email ?? alunoAlvo.user.email,
        },
      }),
      prisma.student.update({
        where: { id: studentId },
        data: {
          cpf: cpf !== undefined ? cpf : alunoAlvo.cpf,
          phone: phone !== undefined ? phone : alunoAlvo.phone,
          address: address !== undefined ? address : alunoAlvo.address,
          notes: notes !== undefined ? notes : alunoAlvo.notes,
          status: status ?? alunoAlvo.status,
          birthDate: birthDate ? new Date(birthDate) : alunoAlvo.birthDate,
          ...updatePlanData // Propaga as datas de plano, se houver alteração
        },
      }),
    ]);

    return resultado[1]; // Retorna a entidade Student atualizada
  }

  /**
   * "Corta" um aluno do sistema, mas bloqueando visualizações ao invés
   * de apagar de vez usando DELETE e perdendo relatórios financeiros de meses atrás.
   */
  async desativar(id) {
    const aluno = await prisma.student.findUnique({ where: { id: Number(id) } });
    if (!aluno) throw new AppError('Aluno não encontrado.', 404);

    // Update atômico no User desativando seu acesso de auth e transmutando sua status
    await prisma.user.update({
      where: { id: aluno.userId },
      data: { active: false },
    });

    return prisma.student.update({
      where: { id: Number(id) },
      data: { status: 'inactive' },
    });
  }
}

module.exports = new AlunosService();
