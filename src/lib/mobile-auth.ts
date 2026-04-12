import { SignJWT, jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';

export interface MobileSession {
  id: string;
  email: string;
  name: string;
  role: string;
}

const getSecret = () => new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);

export async function signMobileJwt(user: MobileSession): Promise<string> {
  return new SignJWT({ id: user.id, email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(await getSecret());
}

export async function verifyMobileJwt(token: string): Promise<MobileSession | null> {
  try {
    const { payload } = await jwtVerify(token, await getSecret());
    return payload as unknown as MobileSession;
  } catch {
    return null;
  }
}

/**
 * Reads and verifies the Bearer token from the Authorization header.
 * Returns null if the header is missing, malformed, or the token is invalid/expired.
 */
export async function getMobileSession(req: NextRequest): Promise<MobileSession | null> {
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return null;
  return verifyMobileJwt(header.slice(7));
}
