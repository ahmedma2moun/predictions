/* eslint-disable no-console -- this module is the sanctioned console wrapper */
import { enqueue } from '@/lib/logging/transport';

type Level = 'info' | 'warn' | 'error';

function emit(level: Level, msg: string, ctx?: object) {
  const entry = { level, msg, ts: new Date().toISOString(), ...ctx };
  console[level === 'info' ? 'log' : level](JSON.stringify(entry));
  // Only structured API events (api.request, prediction.*) go to Axiom;
  // plain messages from providers, crons and services stay in the console.
  if (ctx && 'event' in ctx) enqueue(entry);
}

export const logger = {
  info:  (msg: string, ctx?: object) => emit('info', msg, ctx),
  warn:  (msg: string, ctx?: object) => emit('warn', msg, ctx),
  error: (msg: string, ctx?: object) => emit('error', msg, ctx),
};
