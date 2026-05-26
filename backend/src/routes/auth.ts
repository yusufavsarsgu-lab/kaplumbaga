import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../db/prisma';
import { authMiddleware, type AuthenticatedRequest } from '../middlewares/authMiddleware';
import { signAuthToken } from '../services/AuthService';
import type { JwtLanguage } from '../services/AuthService';

const router = Router();

interface LoginBody {
  username?: string;
  password?: string;
}

function toJwtLanguage(language: string): JwtLanguage {
  return language === 'th' ? 'th' : 'tr';
}

router.post('/login', async (req, res) => {
  const { username = '', password = '' } = req.body as LoginBody;
  const normalizedUsername = username.trim().toLocaleLowerCase('tr-TR');

  if (!normalizedUsername || !password) {
    res.status(400).json({ success: false, message: 'missing_credentials' });
    return;
  }

  const users = await prisma.user.findMany();
  const user = users.find((candidate) => candidate.username.toLocaleLowerCase('tr-TR') === normalizedUsername);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ success: false, message: 'invalid_credentials' });
    return;
  }

  const token = signAuthToken({
    userId: user.id,
    username: user.username,
    language: toJwtLanguage(user.language),
  });

  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      language: user.language,
      avatar: user.avatarUrl || user.displayName.slice(0, 1).toUpperCase(),
    },
    token,
  });
});

router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const authUser = req.authUser;
  if (!authUser) {
    res.status(401).json({ success: false, message: 'unauthorized' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: authUser.userId } });
  if (!user) {
    res.status(404).json({ success: false, message: 'user_not_found' });
    return;
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      language: user.language,
      avatar: user.avatarUrl || user.displayName.slice(0, 1).toUpperCase(),
    },
  });
});

export default router;
