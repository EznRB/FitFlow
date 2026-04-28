const AppError = require('./AppError');
const { isOverdue } = require('./helpers');

/**
 * ============================================================================
 * FitFlow Caraguá — Central de Regras de Negócio (TASK 11)
 * ============================================================================
 * Esta camada centraliza as regras e validações críticas do sistema.
 * Impede que a lógica de negócios fique espalhada pelos controllers ou
 * misturada de forma ambígua nos services.
 */
class BusinessRules {
  /**
   * Valida se um aluno pode visualizar e interagir com o treino.
   * Regra: Mensalidade vencida há mais de 5 dias bloqueia a visualização.
   * Também bloqueia se o status for explicitamente 'blocked'.
   * 
   * @param {object} student - Objeto do aluno contendo status e planEndDate
   * @throws {AppError} Se o aluno estiver bloqueado
   */
  validateWorkoutView(student) {
    if (!student) {
      throw new AppError('Aluno não encontrado.', 404);
    }

    // Se o status do aluno já estiver como bloqueado
    if (student.status === 'blocked') {
      throw new AppError('Acesso bloqueado. Sua matrícula está inativa por inadimplência. Regularize sua situação na recepção.', 403);
    }

    // Validação preventiva em tempo real caso o cronjob de inadimplência ainda não tenha rodado
    if (student.planEndDate && isOverdue(student.planEndDate, 5)) {
      throw new AppError('Acesso bloqueado. Sua mensalidade está vencida há mais de 5 dias. Regularize sua situação na recepção.', 403);
    }
  }

  /**
   * Valida se o aluno pode fazer check-in.
   * Regra: Check-in duplicado no mesmo dia é proibido e bloqueados não entram.
   * 
   * @param {object} student - Objeto do aluno
   * @param {object} checkinExistente - Opcional: check-in do dia se existir
   * @throws {AppError} Se a validação falhar
   */
  validateCheckIn(student, checkinExistente) {
    if (!student) {
      throw new AppError('Aluno não encontrado.', 404);
    }

    if (student.user && !student.user.active) {
      throw new AppError('Este aluno está desativado do sistema.', 400);
    }

    // Regra de bloqueio financeiro também se aplica ao check-in físico
    if (student.status === 'blocked' || (student.planEndDate && isOverdue(student.planEndDate, 5))) {
      throw new AppError('Aluno bloqueado por inadimplência. Regularize a situação financeira antes de fazer check-in.', 403);
    }

    if (checkinExistente) {
      const hora = checkinExistente.createdAt
        ? new Date(checkinExistente.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : '';
      throw new AppError(`Este aluno já fez check-in hoje${hora ? ' às ' + hora : ''}. Apenas 1 check-in por dia é permitido.`, 409);
    }
  }

  /**
   * Valida permissão para gerenciar a estrutura base do treino.
   * Regras: 
   * - Apenas instrutor pode alterar treino.
   * - Aluno não pode alterar estrutura base.
   * 
   * @param {object} user - Objeto do usuário autenticado (geralmente extraído do request/JWT)
   * @throws {AppError} Se não for admin
   */
  validateInstructorAccess(user) {
    if (!user) {
      throw new AppError('Usuário não autenticado.', 401);
    }

    if (user.role !== 'admin') {
      throw new AppError('Acesso negado. Apenas instrutores (admin) podem criar ou alterar a estrutura de um treino.', 403);
    }
  }

  /**
   * Valida exclusão de históricos (check-ins, fichas de treino, pagamentos).
   * Regra: Histórico antigo não pode ser apagado (deve ser cancelado/soft delete).
   * 
   * @throws {AppError} Sempre que chamado (bloqueia o fluxo de deleção física)
   */
  validateHistoryDeletion() {
    throw new AppError('Operação não permitida. Por questões de auditoria e segurança, históricos antigos não podem ser apagados do sistema.', 403);
  }
}

module.exports = new BusinessRules();
