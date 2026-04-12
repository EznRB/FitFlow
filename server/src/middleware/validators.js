/**
 * ============================================
 * FitFlow Caraguá — Validações de Input
 * ============================================
 * Schemas de validação reutilizáveis usando express-validator.
 * Cada módulo terá seu conjunto de regras.
 */

const { body, param, query, validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

/**
 * Middleware que verifica o resultado das validações.
 * Deve ser usado DEPOIS dos validators em cada rota.
 * 
 * Uso: router.post('/rota', [...validators], handleValidation, controller)
 */
function handleValidation(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const err = new AppError('Dados inválidos. Verifique os campos e tente novamente.', 422);
    err.type = 'validation';
    err.errors = errors.array().map((e) => ({
      campo: e.path,
      mensagem: e.msg,
      valor: e.value,
    }));
    return next(err);
  }

  next();
}

// -----------------------------------------------
// Validações reutilizáveis (usadas em múltiplos módulos)
// -----------------------------------------------

/** Valida ID numérico em parâmetros de rota */
const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID deve ser um número inteiro positivo.'),
];

/** Valida email */
const validateEmail = body('email')
  .isEmail()
  .withMessage('Email inválido.')
  .normalizeEmail();

/** Valida senha (mínimo 6 caracteres) */
const validatePassword = body('senha')
  .isLength({ min: 6 })
  .withMessage('A senha deve ter no mínimo 6 caracteres.');

/** Valida nome (obrigatório, 2-100 caracteres) */
const validateNome = body('nome')
  .trim()
  .isLength({ min: 2, max: 100 })
  .withMessage('O nome deve ter entre 2 e 100 caracteres.');

/** Valida CPF (formato: 000.000.000-00 ou 00000000000) */
const validateCPF = body('cpf')
  .matches(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/)
  .withMessage('CPF inválido. Use o formato 000.000.000-00.');

/** Valida telefone */
const validateTelefone = body('telefone')
  .optional()
  .matches(/^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/)
  .withMessage('Telefone inválido. Use o formato (12) 99999-9999.');

/** Valida valor monetário */
const validateValor = body('valor')
  .isFloat({ min: 0.01 })
  .withMessage('Valor deve ser maior que zero.');

/** Valida data (formato YYYY-MM-DD) */
const validateDate = (field) =>
  body(field)
    .isISO8601()
    .withMessage(`${field} deve ser uma data válida (AAAA-MM-DD).`);

module.exports = {
  handleValidation,
  validateId,
  validateEmail,
  validatePassword,
  validateNome,
  validateCPF,
  validateTelefone,
  validateValor,
  validateDate,
};
