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
const { validateAccount } = require('../utils/accountValidation');
const { brazilDate, paymentDate } = require('../utils/paymentValidation');
const { lockStudent } = require('../utils/membershipRenewal');

function optionalCpf(value) {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string' || value.trim().length > 14) throw new AppError('CPF deve ser um texto com até 14 caracteres.', 400);
  return value.trim() || null;
}
function optionalBirthDate(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return paymentDate(value);
}

class AlunosService {
  constructor({ db = prisma, plans = planosService, now = () => new Date() } = {}) { this.db = db; this.plans = plans; this.now = now; }
  /**
   * Lista todos os alunos (desconsidera os desativados fisicamente caso 
   * regras mudem, mas foca em carregar planos e emails associados).
   */
  async listar() {
    return this.db.student.findMany({
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
    const aluno = await this.db.student.findUnique({
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
    const { name, email, password } = validateAccount(data);
    const { phone, address, notes, planId } = data;
    const cpf = optionalCpf(data.cpf), birthDate = optionalBirthDate(data.birthDate);

    // 1. Validação de Unicidade
    const emailExists = await this.db.user.findUnique({ where: { email } });
    if (emailExists) throw new AppError('Já existe um usuário com este e-mail.', 400);

    if (cpf) {
      const cpfExists = await this.db.student.findUnique({ where: { cpf } });
      if (cpfExists) throw new AppError('Este CPF já está cadastrado no sistema.', 400);
    }

    // Cada matrícula exige uma senha própria validada antes de acessar o banco.
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 3. Verifica o plano escolhido e calcula o vencimento
    let planStartDate = null;
    let planEndDate = null;

    if (planId) {
      const plano = await this.plans.buscarPorId(planId);
      if (!plano.active) throw new AppError('Não é possível matricular em um plano inativo.', 400);
      
      planStartDate = brazilDate(this.now());
      planEndDate = this.plans.calcularVencimento(plano.durationDays, planStartDate);
    }

    // 4. Nested Write (Prisma): Cria User e já vincula o Student na mesma transação.
    const novoAluno = await this.db.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: 'student',
        student: {
          create: {
            cpf: cpf || null,
            phone: phone || null,
            birthDate: birthDate ?? null,
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

    const { passwordHash: _, ...safeStudent } = novoAluno;
    return safeStudent;
  }

  /**
   * Edita dados do Aluno. Requer update tanto em User (nome/email)
   * quanto em Student (cpf/telefone...).
   */
  async atualizar(id, data) {
    const studentId = Number(id);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AppError('Dados do aluno inválidos.', 400);
    const { name, email, phone, address, notes, status, planId } = data;
    const cpf = optionalCpf(data.cpf), birthDate = optionalBirthDate(data.birthDate);

    // Garante que o aluno alvo existe
    const alunoAlvo = await this.db.student.findUnique({
      where: { id: studentId },
      include: { user: true },
    });
    if (!alunoAlvo) throw new AppError('Aluno não encontrado.', 404);

    // Valida colisões de Email e CPF pertencentes a DE FATO outras pessoas
    if (email && email !== alunoAlvo.user.email) {
      const emailEmUso = await this.db.user.findUnique({ where: { email } });
      if (emailEmUso) throw new AppError('E-mail já pertence a outra conta.', 400);
    }

    if (cpf && cpf !== alunoAlvo.cpf) {
      const cpfEmUso = await this.db.student.findUnique({ where: { cpf } });
      if (cpfEmUso) throw new AppError('CPF já cadastrado para outro aluno.', 400);
    }

    return this.db.$transaction(async tx => {
      await lockStudent(tx, studentId);
      const current = await tx.student.findUnique({ where: { id: studentId }, include: { user: true } });
      if (!current) throw new AppError('Aluno não encontrado.', 404);
      let updatePlanData = {};
      if (planId && Number(planId) !== current.planId) {
        const plano = await tx.plan.findUnique({ where: { id: Number(planId) } });
        if (!plano?.active) throw new AppError('Não é possível alterar para um plano inativo.', 400);
        const startDate = brazilDate(this.now());
        updatePlanData = { planId: Number(planId), planStartDate: startDate,
          planEndDate: this.plans.calcularVencimento(plano.durationDays, startDate) };
      } else if (planId === null) {
        updatePlanData = { planId: null, planStartDate: null, planEndDate: null };
      }
      const membershipChanged = Object.keys(updatePlanData).length > 0 || (status != null && status !== current.status);
      if (membershipChanged && (!Number.isSafeInteger(data.expectedMembershipRevision) || data.expectedMembershipRevision < 0 ||
          data.expectedMembershipRevision !== current.membershipRevision)) throw new AppError('A matrícula mudou ou sua revisão não foi informada. Recarregue antes de alterar o plano ou a situação.', 409);
      await tx.user.update({ where: { id: current.userId }, data: {
        ...(name != null ? { name } : {}), ...(email != null ? { email } : {}) } });
      return tx.student.update({ where: { id: studentId }, data: {
        ...(cpf !== undefined ? { cpf } : {}), ...(phone !== undefined ? { phone } : {}),
        ...(address !== undefined ? { address } : {}), ...(notes !== undefined ? { notes } : {}),
        ...(status != null ? { status } : {}), ...(birthDate !== undefined ? { birthDate } : {}),
        ...updatePlanData, ...(membershipChanged ? { membershipRevision: { increment: 1 } } : {}) } });
    });
  }

  /**
   * "Corta" um aluno do sistema, mas bloqueando visualizações ao invés
   * de apagar de vez usando DELETE e perdendo relatórios financeiros de meses atrás.
   */
  async desativar(id) {
    const studentId = Number(id);
    return this.db.$transaction(async tx => {
      await lockStudent(tx, studentId);
      const aluno = await tx.student.findUnique({ where: { id: studentId } });
      if (!aluno) throw new AppError('Aluno não encontrado.', 404);
      await tx.user.update({ where: { id: aluno.userId }, data: { active: false } });
      return tx.student.update({ where: { id: studentId }, data: { status: 'inactive', membershipRevision: { increment: 1 } } });
    });
  }
}

module.exports = new AlunosService();
module.exports.createAlunosService = options => new AlunosService(options);
