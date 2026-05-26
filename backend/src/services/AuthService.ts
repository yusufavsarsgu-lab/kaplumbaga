import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';

export type JwtLanguage = 'tr' | 'th';

export interface JwtUserPayload {
  userId: string;
  username: string;
  language: JwtLanguage;
}

interface JwtPayloadWithClaims extends JwtUserPayload {
  iat?: number;
  exp?: number;
}

function getJwtSecret(): Secret {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production.');
  }

  return secret || 'kaplumbaga-local-development-secret-change-me';
}

export function signAuthToken(payload: JwtUserPayload): string {
  const options: SignOptions = { expiresIn: '7d' };
  return jwt.sign(payload, getJwtSecret(), options);
}

export function verifyAuthToken(token?: string): JwtUserPayload | null {
  if (!token) return null;

  try {
    const payload = jwt.verify(token, getJwtSecret()) as JwtPayloadWithClaims;
    if (!payload.userId || !payload.username || !payload.language) return null;

    return {
      userId: payload.userId,
      username: payload.username,
      language: payload.language,
    };
  } catch {
    return null;
  }
}

export function getBearerToken(authHeader?: string): string | undefined {
  if (!authHeader) return undefined;
  const [scheme, token] = authHeader.split(' ');
  return scheme?.toLowerCase() === 'bearer' ? token : undefined;
}
