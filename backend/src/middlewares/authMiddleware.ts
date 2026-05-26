import type { NextFunction, Request, Response } from 'express';
import { getBearerToken, verifyAuthToken, type JwtUserPayload } from '../services/AuthService';

export interface AuthenticatedRequest extends Request {
  authUser?: JwtUserPayload;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = getBearerToken(req.headers.authorization);
  const payload = verifyAuthToken(token);

  if (!payload) {
    res.status(401).json({ success: false, message: 'unauthorized' });
    return;
  }

  req.authUser = payload;
  next();
}
