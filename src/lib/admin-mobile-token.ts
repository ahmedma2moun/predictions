import { SignJWT, jwtVerify } from 'jose';

const audience = 'football-prediction-admin';
function secret() {
  const value = process.env.MOBILE_JWT_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error('JWT secret is not configured');
  return new TextEncoder().encode(value);
}

export function signAdminToken(id: number) {
  return new SignJWT({ scope: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(id)).setAudience(audience).setIssuer(audience)
    .setIssuedAt().setExpirationTime('12h').sign(secret());
}

export async function verifyAdminToken(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ['HS256'], audience, issuer: audience,
    });
    const id = Number(payload.sub);
    return payload.scope === 'admin' && Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}
