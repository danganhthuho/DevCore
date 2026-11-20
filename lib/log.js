// Event logging (SFDS 9). One JSON line per event on the server console,
// which Vercel keeps under Project → Logs.
// Never pass passwords, keys or tokens in `data`.
//   log.info('product.created', { productId: 17, userId })
//   log.error('db.error', { where: 'createProduct', code: error.code })

function write(level, event, data = {}) {
  if (process.env.NODE_ENV === 'test') return;
  const line = JSON.stringify({ at: new Date().toISOString(), level, event, ...data });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}

export const log = {
  info: (event, data) => write('info', event, data),
  warn: (event, data) => write('warn', event, data),
  error: (event, data) => write('error', event, data),
};
