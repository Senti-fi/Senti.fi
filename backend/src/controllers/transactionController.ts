import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
  userId?: string;
}

export const getUserTransactions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const [transactions, rewards] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId },
        include: {
          vault: { select: { name: true } },
          userVault: {
            select: {
              walletAddress: true,
              vault: { select: { vaultPubkey: true } }
            }
          }
        },
        orderBy: { timestamp: 'desc' },
      }),
      prisma.reward.findMany({
        where: { userVault: { userId } },
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    const rewardTxs = rewards.map(r => ({
      id: r.id,
      type: 'reward',
      token: r.token,
      amount: r.amount,
      walletAddress: r.walletAddress,
      vaultPubkey: r.vaultPubkey,
      timestamp: r.timestamp,
    }));

    const allTxs = [...transactions, ...rewardTxs].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    return res.status(200).json({ transactions: allTxs });
  } catch (err) {
    console.error('Failed to fetch transactions', err);
    return res.status(500).json({ error: 'Failed to fetch transactions' });
  } finally {
    await prisma.$disconnect();
  }
};