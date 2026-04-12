/**
 * ============================================
 * FitFlow Caraguá — Service de Planos
 * ============================================
 * Lógica de negócios de planos e validações.
 */

const planosRepo = require('../repositories/planos.repository');

class PlanosService {
  async listar(apenasAtivos = false) {
    return planosRepo.findAll(apenasAtivos);
  }

  async buscarPorId(id) {
    const plano = await planosRepo.findById(id);
    if (!plano) {
      throw new Error('Plano não encontrado');
    }
    return plano;
  }

  async criar(data) {
    this.validarRegras(data);
    return planosRepo.create(data);
  }

  async atualizar(id, data) {
    await this.buscarPorId(id); // garante que exista
    this.validarRegras(data);
    return planosRepo.update(id, data);
  }

  async desativar(id) {
    await this.buscarPorId(id);
    // Soft delete: não apaga de verdade o registro e não afeta históricos passados.
    return planosRepo.deactivate(id);
  }

  /**
   * REQUISITO DE ARQUITETURA:
   * Calcula a data de vencimento com base na duração do plano.
   * Centraliza a lógica para não ficar espalhada pelo sistema.
   * @param {number} duracaoDias - Ex: 30, 90, 365
   * @param {Date|string} dataBase - Data inicial de referência (padrão: hoje)
   * @returns {Date} Nova data formatada.
   */
  calcularVencimento(duracaoDias, dataBase = new Date()) {
    const dataInicial = typeof dataBase === 'string' ? new Date(dataBase) : new Date(dataBase);
    if (isNaN(dataInicial.getTime())) {
      throw new Error('Data base para cálculo inválida.');
    }
    
    // Adiciona os dias sem alterar o tempo
    const vencimento = new Date(dataInicial);
    vencimento.setDate(vencimento.getDate() + parseInt(duracaoDias, 10));
    
    return vencimento;
  }

  validarRegras(data) {
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
      throw new Error('O nome do plano é obrigatório.');
    }
    
    if (data.price === undefined || data.price <= 0) {
      throw new Error('O plano deve ter um valor válido (maior que zero).');
    }
    
    if (data.durationDays === undefined || data.durationDays <= 0) {
      throw new Error('A duração do plano deve ser de pelo menos 1 dia.');
    }
  }
}

module.exports = new PlanosService();
