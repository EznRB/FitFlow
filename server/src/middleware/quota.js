const { createHmac } = require('node:crypto');
const { isIP } = require('node:net');
const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const { prisma } = require('../config/prisma');
const { getDatabaseProvider } = require('../config/databaseProvider');
const AppError = require('../utils/AppError');

function hashIdentity(endpoint, identity, secret = env.jwt.secret) {
  if (typeof identity !== 'string' || !identity || typeof endpoint !== 'string' || !endpoint) throw new Error('Identidade de quota ausente');
  return createHmac('sha256', secret).update(endpoint).update('\0').update(identity).digest('hex');
}

function normalizeClientIp(value) {
  if (typeof value !== 'string' || value.includes('%') || !isIP(value)) throw new AppError('Endereço de cliente indisponível para proteção de solicitações.', 503);
  if (isIP(value) === 4) return value;
  // WHATWG normaliza maiúsculas, compressão e cauda IPv4 antes de agrupar IPv6 /64.
  const canonical = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  const [left, right] = canonical.split('::');
  const head = left ? left.split(':') : [];
  const tail = right ? right.split(':') : [];
  const words = right === undefined ? head : [...head, ...Array(8 - head.length - tail.length).fill('0'), ...tail];
  const numbers = words.map(word => parseInt(word, 16));
  if (numbers.slice(0, 5).every(word => word === 0) && numbers[5] === 65535) {
    return [numbers[6] >> 8, numbers[6] & 255, numbers[7] >> 8, numbers[7] & 255].join('.');
  }
  return `${words.slice(0, 4).map(word => word.padStart(4, '0')).join(':')}/64`;
}

function clientIpIdentity(req, { vercel = process.env.VERCEL === '1' } = {}) {
  // Vercel sobrescreve seu header canônico; fora dessa plataforma nenhum header é confiado.
  // Sem o header em Vercel, falha claramente em vez de agrupar usuários pelo IP do proxy.
  return normalizeClientIp(vercel ? req.get('x-vercel-forwarded-for') : req.ip);
}

function createDatabaseQuotaStore({ db = prisma, windowMs = 900000, provider = getDatabaseProvider() } = {}) {
  if (!Number.isSafeInteger(windowMs) || windowMs < 1000) throw new Error('Janela de quota inválida');
  if (!['mysql', 'postgresql'].includes(provider)) throw new Error('Provedor de quota inválido');
  return {
    async increment(key) {
      if (!db.rateLimitBucket || !/^[a-f0-9]{64}$/.test(key)) throw new Error('Armazenamento de quota indisponível');
      if (provider === 'postgresql') {
        // Uma instrução faz o UPSERT e retorna o estado da linha bloqueada. O relógio
        // compartilhado é capturado uma única vez; o processo não escolhe a janela.
        const rows = await db.$queryRaw`
          WITH quota_clock AS MATERIALIZED (SELECT clock_timestamp() AS now)
          INSERT INTO rate_limit_buckets AS bucket ("key", hits, window_ends_at)
          SELECT ${key}, 1,
            to_timestamp((FLOOR(EXTRACT(EPOCH FROM now) * 1000 / ${windowMs}) + 1) * ${windowMs} / 1000.0)
          FROM quota_clock WHERE true
          ON CONFLICT ("key") DO UPDATE SET
            hits = CASE WHEN bucket.window_ends_at <= (SELECT now FROM quota_clock) THEN 1
              ELSE LEAST(bucket.hits::bigint + 1, 2147483647)::integer END,
            window_ends_at = CASE WHEN bucket.window_ends_at <= (SELECT now FROM quota_clock)
              THEN EXCLUDED.window_ends_at ELSE bucket.window_ends_at END
          RETURNING hits, window_ends_at AS "windowEndsAt"
        `;
        const bucket = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
        if (!bucket || !Number.isSafeInteger(bucket.hits) || bucket.hits < 1 || bucket.hits > 2147483647
          || !(bucket.windowEndsAt instanceof Date) || !Number.isFinite(bucket.windowEndsAt.getTime())) throw new Error('Resposta de quota inválida');
        return { totalHits: bucket.hits, resetTime: bucket.windowEndsAt };
      }
      return db.$transaction(async tx => {
        // UPSERT bloqueia a linha e calcula a janela pelo relógio compartilhado do banco.
        // A leitura seguinte é o primeiro read consistente após adquirir o lock.
        await tx.$executeRaw`
          INSERT INTO rate_limit_buckets (\`key\`, hits, window_ends_at)
          VALUES (${key}, 1, TIMESTAMPADD(MICROSECOND,
            (FLOOR(TIMESTAMPDIFF(MICROSECOND, CAST('1970-01-01' AS DATETIME(3)), UTC_TIMESTAMP(3)) / 1000 / ${windowMs}) + 1) * ${windowMs} * 1000,
            CAST('1970-01-01' AS DATETIME(3))))
          ON DUPLICATE KEY UPDATE
            hits = IF(window_ends_at <= UTC_TIMESTAMP(3), 1, LEAST(hits + 1, 2147483647)),
            window_ends_at = IF(window_ends_at <= UTC_TIMESTAMP(3), TIMESTAMPADD(MICROSECOND,
              (FLOOR(TIMESTAMPDIFF(MICROSECOND, CAST('1970-01-01' AS DATETIME(3)), UTC_TIMESTAMP(3)) / 1000 / ${windowMs}) + 1) * ${windowMs} * 1000,
              CAST('1970-01-01' AS DATETIME(3))), window_ends_at)
        `;
        const bucket = await tx.rateLimitBucket.findUnique({ where: { key } });
        if (!bucket || !Number.isSafeInteger(bucket.hits) || bucket.hits < 1 || !Number.isFinite(bucket.windowEndsAt.getTime())) throw new Error('Resposta de quota inválida');
        return { totalHits: bucket.hits, resetTime: bucket.windowEndsAt };
      });
    },
    // Manutenção explícita: preserva janela ativa e remove apenas buckets expirados há um dia.
    pruneExpired: () => provider === 'postgresql'
      ? db.$executeRaw`DELETE FROM rate_limit_buckets WHERE window_ends_at < clock_timestamp() - INTERVAL '1 day'`
      : db.$executeRaw`DELETE FROM rate_limit_buckets WHERE window_ends_at < TIMESTAMPADD(DAY, -1, UTC_TIMESTAMP(3))`,
  };
}

function createQuotaLimiter({ endpoint, max = 10, windowMs = 900000, message, keyGenerator,
  production = process.env.NODE_ENV === 'production', vercel = process.env.VERCEL === '1', db = prisma, store, secret = env.jwt.secret } = {}) {
  const generate = keyGenerator || (req => clientIpIdentity(req, { vercel }));
  const identify = req => hashIdentity(endpoint, String(generate(req) || ''), secret);
  if (!production) return rateLimit({ windowMs, max, keyGenerator: identify, standardHeaders: true, legacyHeaders: false, message,
    ...(store ? { store } : {}) });
  const shared = store || createDatabaseQuotaStore({ db, windowMs });
  return async (req, res, next) => {
    try {
      // trust proxy=true aceita qualquer encaminhador. Exige topologia restrita configurada pelo app.
      if (req.app.get('trust proxy') === true) throw new Error('Proxy irrestrito');
      const { totalHits, resetTime } = await shared.increment(identify(req));
      const remaining = Math.max(0, max - totalHits);
      const resetSeconds = Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000));
      res.setHeader('RateLimit-Limit', String(max));
      res.setHeader('RateLimit-Remaining', String(remaining));
      res.setHeader('RateLimit-Reset', String(resetSeconds));
      res.setHeader('Cache-Control', 'no-store');
      if (totalHits > max) {
        res.setHeader('Retry-After', String(resetSeconds));
        return res.status(429).json(message || { status: 'fail', message: 'Limite de solicitações atingido. Aguarde a próxima janela.' });
      }
      return next();
    } catch {
      // Nunca libera a operação quando não foi possível confirmar a quota compartilhada.
      return next(new AppError('Proteção de solicitações temporariamente indisponível. Tente novamente.', 503));
    }
  };
}
module.exports = { createQuotaLimiter, createDatabaseQuotaStore, hashIdentity, normalizeClientIp, clientIpIdentity };
