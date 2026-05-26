import { Router } from 'express';
import users from '../data/users.json';

const router = Router();

interface LoginBody {
  username?: string;
  password?: string;
}

interface StoredUser {
  id: string;
  username: string;
  password: string;
  displayName: string;
  language: 'tr' | 'th';
  avatar: string;
}

const demoUsers = users as StoredUser[];

router.post('/login', (req, res) => {
  const { username = '', password = '' } = req.body as LoginBody;
  const normalizedUsername = username.trim().toLocaleLowerCase('tr-TR');

  if (!normalizedUsername || !password) {
    res.status(400).json({ success: false, message: 'missing_credentials' });
    return;
  }

  // Demo MVP: passwords live in users.json only for local testing.
  // Replace this with hashed passwords and token/session based auth before public launch.
  const user = demoUsers.find(
    (candidate) =>
      candidate.username.toLocaleLowerCase('tr-TR') === normalizedUsername && candidate.password === password
  );

  if (!user) {
    res.status(401).json({ success: false, message: 'invalid_credentials' });
    return;
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      language: user.language,
      avatar: user.avatar,
    },
  });
});

export default router;
