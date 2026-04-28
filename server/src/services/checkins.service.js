/**
 * ============================================================================
 * FitFlow Caraguá — Service de Check-ins (TASK 08)
 * ============================================================================
 * Centraliza toda a lógica de negócios de presença/frequência.
 * 
 * Regras de Negócio Implementadas:
 * 1. Um aluno só pode ter 1 check-in por dia (duplicidade = erro 409).
 * 2. Check-in registra data, hora e quem efetuou o registro.
 * 3. Check-in NÃO pode ser deletado — apenas cancelado por admin com motivo.
 * 4. Aluno bloqueado (inadimplente) NÃO pode fazer check-in.
 * 5. Histórico é imutável e preservado para relatórios.
 */

const checkinsRepository = require('../repositories/checkins.repository');
const { prisma } = require('../config/prisma');
const AppError = require('../utils/AppError');
const businessRules = require('../utils/businessRules');

class CheckinsService {
  /**
   * REGRA PRINCIPAL — Registrar check-in do dia.
   * 
   * Fluxo:
   * 1. Valida se o studentId foi informado.
   * 2. Verifica se o aluno existe e está ativo (não bloqueado/inativo).
   * 3. Verifica se já existe check-in no dia para esse aluno.
   * 4. Se não existe, cria o registro com data/hora e quem registrou.
   * 
   * @param {number} studentId - ID do aluno
   * @param {number|null} registeredBy - ID do usuário que registrou (admin ou próprio aluno)
   * @returns {object} Check-in criado
   * @throws {AppError} 409 se duplicado, 404 se aluno não existe, 400 se bloqueado
   */
  async registrar(studentId, registeredBy = null) {
    if (!studentId) throw new AppError('ID do aluno é obrigatório.', 400);

    // 1. Busca o aluno para validar existência e status
    const aluno = await prisma.student.findUnique({
      where: { id: parseInt(studentId) },
      include: { user: { select: { name: true, active: true } } },
    });

    // 2. Verifica se já existe check-in no dia (somente status 'present')
    const checkinExistente = await checkinsRepository.hasCheckedInToday(studentId);

    // DELEGA PARA A CAMADA CENTRAL DE REGRAS DE NEGÓCIO
    // Valida duplicidade, existência e bloqueio
    businessRules.validateCheckIn(aluno, checkinExistente);

    // 3. Registra o check-in
    const checkin = await checkinsRepository.create(studentId, registeredBy);
    return checkin;
  }

  /**
   * Lista check-ins com filtros opcionais.
   * Suporta filtro por aluno, data e período.
   * 
   * @param {object} filters - { studentId, date, startDate, endDate, incluirCancelados }
   */
  async listar(filters = {}) {
    return checkinsRepository.findAll(filters);
  }

  /**
   * Busca histórico de check-ins de um aluno específico.
   * Verifica se o aluno existe antes de buscar.
   */
  async buscarPorAluno(alunoId, filters = {}) {
    if (!alunoId) throw new AppError('ID do aluno é obrigatório.', 400);

    const aluno = await prisma.student.findUnique({
      where: { id: parseInt(alunoId) },
    });
    if (!aluno) throw new AppError('Aluno não encontrado.', 404);

    return checkinsRepository.findByStudentId(alunoId, filters);
  }

  /**
   * Resumo de check-ins do dia atual.
   * Retorna total, lista de quem fez check-in e horários.
   */
  async resumoHoje() {
    const [total, checkins] = await Promise.all([
      checkinsRepository.countToday(),
      checkinsRepository.findToday(),
    ]);

    return {
      totalHoje: total,
      checkins: checkins.map(c => ({
        id: c.id,
        alunoNome: c.student?.user?.name || '—',
        studentId: c.studentId,
        horario: c.createdAt
          ? new Date(c.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : '—',
        status: c.status,
      })),
    };
  }

  /**
   * Ranking de frequência dos alunos nos últimos N dias.
   * Retorna studentId + contagem, enriquecido com nomes.
   */
  async frequenciaPorAluno(days = 30) {
    const ranking = await checkinsRepository.frequencyByStudent(days);

    // Enriquece com dados do aluno
    const studentIds = ranking.map(r => r.studentId);
    const alunos = await prisma.student.findMany({
      where: { id: { in: studentIds } },
      include: { user: { select: { name: true } } },
    });
    const alunoMap = {};
    alunos.forEach(a => { alunoMap[a.id] = a.user?.name || `Aluno #${a.id}`; });

    return ranking.map(r => ({
      studentId: r.studentId,
      nome: alunoMap[r.studentId] || `Aluno #${r.studentId}`,
      totalCheckins: r._count.studentId,
    }));
  }

  /**
   * FLUXO ADMINISTRATIVO — Cancelar check-in.
   * 
   * ⚠️ Não deleta o registro. Marca como 'cancelled' com:
   * - Motivo obrigatório (cancelReason)
   * - Quem cancelou (cancelledBy)
   * - Quando cancelou (cancelledAt)
   * 
   * Isso preserva o histórico e permite auditoria completa.
   */
  async cancelarCheckin(checkinId, motivo, adminId) {
    if (!checkinId) throw new AppError('ID do check-in é obrigatório.', 400);
    if (!motivo || motivo.trim().length < 5) {
      throw new AppError('Motivo do cancelamento é obrigatório (mínimo 5 caracteres).', 400);
    }
    if (!adminId) throw new AppError('ID do administrador é obrigatório.', 400);

    // Valida exclusão física de acordo com a regra de negócio central
    // Observação: se alguém tentar invocar uma função de deleção que não seja cancelar,
    // a regra bloqueará. Aqui, apenas validamos as permissões gerais se necessário.
    
    // 1. Verifica se o check-in existe
    const checkin = await checkinsRepository.findById(checkinId);
    if (!checkin) throw new AppError('Check-in não encontrado.', 404);

    // 2. Verifica se já está cancelado
    if (checkin.status === 'cancelled') {
      throw new AppError('Este check-in já foi cancelado anteriormente.', 400);
    }

    // 3. Cancela com rastreabilidade
    return checkinsRepository.cancelCheckin(checkinId, motivo.trim(), adminId);
  }

  /**
   * FLUXO DE PROTEÇÃO - Impede deleção física.
   * Regra central: "Histórico antigo não pode ser apagado"
   */
  async deletarCheckin(checkinId) {
    // Delega para a camada central que sempre lança exceção (AppError 403)
    businessRules.validateHistoryDeletion();
  }
}

module.exports = new CheckinsService();
