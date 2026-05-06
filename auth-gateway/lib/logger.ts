type LogContext = Record<string, unknown>;

function log(level: 'error' | 'warn' | 'info', event: string, ctx?: LogContext) {
  const payload = { level, event, ts: new Date().toISOString(), ...ctx };
  if (level === 'error') console.error(JSON.stringify(payload));
  else if (level === 'warn') console.warn(JSON.stringify(payload));
  else console.log(JSON.stringify(payload));
}

export const logger = {
  error: (event: string, ctx?: LogContext) => log('error', event, ctx),
  warn: (event: string, ctx?: LogContext) => log('warn', event, ctx),
  info: (event: string, ctx?: LogContext) => log('info', event, ctx),
};
