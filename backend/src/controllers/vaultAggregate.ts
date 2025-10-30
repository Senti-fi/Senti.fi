import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Fetch all vaults a user participates in with enriched data
 */
export const getUserVaultsWithDetails = async (req: Request, res: Response) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const userVaults = await prisma.userVault.findMany({
      where: { userId },
      include: {
        vault: true,
        rewards: true,
      },
    });

    const enrichedVaults = userVaults.map(uv => {
      const totalRewards = uv.rewards.reduce((sum, r) => sum + r.amount, 0);
      return {
        vaultName: uv.vault.name,
        vaultPubkey: uv.vault.vaultPubkey,
        token: uv.token,
        amount: uv.amount,
        yieldRate: uv.vault.yieldRate,
        lockedUntil: uv.lockedUntil,
        isUnlocked: !uv.lockedUntil || new Date() >= new Date(uv.lockedUntil),
        rewardsAccrued: totalRewards,
      };
    });

    return res.status(200).json({ userId, vaults: enrichedVaults });
  } catch (err) {
    logger.error(`getUserVaultsWithDetails failed: ${(err as Error).message}`);
    return res.status(500).json({ error: 'Failed to fetch user vaults with details' });
  } finally {
    await prisma.$disconnect();
  }
};

/**
 * Fetch all vaults for a specific token sorted by yieldRate descending
 */
export const getVaultsByToken = async (req: Request, res: Response) => {
  const { token } = req.params;
  if (!token) return res.status(400).json({ error: 'Missing token' });

  try {
    const vaults = await prisma.vault.findMany({
      where: { token },
      orderBy: { yieldRate: 'desc' },
      include: { userVaults: true },
    });

    const enrichedVaults = vaults.map(v => ({
      vaultName: v.name,
      vaultPubkey: v.vaultPubkey,
      token: v.token,
      yieldRate: v.yieldRate,
      totalDeposits: v.totalDeposits,
      userCount: v.userVaults.length,
    }));

    return res.status(200).json({ token, vaults: enrichedVaults });
  } catch (err) {
    logger.error(`getVaultsByToken failed: ${(err as Error).message}`);
    return res.status(500).json({ error: 'Failed to fetch vaults by token' });
  } finally {
    await prisma.$disconnect();
  }
};

/**
 * Fetch all vault plans
 */
export const getAllVaultPlans = async (_req: Request, res: Response) => {
  try {
    const vaultPlans = await prisma.vaultPlan.findMany({
      include: {
        vaults: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ vaultPlans });
  } catch (err) {
    logger.error(`getAllVaultPlans failed: ${(err as Error).message}`);
    return res.status(500).json({ error: 'Failed to fetch vault plans' });
  } finally {
    await prisma.$disconnect();
  }
};