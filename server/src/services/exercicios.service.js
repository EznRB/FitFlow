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
 * Utiliza o Prisma Client para acessar a tabela `exercicios` (modelo CatalogoExercicio).
 */

const { prisma } = require('../config/prisma');
const AppError = require('../utils/AppError');
const { plainText, httpsUrl } = require('./wger.service');

function catalogId(value) {
  if ((typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) &&
    (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)) {
    throw new AppError('ID de exercício inválido.', 400);
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id > 2147483647) throw new AppError('ID de exercício inválido.', 400);
  return id;
}

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
      if (typeof filtros.grupoMuscular !== 'string' || filtros.grupoMuscular.length > 50) {
        throw new AppError('Grupo muscular inválido.', 400);
      }
      where.grupo_muscular = filtros.grupoMuscular;
    }

    // Filtro por status ativo (por padrão, mostra apenas ativos)
    if (filtros.ativo !== undefined) {
      if (typeof filtros.ativo !== 'boolean') throw new AppError('Status ativo inválido.', 400);
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
      where: { id: catalogId(id) }
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
    const validated = this.validarDados(data);

    return await prisma.catalogoExercicio.create({
      data: {
        ...validated,
        ativo: true,
        source: 'local',
        curated: true,
        locale: 'pt'
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
    const validated = this.validarDados(data);

    return await prisma.catalogoExercicio.update({
      where: { id: catalogId(id) },
      data: {
        ...validated,
        curated: true
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
      where: { id: catalogId(id) },
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
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AppError('Dados de exercício inválidos.', 400);
    if (typeof data.nome !== 'string' || !plainText(data.nome, 101) || data.nome.trim().length > 100) {
      throw new AppError('O nome do exercício é obrigatório.', 400);
    }

    if (typeof data.grupo_muscular !== 'string' || !plainText(data.grupo_muscular, 51) || data.grupo_muscular.trim().length > 50) {
      throw new AppError('O grupo muscular é obrigatório.', 400);
    }
    if (data.instrucoes != null && (typeof data.instrucoes !== 'string' || data.instrucoes.length > 10000)) {
      throw new AppError('As instruções devem ser um texto com até 10.000 caracteres.', 400);
    }
    const imagem = data.imagem_url == null || data.imagem_url === '' ? null : httpsUrl(data.imagem_url, 255);
    if (data.imagem_url != null && data.imagem_url !== '' && !imagem) {
      throw new AppError('A imagem deve usar uma URL HTTPS com até 255 caracteres.', 400);
    }
    return { nome: plainText(data.nome, 100), grupo_muscular: plainText(data.grupo_muscular, 50),
      instrucoes: plainText(data.instrucoes) || null, imagem_url: imagem };
  }
}

module.exports = new ExerciciosService();
