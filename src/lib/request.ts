import { NextRequest } from 'next/server';

export async function safeParseBody<T>(req: NextRequest): Promise<T | null> {
  try {
    return await req.json() as T;
  } catch {
    return null;
  }
}
