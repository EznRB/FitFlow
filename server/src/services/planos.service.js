'use strict';
const repository = require('../repositories/planos.repository');
const AppError = require('../utils/AppError');
function integer(value, label, max) {
  if (!['number', 'string'].includes(typeof value) || !/^[1-9]\d*$/.test(String(value))) throw new AppError(`${label} deve ser um inteiro positivo.`, 400);
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n > max) throw new AppError(`${label} deve ficar entre 1 e ${max}.`, 400);
  return n;
}
function fields(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError('Dados de plano inválidos.', 400);
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 100) throw new AppError('Informe um nome de plano com até 100 caracteres.', 400);
  if (!['number', 'string'].includes(typeof input.price) || !/^\d+(?:\.\d{1,2})?$/.test(String(input.price)) ||
    !Number.isFinite(Number(input.price)) || Number(input.price) < 0.01 || Number(input.price) > 99999999.99) throw new AppError('Valor do plano inválido: use 0,01 a 99.999.999,99 e até duas casas decimais.', 400);
  if (input.description != null && (typeof input.description !== 'string' || input.description.length > 10000)) throw new AppError('Descrição deve ser um texto com até 10.000 caracteres.', 400);
  return { name: input.name.trim(), price: Number(input.price), durationDays: integer(input.durationDays, 'Duração em dias', 3650),
    description: input.description?.trim() || null };
}
class PlanosService {
  constructor({ repo = repository } = {}) { this.repo = repo; }
  async listar(activeOnly = false) {
    if (typeof activeOnly !== 'boolean') throw new AppError('Filtro ativo inválido.', 400);
    return this.repo.findAll(activeOnly);
  }
  async buscarPorId(value) {
    const plan = await this.repo.findById(integer(value, 'ID do plano', 2147483647));
    if (!plan) throw new AppError('Plano não encontrado.', 404);
    return plan;
  }
  async criar(input) { return this.repo.create(fields(input)); }
  async atualizar(value, input) {
    const id = integer(value, 'ID do plano', 2147483647), data = fields(input);
    await this.buscarPorId(id); return this.repo.update(id, data);
  }
  async desativar(value) {
    const id = integer(value, 'ID do plano', 2147483647);
    await this.buscarPorId(id); return this.repo.deactivate(id);
  }
  calcularVencimento(duration, dataBase = new Date()) {
    const days = integer(duration, 'Duração em dias', 3650);
    const isDate = Object.prototype.toString.call(dataBase) === '[object Date]';
    if (!isDate && (typeof dataBase !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(dataBase))) {
      throw new AppError('Data-base inválida.', 400);
    }
    if (typeof dataBase === 'string') {
      const civil = dataBase.slice(0, 10), civilDate = new Date(`${civil}T00:00:00.000Z`);
      if (!Number.isFinite(civilDate.getTime()) || civilDate.toISOString().slice(0, 10) !== civil) throw new AppError('Data-base inexistente no calendário.', 400);
    }
    const base = new Date(dataBase);
    if (!Number.isFinite(base.getTime())) throw new AppError('Data-base inválida.', 400);
    const due = new Date(base); due.setUTCDate(due.getUTCDate() + days);
    if (!Number.isFinite(due.getTime()) || due.getUTCFullYear() > 9999 || due.getUTCFullYear() < 1000) throw new AppError('Vencimento fora do intervalo de calendário suportado.', 400);
    return due;
  }
  validarRegras(input) { return fields(input); }
}
module.exports = new PlanosService();
module.exports.createPlanosService = options => new PlanosService(options);
