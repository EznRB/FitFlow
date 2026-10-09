function normalizeOrigins(value) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(values.map(origin => {
    if (typeof origin !== 'string') throw new Error('Origem CORS inválida');
    const candidate = origin.trim(); const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash || candidate !== url.origin) throw new Error('Use origens CORS completas sem caminhos');
    return url.origin;
  }))];
}

function resolveAllowedOrigins(value, environment = process.env) {
  const origins = normalizeOrigins(value);
  if (environment.VERCEL !== '1' || !environment.VERCEL_URL) return origins;

  // VERCEL_URL vem da configuração do servidor. Headers Host/Forwarded nunca
  // participam desta allowlist e outros deployments não recebem acesso.
  const hostname = environment.VERCEL_URL;
  if (typeof hostname !== 'string' || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.vercel\.app$/.test(hostname)) {
    throw new Error('VERCEL_URL deve ser um hostname de deployment válido, sem caminho ou porta.');
  }
  return [...new Set([...origins, `https://${hostname}`])];
}

module.exports = { normalizeOrigins, resolveAllowedOrigins };
