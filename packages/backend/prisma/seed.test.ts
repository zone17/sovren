import { prisma } from '../src/prisma';

async function main() {
  // Clean up existing data
  await prisma.payment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.user.deleteMany();
  await prisma.featureFlag.deleteMany();

  // Create a test user
  const user = await prisma.user.create({
    data: {
      email: 'testuser@example.com',
      name: 'Test User',
      nostrPubkey: 'testnostrpubkey',
    },
  });

  // Create a test post
  await prisma.post.create({
    data: {
      title: 'Test Post',
      content: 'This is a test post.',
      published: true,
      authorId: user.id,
    },
  });

  // Create a feature flag
  await prisma.featureFlag.create({
    data: {
      key: 'test-flag',
      value: true,
      description: 'A test feature flag',
      enabled: true,
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
