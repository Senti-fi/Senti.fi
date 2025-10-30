import { Request, Response } from 'express';
import { Connection, PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferCheckedInstruction } from '@solana/spl-token';
import { PrismaClient } from '@prisma/client';
import sanitizeHtml from 'sanitize-html';
import logger from '../utils/logger';

const prisma = new PrismaClient();
const connection = new Connection(process.env.SOLANA_RPC || 'https://api.devnet.solana.com', 'confirmed');

const TOKEN_MINTS: Record<string, PublicKey> = {
  USDC: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
  USDT: new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'),
  SOL: new PublicKey('So11111111111111111111111111111111111111112'),
};

const MASTER_WALLETS: Record<string, string> = {
  USDC: process.env.USDC_MASTER_WALLET_PUBKEY || '',
  USDT: process.env.USDT_MASTER_WALLET_PUBKEY || '',
  SOL: process.env.SOL_MASTER_WALLET_PUBKEY || '',
};

const DECIMALS = { USDC: 6, USDT: 6, SOL: 9 };
const EARLY_WITHDRAWAL_FEE = 0.01;
const MAX_VAULT_DEPOSIT = 1_000_000;
const LAMPORTS_PER_SOL = 1_000_000_000;

// ------------------ Helper ------------------
interface AuthenticatedRequest extends Request {
  userId?: string;
}

async function calculateAccruedRewards(amount: number, apy: number, startDate: Date) {
  const days = Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const dailyRate = apy / 365;
  return Number((amount * dailyRate * days).toFixed(2));
}

// ------------------ DEPOSIT ------------------
export const deposit = async (req: AuthenticatedRequest, res: Response) => {
  const { token, amount, vaultPlanId, txHash } = req.body;
  if (!token || !amount || !vaultPlanId || !txHash)
    return res.status(400).json({ error: 'Missing parameters' });

  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const plan = await prisma.vaultPlan.findUnique({ where: { id: vaultPlanId } });
    if (!plan || !plan.isActive) return res.status(400).json({ error: 'Invalid vault plan' });

    const masterWalletPubkey = new PublicKey(MASTER_WALLETS[token]);
    const existingVault = await prisma.vault.findFirst({
      where: { userId: req.userId, token, vaultPlanId: plan.id },
    });

    const newTotal = (existingVault?.totalDeposits || 0) + amount;
    if (newTotal > MAX_VAULT_DEPOSIT) return res.status(400).json({ error: 'Vault deposit limit exceeded' });

    let vault = existingVault;
    if (!vault) {
      vault = await prisma.vault.create({
        data: {
          userId: req.userId,
          vaultPlanId: plan.id,
          vaultPubkey: masterWalletPubkey.toBase58(),
          token,
          totalDeposits: amount,
          locked: true,
          lockPeriodDays: plan.minLockDays,
          yieldRate: plan.apy,
        },
      });
    } else {
      vault = await prisma.vault.update({
        where: { id: vault.id },
        data: { totalDeposits: newTotal },
      });
    }

    const lockUntil = new Date();
    lockUntil.setDate(lockUntil.getDate() + plan.minLockDays);

    const userVault = await prisma.userVault.create({
      data: {
        userId: req.userId,
        vaultPubkey: vault.vaultPubkey,
        walletAddress: user.solanaPubkey,
        token,
        amount,
        lockedUntil: lockUntil,
        vaultId: vault.id,
      },
    });

    await prisma.transaction.create({
      data: {
        txHash,
        userVaultId: userVault.id,
        userId: req.userId,
        vaultPubkey: vault.vaultPubkey,
        walletAddress: user.solanaPubkey,
        token,
        amount,
        type: 'deposit',
      },
    });

    return res.status(200).json({
      vaultPubkey: vault.vaultPubkey,
      plan: { name: plan.name, apy: plan.apy, riskType: plan.riskType },
      lockedUntil: userVault.lockedUntil,
      deposit: { amount, token },
    });
  } catch (err) {
    logger.error(`Deposit error: ${(err as Error).message}`);
    return res.status(500).json({ error: 'Deposit failed' });
  }
};

// ------------------ WITHDRAW INSTRUCTIONS ------------------
export const withdrawInstructions = async (req: AuthenticatedRequest, res: Response) => {
  const { userVaultId, allowEarlyWithdrawal } = req.body;
  if (!userVaultId) return res.status(400).json({ error: 'Missing userVaultId' });
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const userVault = await prisma.userVault.findUnique({ where: { id: userVaultId } });
    if (!userVault || userVault.userId !== req.userId)
      return res.status(404).json({ error: 'User vault not found' });

    const vault = await prisma.vault.findUnique({ where: { vaultPubkey: userVault.vaultPubkey } });
    if (!vault) return res.status(404).json({ error: 'Vault not found' });

    const now = new Date();
    const stillLocked = userVault.lockedUntil && now < userVault.lockedUntil;
    if (!allowEarlyWithdrawal && stillLocked)
      return res.status(400).json({ error: 'Deposit is still locked' });

    const rewards = await calculateAccruedRewards(userVault.amount, vault.yieldRate, userVault.createdAt);
    let totalAmount = userVault.amount + rewards;
    let withdrawalFee = 0;

    if (allowEarlyWithdrawal && stillLocked) {
      withdrawalFee = totalAmount * EARLY_WITHDRAWAL_FEE;
      totalAmount -= withdrawalFee;
    }

    const vaultPk = new PublicKey(vault.vaultPubkey);
    const userPk = new PublicKey(userVault.walletAddress);
    let instruction: TransactionInstruction;

    if (userVault.token === 'SOL') {
      instruction = SystemProgram.transfer({
        fromPubkey: vaultPk,
        toPubkey: userPk,
        lamports: BigInt(Math.floor(totalAmount * LAMPORTS_PER_SOL)),
      });
    } else {
      const mint = TOKEN_MINTS[userVault.token];
      const vaultATA = await getAssociatedTokenAddress(mint, vaultPk);
      const userATA = await getAssociatedTokenAddress(mint, userPk);
      instruction = createTransferCheckedInstruction(
        vaultATA,
        mint,
        userATA,
        vaultPk,
        BigInt(Math.floor(totalAmount * Math.pow(10, DECIMALS[userVault.token]))),
        DECIMALS[userVault.token]
      );
    }

    return res.status(200).json({
      instructions: [
        {
          programId: instruction.programId.toBase58(),
          keys: instruction.keys.map(k => ({
            pubkey: k.pubkey.toBase58(),
            isSigner: k.isSigner,
            isWritable: k.isWritable,
          })),
          data: instruction.data.toString('base64'),
        },
      ],
      summary: { principal: userVault.amount, rewards, withdrawalFee, totalAmount },
    });
  } catch (err) {
    logger.error(`Withdraw instructions error: ${(err as Error).message}`);
    return res.status(500).json({ error: 'Failed to generate withdraw instructions' });
  }
};

// ------------------ WITHDRAW ------------------
export const withdraw = async (req: AuthenticatedRequest, res: Response) => {
  const { userVaultId, principal, rewards, withdrawalFee = 0, txHash } = req.body;
  if (!userVaultId || principal === undefined || rewards === undefined || !txHash)
    return res.status(400).json({ error: 'Missing parameters' });
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const userVault = await prisma.userVault.findUnique({ where: { id: userVaultId } });
    if (!userVault || userVault.userId !== req.userId)
      return res.status(404).json({ error: 'User vault not found' });

    const vault = await prisma.vault.findUnique({ where: { vaultPubkey: userVault.vaultPubkey } });
    if (!vault) return res.status(404).json({ error: 'Vault not found' });

    const totalAmount = principal + rewards - withdrawalFee;

    await prisma.vault.update({
      where: { id: vault.id },
      data: { totalDeposits: vault.totalDeposits - principal },
    });

    await prisma.userVault.update({
      where: { id: userVaultId },
      data: { amount: { decrement: principal } },
    });

    await prisma.transaction.createMany({
      data: [
        {
          txHash,
          userVaultId,
          userId: req.userId,
          vaultPubkey: vault.vaultPubkey,
          walletAddress: userVault.walletAddress,
          token: userVault.token,
          amount: totalAmount,
          type: 'withdraw',
        },
        ...(withdrawalFee > 0
          ? [
              {
                txHash: `fee-${txHash}`,
                userVaultId,
                userId: req.userId,
                vaultPubkey: vault.vaultPubkey,
                walletAddress: userVault.walletAddress,
                token: userVault.token,
                amount: withdrawalFee,
                type: 'fee',
              },
            ]
          : []),
      ],
    });

    if (rewards > 0) {
      await prisma.reward.create({
        data: {
          userVaultId,
          vaultPubkey: vault.vaultPubkey,
          walletAddress: userVault.walletAddress,
          token: userVault.token,
          amount: rewards,
        },
      });
    }

    return res.status(200).json({ success: true, totalAmount, rewards, withdrawalFee });
  } catch (err) {
    logger.error(`Withdraw error: ${(err as Error).message}`);
    return res.status(500).json({ error: 'Withdraw failed' });
  }
};