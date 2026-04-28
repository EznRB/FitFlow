/**
 * ============================================
 * FitFlow Caraguá — Wger API Service
 * ============================================
 * Serviço de integração com a Wger API (open-source) para
 * catalogar exercícios de forma automática no sistema com tradução.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { traduzirNome } = require('../utils/exercicios.translations');

// Mapeamento de Categorias (Inglês da API -> Português do Banco)
const CATEGORY_MAPPING = {
  'Abs': 'Abdômen',
  'Arms': 'Braços',
  'Back': 'Costas',
  'Calves': 'Panturrilhas',
  'Chest': 'Peito',
  'Legs': 'Pernas',
  'Shoulders': 'Ombros'
};

const wgerService = {
  /**
   * Busca e salva novos exercícios da Wger API.
   * @param {number} limit - Quantidade máxima a buscar (padrão 50)
   * @returns {Object} - Resultado da sincronização
   */
  async sincronizar(limit = 50) {
    try {
      // Buscamos em Inglês (id=2) como base por ser mais populado,
      // mas o serviço vai tentar encontrar tradução PT-BR interna ou na API.
      const url = `https://wger.de/api/v2/exerciseinfo/?language=2&limit=${limit}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Erro na Wger API: ${response.statusText}`);
      }

      const data = await response.json();
      const exercises = data.results || [];
      
      let inseridos = 0;
      let ignorados = 0;

      for (const ex of exercises) {
        // 1. Tenta tradução oficial na API (Linguagem 7 = PT)
        // 2. Fallback para Inglês (Linguagem 2) + Tradutor Interno
        const transPT = ex.translations.find(t => t.language === 7);
        const transEN = ex.translations.find(t => t.language === 2);
        const transBase = transPT || transEN || ex.translations[0];

        if (!transBase || !transBase.name || !ex.category || !ex.category.name) {
          ignorados++;
          continue;
        }

        // Se for tradução automática (fallback do inglês), aplicamos nosso dicionário
        let nomeFinal = transPT ? transPT.name : traduzirNome(transEN ? transEN.name : transBase.name);
        nomeFinal = nomeFinal.trim();

        // Verifica se já existe (pelo nome final ou nome original se disponível)
        const existe = await prisma.catalogoExercicio.findFirst({
          where: { 
            OR: [
              { nome: nomeFinal },
              { nome: transEN ? transEN.name : transBase.name }
            ]
          }
        });

        if (existe) {
          ignorados++;
          continue;
        }

        // Determinar grupo muscular
        let grupoMuscularEn = ex.category.name;
        let grupoMuscularBr = CATEGORY_MAPPING[grupoMuscularEn] || 'Outros';

        // Instruções
        let instrucoes = transBase.description ? transBase.description.replace(/(<([^>]+)>)/gi, '').trim() : '';

        await prisma.catalogoExercicio.create({
          data: {
            nome: nomeFinal,
            grupo_muscular: grupoMuscularBr,
            instrucoes: instrucoes || null,
            ativo: true
          }
        });

        inseridos++;
      }

      return { inseridos, ignorados, totalAvaliados: exercises.length };

    } catch (error) {
      console.error('[WgerService] Erro ao sincronizar:', error.message);
      throw error;
    }
  }
};

module.exports = wgerService;
