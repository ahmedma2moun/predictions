export const logger = {
  info:  (msg: string, ctx?: object) => console.log(JSON.stringify({ level: 'info',  msg, ts: new Date().toISOString(), ...ctx })),
  warn:  (msg: string, ctx?: object) => console.warn(JSON.stringify({ level: 'warn', msg, ts: new Date().toISOString(), ...ctx })),
  error: (msg: string, ctx?: object) => console.error(JSON.stringify({ level: 'error', msg, ts: new Date().toISOString(), ...ctx })),
};
