import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Fetch detailed info for a single vault
 */
export const getVaultDetails = async (req: Request, res: Response) => {
  const { vaultPubkey } = req.params;
  if (!vaultPubkey) return res.status(400).json({ error: 'Missing vaultPubkey' });

  try {
    const vault = await prisma.vault.findUnique({
      where: { vaultPubkey },
      include: {
        vaultPlan: true,
        userVaults: { include: { rewards: true } },
      },
    });

    if (!vault) return res.status(404).json({ error: 'Vault not found' });

    const totalRewards = vault.userVaults.reduce(
      (sum, uv) => sum + uv.rewards.reduce((rSum, r) => rSum + r.amount, 0),
      0
    );

    return res.status(200).json({
      vaultName: vault.name,
      vaultPubkey: vault.vaultPubkey,
      token: vault.token,
      symbol: vault.symbol,
      yieldRate: vault.yieldRate,
      totalDeposits: vault.totalDeposits,
      userCount: vault.userVaults.length,
      totalRewards,
      vaultPlan: vault.vaultPlan,
    });
  } catch (error) {
    logger.error(`getVaultDetails failed: ${(error as Error).message}`);
    return res.status(500).json({ error: 'Failed to fetch vault details' });
  }
};

/**
 * List all vaults a user participates in
 */
export const getUserVaults = async (req: Request, res: Response) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const vaults = await prisma.userVault.findMany({
      where: { userId },
      include: {
        vault: true,
      },
    });

    return res.status(200).json({ vaults });
  } catch (error) {
    logger.error(`getUserVaults failed: ${(error as Error).message}`);
    return res.status(500).json({ error: 'Failed to fetch user vaults' });
  } finally {
    await prisma.$disconnect();
  }
};

/**
 * Fetch all transactions for a vault
 */
export const getVaultTransactions = async (req: Request, res: Response) => {
  const { vaultPubkey } = req.params;
  if (!vaultPubkey) return res.status(400).json({ error: 'Missing vaultPubkey' });

  try {
    const vault = await prisma.vault.findUnique({ where: { vaultPubkey } });
    if (!vault) return res.status(404).json({ error: 'Vault not found' });

    const transactions = await prisma.transaction.findMany({
      where: { vaultId: vault.id },
      orderBy: { timestamp: 'desc' },
      include: { userVault: true },
    });

    return res.status(200).json({ vaultPubkey, transactions });
  } catch (error) {
    logger.error(`getVaultTransactions failed: ${(error as Error).message}`);
    return res.status(500).json({ error: 'Failed to fetch vault transactions' });
  }
};

/**
 * Fetch rewards for a vault and sum them
 */
export const getVaultRewards = async (req: Request, res: Response) => {
  const { vaultPubkey } = req.params;
  if (!vaultPubkey) return res.status(400).json({ error: 'Missing vaultPubkey' });

  try {
    const vault = await prisma.vault.findUnique({ where: { vaultPubkey } });
    if (!vault) return res.status(404).json({ error: 'Vault not found' });

    const rewards = await prisma.reward.findMany({
      where: { vaultId: vault.id },
      orderBy: { timestamp: 'desc' },
    });

    const totalRewards = rewards.reduce((sum, r) => sum + r.amount, 0);
    return res.status(200).json({ vaultPubkey, totalRewards, rewards });
  } catch (error) {
    logger.error(`getVaultRewards failed: ${(error as Error).message}`);
    return res.status(500).json({ error: 'Failed to fetch vault rewards' });
  }
};