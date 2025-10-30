import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const plans = [
    {
      name: 'flexible savings',
      riskType: 'LOW',
      apy: 0.08,
      minLockDays: 7,
      minDeposit: 10,
      description: 'short-term flexible plan. withdraw anytime after 7 days',
      vaultPubkey: '8cEWjJd2SdwD1QhaSKttb3wmnznsNgGdUon4WQqY4frv',
      isActive: true,
    },
    {
      name: 'Growth saving ',
      riskType: 'Low',
      apy: 0.12,
      minLockDays: 30,
      minDeposit: 50,
      description: 'Better returns with 30-days commitment',
      vaultPubkey: '8cEWjJd2SdwD1QhaSKttb3wmnznsNgGdUon4WQqY4frv',
      isActive: true,
    },
    {
      name: 'Aggressive Yield 365',
      riskType: 'HIGH',
      apy: 0.15,
      minLockDays: 7,
      minDeposit: 100,
      description: 'Short-term flexible plan. Withdraw anytime after 7 days',
      vaultPubkey: '8cEWjJd2SdwD1QhaSKttb3wmnznsNgGdUon4WQqY4frv',
      isActive: true,
    },
  ];

  for (const p of plans) {
    const existing = await prisma.vaultPlan.findUnique({ where: { name: p.name } });
    if (!existing) {
      await prisma.vaultPlan.create({ data: p });
      console.log(' Seeded new plan:', p.name);
    } else {
      await prisma.vaultPlan.update({
        where: { name: p.name },
        data: { vaultPubkey: p.vaultPubkey },
      });
      console.log('Updated existing plan:', p.name);
    }
  }
}


main()
  .catch(e => {
    console.error('Error while seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });