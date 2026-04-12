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

const { pool } = require('../config/database');
const AppError = require('../utils/AppError');

class ExerciciosService {

  /**
   * Lista todos os exercícios do catálogo.
   * Permite filtrar por grupo muscular e status (ativo/inativo).
   * @param {object} filtros - { grupoMuscular, ativo }
   * @returns {Promise<Array>} Lista de exercícios
   */
  async listar(filtros = {}) {
    let query = 'SELECT * FROM exercicios WHERE 1=1';
    const params = [];

    // Filtro por grupo muscular (ex: "Peito", "Costas")
    if (filtros.grupoMuscular) {
      query += ' AND grupo_muscular = ?';
      params.push(filtros.grupoMuscular);
    }

    // Filtro por status ativo (por padrão, mostra apenas ativos)
    if (filtros.ativo !== undefined) {
      query += ' AND ativo = ?';
      params.push(filtros.ativo);
    } else {
      query += ' AND ativo = TRUE';
    }

    query += ' ORDER BY grupo_muscular ASC, nome ASC';

    const [rows] = await pool.execute(query, params);
    return rows;
  }

  /**
   * Busca um exercício específico do catálogo por ID.
   * Lança erro 404 se não encontrar.
   * @param {number} id - ID do exercício
   * @returns {Promise<object>} Exercício encontrado
   */
  async buscarPorId(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM exercicios WHERE id = ?',
      [parseInt(id)]
    );

    if (rows.length === 0) {
      throw new AppError('Exercício não encontrado no catálogo.', 404);
    }

    return rows[0];
  }

  /**
   * Cria um novo exercício no catálogo.
   * Valida campos obrigatórios antes da inserção.
   * @param {object} data - { nome, grupo_muscular, instrucoes }
   * @returns {Promise<object>} Exercício criado
   */
  async criar(data) {
    this.validarDados(data);

    const [result] = await pool.execute(
      `INSERT INTO exercicios (nome, grupo_muscular, instrucoes, imagem_url, ativo) 
       VALUES (?, ?, ?, ?, TRUE)`,
      [data.nome.trim(), data.grupo_muscular.trim(), data.instrucoes || null, data.imagem_url || null]
    );

    // Retorna o exercício recém-criado
    return this.buscarPorId(result.insertId);
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

    await pool.execute(
      `UPDATE exercicios 
       SET nome = ?, grupo_muscular = ?, instrucoes = ?, imagem_url = ?, atualizado_em = NOW() 
       WHERE id = ?`,
      [data.nome.trim(), data.grupo_muscular.trim(), data.instrucoes || null, data.imagem_url || null, parseInt(id)]
    );

    return this.buscarPorId(id);
  }

  /**
   * Desativa um exercício do catálogo (soft delete).
   * Não apaga fisicamente para preservar referências históricas.
   * @param {number} id - ID do exercício
   * @returns {Promise<void>}
   */
  async desativar(id) {
    await this.buscarPorId(id); // Garante que existe

    await pool.execute(
      'UPDATE exercicios SET ativo = FALSE, atualizado_em = NOW() WHERE id = ?',
      [parseInt(id)]
    );
  }

  /**
   * Retorna os grupos musculares distintos disponíveis no catálogo.
   * Útil para preencher filtros e selects no frontend.
   * @returns {Promise<Array<string>>} Lista de grupos musculares
   */
  async listarGruposMusculares() {
    const [rows] = await pool.execute(
      'SELECT DISTINCT grupo_muscular FROM exercicios WHERE ativo = TRUE ORDER BY grupo_muscular ASC'
    );
    return rows.map(r => r.grupo_muscular);
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
