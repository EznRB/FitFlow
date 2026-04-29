/**
 * ============================================
 * FitFlow Caraguá — Service de Exercícios (Catálogo)
 * ============================================
 * Lógica de negócios para o catálogo geral de exercícios.
 * 
 * O catálogo é a lista-mestre de exercícios disponíveis
 * na academia (ex: "Supino Reto", "Agachamento Livre").
 * 
 * Diferença importante:
 * - Catálogo (esta camada) = exercícios genéricos disponíveis
 * - Exercise (Prisma) = exercícios vinculados a um treino específico
 * 
 * Utiliza queries SQL diretas com mysql2/promise pool,
 * pois a tabela `exercicios` do SQL não tem modelo Prisma dedicado.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const AppError = require('../utils/AppError');

class ExerciciosService {

  /**
   * Lista todos os exercícios do catálogo.
   * Permite filtrar por grupo muscular e status (ativo/inativo).
   * @param {object} filtros - { grupoMuscular, ativo }
   * @returns {Promise<Array>} Lista de exercícios
   */
  async listar(filtros = {}) {
    const where = {};

    // Filtro por grupo muscular (ex: "Peito", "Costas")
    if (filtros.grupoMuscular) {
      where.grupo_muscular = filtros.grupoMuscular;
    }

    // Filtro por status ativo (por padrão, mostra apenas ativos)
    if (filtros.ativo !== undefined) {
      where.ativo = filtros.ativo;
    } else {
      where.ativo = true;
    }

    return await prisma.catalogoExercicio.findMany({
      where,
      orderBy: [
        { grupo_muscular: 'asc' },
        { nome: 'asc' }
      ]
    });
  }

  /**
   * Busca um exercício específico do catálogo por ID.
   * Lança erro 404 se não encontrar.
   * @param {number} id - ID do exercício
   * @returns {Promise<object>} Exercício encontrado
   */
  async buscarPorId(id) {
    const exercicio = await prisma.catalogoExercicio.findUnique({
      where: { id: parseInt(id) }
    });

    if (!exercicio) {
      throw new AppError('Exercício não encontrado no catálogo.', 404);
    }

    return exercicio;
  }

  /**
   * Cria um novo exercício no catálogo.
   * Valida campos obrigatórios antes da inserção.
   * @param {object} data - { nome, grupo_muscular, instrucoes }
   * @returns {Promise<object>} Exercício criado
   */
  async criar(data) {
    this.validarDados(data);

    return await prisma.catalogoExercicio.create({
      data: {
        nome: data.nome.trim(),
        grupo_muscular: data.grupo_muscular.trim(),
        instrucoes: data.instrucoes || null,
        imagem_url: data.imagem_url || null,
        ativo: true
      }
    });
  }

  /**
   * Atualiza um exercício existente no catálogo.
   * Verifica existência antes de atualizar.
   * @param {number} id - ID do exercício
   * @param {object} data - Campos a atualizar
   * @returns {Promise<object>} Exercício atualizado
   */
  async atualizar(id, data) {
    await this.buscarPorId(id); // Garante que existe
    this.validarDados(data);

    return await prisma.catalogoExercicio.update({
      where: { id: parseInt(id) },
      data: {
        nome: data.nome.trim(),
        grupo_muscular: data.grupo_muscular.trim(),
        instrucoes: data.instrucoes || null,
        imagem_url: data.imagem_url || null
      }
    });
  }

  /**
   * Desativa um exercício do catálogo (soft delete).
   * Não apaga fisicamente para preservar referências históricas.
   * @param {number} id - ID do exercício
   * @returns {Promise<void>}
   */
  async desativar(id) {
    await this.buscarPorId(id); // Garante que existe

    await prisma.catalogoExercicio.update({
      where: { id: parseInt(id) },
      data: { ativo: false }
    });
  }

  /**
   * Retorna os grupos musculares distintos disponíveis no catálogo.
   * Útil para preencher filtros e selects no frontend.
   * @returns {Promise<Array<string>>} Lista de grupos musculares
   */
  async listarGruposMusculares() {
    const grupos = await prisma.catalogoExercicio.findMany({
      where: { ativo: true },
      distinct: ['grupo_muscular'],
      select: { grupo_muscular: true },
      orderBy: { grupo_muscular: 'asc' }
    });
    
    return grupos.map(r => r.grupo_muscular);
  }

  /**
   * Validação de campos obrigatórios.
   * Lança AppError se algum campo estiver inválido.
   * @param {object} data - Dados a validar
   */
  validarDados(data) {
    if (!data.nome || typeof data.nome !== 'string' || data.nome.trim() === '') {
      throw new AppError('O nome do exercício é obrigatório.', 400);
    }

    if (!data.grupo_muscular || typeof data.grupo_muscular !== 'string' || data.grupo_muscular.trim() === '') {
      throw new AppError('O grupo muscular é obrigatório.', 400);
    }
  }
}

module.exports = new ExerciciosService();
