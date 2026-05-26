import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

async function main() {
  const yusufPassword = process.env.SEED_YUSUF_PASSWORD || '123456';
  const neejaPassword = process.env.SEED_NEEJA_PASSWORD || '123456';

  const [yusufHash, neejaHash] = await Promise.all([
    bcrypt.hash(yusufPassword, SALT_ROUNDS),
    bcrypt.hash(neejaPassword, SALT_ROUNDS),
  ]);

  await prisma.user.upsert({
    where: { username: 'Yusuf' },
    update: {
      passwordHash: yusufHash,
      displayName: 'Yusuf',
      language: 'tr',
      avatarUrl: 'Y',
    },
    create: {
      id: 'user-yusuf',
      username: 'Yusuf',
      passwordHash: yusufHash,
      displayName: 'Yusuf',
      language: 'tr',
      avatarUrl: 'Y',
    },
  });

  await prisma.user.upsert({
    where: { username: 'Neeja' },
    update: {
      passwordHash: neejaHash,
      displayName: 'Neeja',
      language: 'th',
      avatarUrl: 'N',
    },
    create: {
      id: 'user-neeja',
      username: 'Neeja',
      passwordHash: neejaHash,
      displayName: 'Neeja',
      language: 'th',
      avatarUrl: 'N',
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
