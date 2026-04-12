/**
 * ============================================================================
 * FitFlow Caraguá — Controller de Alunos
 * ============================================================================
 * CRUD completo de alunos. Apenas admin acessa (garantido pela Rota).
 * Delega validações pesadas para o alunos.service.js.
 */

const { sendSuccess } = require('../utils/helpers');
const alunosService = require('../services/alunos.service');
const AppError = require('../utils/AppError');

const alunosController = {
  /** GET /api/alunos */
  async listar(req, res, next) {
    try {
      const alunos = await alunosService.listar();
      sendSuccess(res, 200, 'Lista de alunos recuperada com sucesso', alunos);
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/alunos/:id */
  async buscarPorId(req, res, next) {
    try {
      if (!req.params.id) throw new AppError('ID do aluno não fornecido', 400);

      const aluno = await alunosService.buscarPorId(req.params.id);
      sendSuccess(res, 200, 'Detalhes do aluno recuperados', aluno);
    } catch (error) {
      next(error);
    }
  },

  /** POST /api/alunos */
  async criar(req, res, next) {
    try {
      // O AppError é laçado pelo service se faltar dados obrigatórios de consistência,
      // mas vamos garantir o básico aqui.
      const { name, email } = req.body;
      if (!name || !email) {
        throw new AppError('Nome e e-mail são obrigatórios para a matrícula.', 400);
      }

      const novoAluno = await alunosService.criar(req.body);
      sendSuccess(res, 201, 'Aluno matriculado com sucesso!', novoAluno);
    } catch (error) {
      next(error);
    }
  },

  /** PUT /api/alunos/:id */
  async atualizar(req, res, next) {
    try {
      if (!req.params.id) throw new AppError('ID do aluno não fornecido', 400);

      const alunoAtualizado = await alunosService.atualizar(req.params.id, req.body);
      sendSuccess(res, 200, 'Dados do aluno atualizados brilhantemente!', alunoAtualizado);
    } catch (error) {
      next(error);
    }
  },

  /** DELETE /api/alunos/:id (soft delete) */
  async desativar(req, res, next) {
    try {
      if (!req.params.id) throw new AppError('ID do aluno não fornecido', 400);

      await alunosService.desativar(req.params.id);
      sendSuccess(res, 200, 'Aluno inativado do sistema com sucesso.', null);
    } catch (error) {
      next(error);
    }
  },
};

module.exports = alunosController;
