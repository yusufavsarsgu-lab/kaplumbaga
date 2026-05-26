import { prisma } from '../src/db/prisma';

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, username: true, language: true } });
  const msgCount = await prisma.message.count();
  const lastMessages = await prisma.message.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: {
      id: true,
      type: true,
      sourceLang: true,
      targetLang: true,
      translationStatus: true,
      originalText: true,
      translatedText: true,
      deliveryStatus: true,
    },
  });
  console.log('Users:', users);
  console.log('Total messages:', msgCount);
  console.log('Latest messages:', lastMessages);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
