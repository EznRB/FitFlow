const { prisma } = require('../config/prisma');

// Public contract: https://wger.readthedocs.io/en/latest/api/api.html
// Descriptive contributor catalog; this is not prescription guidance.
const ORIGIN = 'https://wger.de';
const EXERCISE_PATH = '/api/v2/exerciseinfo/';
const LICENSE_PATH = '/api/v2/license/';
const GROUPS = {
  'Biceps brachii': 'Bíceps', Brachialis: 'Braços', 'Triceps brachii': 'Tríceps',
  'Anterior deltoid': 'Ombros', 'Pectoralis major': 'Peito',
  'Latissimus dorsi': 'Costas', Trapezius: 'Costas',
  'Rectus abdominis': 'Abdômen', 'Obliquus externus abdominis': 'Abdômen',
  'Gluteus maximus': 'Glúteos', 'Biceps femoris': 'Pernas', 'Quadriceps femoris': 'Pernas',
  Gastrocnemius: 'Panturrilhas', Soleus: 'Panturrilhas',
};
class ExternalCatalogError extends Error {}

function plainText(value, max = 10000) {
  if (typeof value !== 'string') return '';
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<(?:br\b[^>]*|\/p|\/div|\/li)>/gi, ' ').replace(/<[^>]*>/g, '')
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity) => {
      if (!entity.startsWith('#')) return entities[entity.toLowerCase()] || match;
      const n = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '';
    }).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function httpsUrl(value, max = 2048) {
  if (typeof value !== 'string' || value.length > max) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
function pageUrl(value, pathname) {
  const parsed = httpsUrl(value);
  if (!parsed) throw new ExternalCatalogError('Paginação insegura.');
  const url = new URL(parsed);
  if (url.origin !== ORIGIN || url.pathname !== pathname || url.hash) throw new ExternalCatalogError('Paginação fora do endpoint permitido.');
  return url.href;
}
// Only verified content licenses are ingested. Unknown/database licenses are
// skipped rather than interpreted as permission to reuse text or an asset.
function trustedLicense(item) {
  if (!item || typeof item !== 'object') return null;
  const raw = typeof item.url === 'string' ? item.url.replace(/^http:\/\//, 'https://') : '';
  const link = httpsUrl(raw);
  if (!link) return null;
  const url = new URL(link);
  if (url.hostname !== 'creativecommons.org' || url.search || url.hash || url.port) return null;
  const match = url.pathname.match(/^\/licenses\/(by|by-sa)\/(3\.0|4\.0)\/(?:deed(?:\.[a-z]+)?)?$/);
  if (match) return { code: `CC-${match[1].toUpperCase()}-${match[2]}`, url: `https://creativecommons.org/licenses/${match[1]}/${match[2]}/` };
  if (/^\/publicdomain\/zero\/1\.0\/(?:deed(?:\.[a-z]+)?)?$/.test(url.pathname)) return { code: 'CC0-1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' };
  return null;
}
function licenseFor(value, licenses) {
  return value && typeof value === 'object' ? trustedLicense(value) : licenses.get(value) || null;
}
function attribution(item, licenses) {
  const license = licenseFor(item?.license, licenses);
  if (!license) return null;
  const authors = Array.isArray(item.author_history) ? item.author_history.map(x => plainText(x, 200)).filter(Boolean) : [];
  const author = plainText(item.license_author, 1000) || authors.join(', ');
  if (!author && license.code !== 'CC0-1.0') return null;
  return { license, author: author || 'Não informado (CC0)', authors,
    title: plainText(item.license_title, 300), originalUrl: httpsUrl(item.license_object_url),
    authorUrl: httpsUrl(item.license_author_url), derivativeSourceUrl: httpsUrl(item.license_derivative_source_url) };
}
function namedItems(items) {
  if (!Array.isArray(items)) return null;
  if (items.some(item => !item || !Number.isSafeInteger(item.id) || item.id <= 0 || !plainText(item.name, 200))) return null;
  return items.map(item => ({ id: item.id, name: plainText(item.name, 200) }));
}
function normalizeExercise(ex, licenses) {
  if (!ex || !Number.isSafeInteger(ex.id) || ex.id <= 0 || !Array.isArray(ex.translations)) return null;
  const primaryMuscles = namedItems(ex.muscles);
  const secondaryMuscles = namedItems(ex.muscles_secondary);
  const equipment = namedItems(ex.equipment);
  const base = attribution(ex, licenses);
  if (!primaryMuscles || !secondaryMuscles || !equipment || !base) return null;
  let translation; let text;
  for (const language of [7, 2]) {
    for (const candidate of ex.translations.filter(t => t && t.language === language)) {
      const credited = attribution(candidate, licenses);
      const name = plainText(candidate.name, 101);
      if (credited && name && name.length <= 100) { translation = candidate; text = credited; break; }
    }
    if (translation) break;
  }
  if (!translation) return null;
  const groups = [...new Set(primaryMuscles.map(m => GROUPS[m.name] || 'Outros'))];
  const media = (Array.isArray(ex.images) ? ex.images : []).flatMap(asset => {
    const url = httpsUrl(asset?.image, 255);
    const credit = attribution(asset, licenses);
    return url && credit && Number.isSafeInteger(asset.id) && asset.id > 0 ? [{ id: asset.id, url, isMain: asset.is_main === true, ...credit }] : [];
  }).sort((a, b) => Number(b.isMain) - Number(a.isMain));
  const locale = translation.language === 7 ? 'pt' : 'en';
  return {
    nome: plainText(translation.name, 100), grupo_muscular: groups.length === 1 ? groups[0] : groups.length > 1 ? 'Múltiplos' : 'Não informado',
    instrucoes: plainText(translation.description) || null, imagem_url: media[0]?.url || null, locale,
    sourceMetadata: { version: 1, sourceUrl: `${ORIGIN}${EXERCISE_PATH}${ex.id}/`,
      upstreamUpdatedAt: plainText(ex.last_update_global || ex.last_update, 100) || null,
      category: ex.category && Number.isSafeInteger(ex.category.id) ? { id: ex.category.id, name: plainText(ex.category.name, 100) } : null,
      primaryMuscles, secondaryMuscles, equipment, base,
      text: { ...text, translationId: Number.isSafeInteger(translation.id) ? translation.id : null,
        locale, originalName: plainText(translation.name, 100), transformations: ['HTML convertido em texto simples'] }, media },
  };
}
function createWgerService({ prisma: db = prisma, fetchImpl = (...args) => fetch(...args), timeoutMs = 10000,
  maxPages = 100, maxRecords = 10000, maxDurationMs = 120000 } = {}) {
  let running = false;
  async function request(url) {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { signal: abort.signal, redirect: 'error', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Resposta HTTP inválida');
      const data = await response.json();
      if (!data || !Array.isArray(data.results) || data.results.length > 1000 ||
        (data.next !== null && (typeof data.next !== 'string' || !data.next))) throw new Error('Formato inesperado');
      return data;
    } catch { throw new ExternalCatalogError('Fonte externa indisponível ou resposta inválida.'); }
    finally { clearTimeout(timeout); }
  }
  return {
    async sincronizar(limit = 100) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
        const error = new Error('O tamanho da página deve ser um inteiro entre 1 e 100.'); error.statusCode = 400; throw error;
      }
      if (running) { const error = new Error('Uma sincronização já está em andamento.'); error.statusCode = 409; throw error; }
      running = true;
      const result = { inseridos: 0, atualizados: 0, ignorados: 0, totalAvaliados: 0, paginas: 0, completa: false, indisponivel: false };
      const started = Date.now(); const seenIds = new Set();
      try {
        const licenses = new Map(); const visitedLicenses = new Set();
        let url = `${ORIGIN}${LICENSE_PATH}`;
        while (url) {
          url = pageUrl(url, LICENSE_PATH);
          if (visitedLicenses.has(url) || visitedLicenses.size >= 10) throw new ExternalCatalogError('Limite de licenças excedido.');
          visitedLicenses.add(url);
          const page = await request(url);
          for (const item of page.results) {
            const approved = trustedLicense(item);
            if (Number.isSafeInteger(item?.id) && approved) licenses.set(item.id, approved);
          }
          url = page.next;
        }
        url = `${ORIGIN}${EXERCISE_PATH}?limit=${limit}&ordering=id`;
        const visited = new Set();
        while (url) {
          url = pageUrl(url, EXERCISE_PATH);
          if (visited.has(url) || result.paginas >= maxPages || Date.now() - started >= maxDurationMs) throw new ExternalCatalogError('Limite de segurança da sincronização atingido.');
          visited.add(url);
          const page = await request(url);
          result.paginas++;
          for (const ex of page.results) {
            if (result.totalAvaliados >= maxRecords || Date.now() - started >= maxDurationMs) {
              throw new ExternalCatalogError('Limite de registros ou tempo atingido.');
            }
            result.totalAvaliados++;
            const normalized = normalizeExercise(ex, licenses);
            if (!normalized || seenIds.has(ex.id)) { result.ignorados++; continue; }
            seenIds.add(ex.id);
            const identity = { source: 'wger', externalId: String(ex.id) };
            const where = { source_externalId: identity };
            const existing = await db.catalogoExercicio.findUnique({ where });
            await db.catalogoExercicio.upsert({ where,
              create: { ...normalized, ...identity, curated: false, ativo: true },
              // Keep credits for the displayed, locally curated text/media.
              // New upstream credits belong to a separate snapshot.
              update: { sourceMetadata: { ...(existing?.sourceMetadata || normalized.sourceMetadata),
                upstream: normalized.sourceMetadata } } });
            // Conditional update also protects edits made during sync.
            // Never overwrite the active flag.
            await db.catalogoExercicio.updateMany({ where: { ...identity, curated: false }, data: normalized });
            if (existing) result.atualizados++; else result.inseridos++;
          }
          url = page.next;
        }
        result.completa = true;
      } catch (error) {
        if (!(error instanceof ExternalCatalogError)) throw error;
        result.indisponivel = true;
        result.aviso = 'Sincronização incompleta. O catálogo local continua disponível; tente novamente mais tarde.';
      } finally { running = false; }
      return result;
    },
  };
}
module.exports = { ...createWgerService(), createWgerService, normalizeExercise, plainText, httpsUrl };
