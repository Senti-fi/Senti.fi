import { Request, Response } from 'express';
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferCheckedInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { PrismaClient, TransactionType, TransactionStatus } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();
const connection = new Connection(process.env.SOLANA_RPC || 'https://api.devnet.solana.com', 'confirmed');

// === CONFIG ===
const TOKEN_MINTS: Record<string, PublicKey> = {
  USDC: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'), // DEVNET
  USDT: new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'),
  SOL: new PublicKey('So11111111111111111111111111111111111111112'),
};

const DECIMALS: Record<string, number> = { USDC: 6, USDT: 6, SOL: 9 };
const EARLY_WITHDRAWAL_FEE = 0.01;
const LAMPORTS_PER_SOL = 1_000_000_000;

interface AuthenticatedRequest extends Request {
  userId?: string;
}

// DEV ONLY: Load vault key
function loadVaultKey(token: 'USDC' | 'USDT' | 'SOL'): Keypair {
  const key = process.env[`${token}_VAULT_PRIVATE_KEY`];
  if (!key) throw new Error(`Missing ${token}_VAULT_PRIVATE_KEY`);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(key)));
}
// Calculate rewards
async function calculateAccruedRewards(amount: number, apy: number, startDate: Date): Promise<number> {
  const days = Math.floor((Date.now() - startDate.getTime()) / (86_400_000));
  const dailyRate = apy / 365;
  return Number((amount * dailyRate * days).toFixed(6));
}

// ------------------ DEPOSIT ------------------
export const deposit = async (req: AuthenticatedRequest, res: Response) => {
  const { token, amount, vaultPlanId, txHash } = req.body;
  if (!token || amount == null || !vaultPlanId || !txHash)
    return res.status(400).json({ error: 'Missing parameters' });

  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!['USDC', 'USDT', 'SOL'].includes(token))
    return res.status(400).json({ error: 'Invalid token' });

  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const plan = await prisma.vaultPlan.findUnique({ where: { id: vaultPlanId } });
    if (!plan || !plan.isActive) return res.status(400).json({ error: 'Invalid plan' });

    const vaultPubkey = process.env[`${token}_MASTER_WALLET_PUBKEY`];
    if (!vaultPubkey) return res.status(500).json({ error: 'Vault not configured' });

    // === UPSERT VAULT ===
    const vault = await prisma.vault.upsert({
      where: { vaultPlanId_token: { vaultPlanId: plan.id, token } },
      update: { totalDeposits: { increment: amount } },
      create: {
        vaultPlanId: plan.id,
        name: plan.name,
        vaultPubkey,
        token,
        symbol: token,
        yieldRate: plan.apy,
        totalDeposits: amount,
      },
    });

    // === UPSERT USER VAULT ===
    const lockUntil = new Date();
    lockUntil.setDate(lockUntil.getDate() + plan.minLockDays);

    const userVault = await prisma.userVault.upsert({
      where: { userId_vaultId: { userId: req.userId, vaultId: vault.id } },
      update: {
        amount: { increment: amount },
        lockedUntil: { set: lockUntil },
      },
      create: {
        userId: req.userId,
        vaultId: vault.id,
        walletAddress: user.solanaPubkey,
        token,
        amount,
        lockedUntil: lockUntil,
      },
    });
    // ===== VERIFY TX ON-CHAIN =====
const txInfo = await connection.getParsedTransaction(txHash, { maxSupportedTransactionVersion: 0 });
if (!txInfo) {
  logger.warn(`Transaction not found: ${txHash}`);
  return res.status(400).json({ error: 'Transaction not found' });
}


if (txInfo.meta?.err) {
  logger.warn(`Transaction ${txHash} failed on-chain: ${JSON.stringify(txInfo.meta.err)}`);
  return res.status(400).json({ error: 'Transaction failed on-chain' });
}


const topLevel = (txInfo.transaction?.message?.instructions ?? []) as any[];
const inner = (txInfo.meta?.innerInstructions ?? []).flatMap((ii: any) => ii.instructions ?? []);
const allInstructions = [...topLevel, ...inner];

// helper: expected values
const expectedAmountUnits = token === 'SOL'
  ? amount * LAMPORTS_PER_SOL
  : amount * Math.pow(10, DECIMALS[token]);

let verified = false;

for (const instr of allInstructions) {
  // SOL native transfers (system program)
  if (token === 'SOL' && (instr.program === 'system' || instr.programId?.toBase58?.() === SystemProgram.programId.toBase58())) {
    const info = instr.parsed?.info;
    if (!info) continue;
    const from = info.source;
    const to = info.destination;
    const lamports = Number(info.lamports ?? 0);
    if (from === user.solanaPubkey && to === vaultPubkey && lamports >= expectedAmountUnits * 0.99) {
      verified = true;
      break;
    }
  }

  
  const progId = instr.programId?.toBase58?.();
  const isTokenProgram = progId === TOKEN_PROGRAM_ID.toBase58() || progId === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
  if (!isTokenProgram) continue;

  
  const parsed = instr.parsed;
  if (!parsed || !['transfer', 'transferChecked', 'transferCheckedInstruction', 'transferInstruction'].includes(parsed.type)) continue;

  const info = parsed.info ?? {};
  
  const transferred = Number(info.amount ?? info.tokenAmount?.amount ?? 0);

  
  const src = info.source ?? info.authority ?? '';
  const dst = info.destination ?? '';

  
  const userATA = (await getAssociatedTokenAddress(TOKEN_MINTS[token], new PublicKey(user.solanaPubkey))).toBase58();
  const vaultATA = (await getAssociatedTokenAddress(TOKEN_MINTS[token], new PublicKey(vaultPubkey))).toBase58();

  
  if (info.mint && info.mint !== TOKEN_MINTS[token].toBase58()) {
    continue; 
  }

  
  const srcMatches = src === user.solanaPubkey || src === userATA;
  const dstMatches = dst === vaultPubkey || dst === vaultATA;

  if (srcMatches && dstMatches && transferred >= expectedAmountUnits * 0.99) {
    verified = true;
    break;
  }
}

if (!verified) {
  logger.warn(`Deposit verification failed for tx ${txHash} token ${token}. parsed info snapshot: ${JSON.stringify(txInfo.transaction?.message?.instructions?.map((i:any)=>i.parsed?.info).slice(0,5))}`);
  return res.status(400).json({ error: 'Deposit transaction invalid' });
}

    
    // === RECORD ===
    await prisma.transaction.create({
      data: {
        txHash,
        userVaultId: userVault.id,
        userId: req.userId,
        vaultId: vault.id,
        vaultPubkey: vault.vaultPubkey,
        walletAddress: user.solanaPubkey,
        token,
        amount,
        type: TransactionType.deposit,
        status: TransactionStatus.confirmed,
      },
    });

    return res.json({
      vaultPubkey: vault.vaultPubkey,
      plan: { name: plan.name, apy: plan.apy },
      lockedUntil: userVault.lockedUntil,
      deposit: { amount, token },
    });
  } catch (err: any) {
    logger.error(`Deposit error: ${err.message}`);
    return res.status(500).json({ error: 'Deposit failed' });
  }
};

// ------------------ GET WITHDRAW OPTIONS ------------------
export const getWithdrawOptions = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const userVaults = await prisma.userVault.findMany({
      where: { userId: req.userId, amount: { gt: 0 } },
      include: {
        vault: {
          include: { vaultPlan: true },
        },
      },
    });

    const options = userVaults.map(uv => ({
      userVaultId: uv.id,
      vaultPlanId: uv.vault.vaultPlanId,
      planName: uv.vault.vaultPlan.name,
      token: uv.token,
      amount: uv.amount,
      lockedUntil: uv.lockedUntil,
      apy: uv.vault.yieldRate,
      vaultPubkey: uv.vault.vaultPubkey,
    }));

    return res.json({ options });
  } catch (err: any) {
    logger.error(`getWithdrawOptions: ${err.message}`);
    return res.status(500).json({ error: 'Failed' });
  }
};



// ------------------ WITHDRAW ------------------
export const withdraw = async (req: AuthenticatedRequest, res: Response) => {
  const { vaultPlanId, token, amount, walletAddress } = req.body;

  if (!vaultPlanId || !token || !amount || !walletAddress)
    return res.status(400).json({ error: "Missing fields" });

  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  if (!["USDC", "USDT", "SOL"].includes(token))
    return res.status(400).json({ error: "Invalid token" });

  try {
    // === Load vault keypair ===
    const vaultKeypair = loadVaultKey(token);

    // === Fetch vault data ===
    const vault = await prisma.vault.findUnique({
      where: { vaultPlanId_token: { vaultPlanId, token } },
      include: { vaultPlan: true },
    });
    if (!vault) return res.status(404).json({ error: "Vault not found" });

    const userVault = await prisma.userVault.findFirst({
      where: { userId: req.userId!, vaultId: vault.id },
    });
    if (!userVault) return res.status(404).json({ error: "No deposit found" });

    if (amount <= 0 || amount > userVault.amount)
      return res.status(400).json({ error: "Invalid amount" });

    // === Calculate rewards + fee ===
    const fullRewards = await calculateAccruedRewards(
      userVault.amount,
      vault.yieldRate,
      userVault.createdAt
    );
    const rewards = fullRewards * (amount / userVault.amount);
    const stillLocked =
      userVault.lockedUntil && new Date() < userVault.lockedUntil;

    let total = amount + rewards;
    let fee = 0;
    if (stillLocked) {
      fee = total * EARLY_WITHDRAWAL_FEE;
      total -= fee;
    }

    const userPk = new PublicKey(walletAddress);

    // === Build TX ===
    const tx = new Transaction();
    tx.feePayer = vaultKeypair.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;

    if (token === "SOL") {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: vaultKeypair.publicKey,
          toPubkey: userPk,
          lamports: Math.floor(total * LAMPORTS_PER_SOL),
        })
      );
    } else {
      const mint = TOKEN_MINTS[token];
      const vaultATA = await getAssociatedTokenAddress(mint, vaultKeypair.publicKey);
      const userATA = await getAssociatedTokenAddress(mint, userPk);

      // Create user ATA if missing
      let accountInfo;
      try {
        accountInfo = await getAccount(connection, userATA);
      } catch {}

      if (!accountInfo) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            vaultKeypair.publicKey,
            userATA,
            userPk,
            mint
          )
        );
      }

      tx.add(
        createTransferCheckedInstruction(
          vaultATA,
          mint,
          userATA,
          vaultKeypair.publicKey,
          BigInt(Math.floor(total * Math.pow(10, DECIMALS[token]))),
          DECIMALS[token]
        )
      );
    }

    // === Sign & Send ===
    tx.sign(vaultKeypair);
    const rawTx = tx.serialize();
    const signature = await connection.sendRawTransaction(rawTx, {
      skipPreflight: false,
    });
    await connection.confirmTransaction(signature, "confirmed");

    // === Update DB (atomic transaction) ===
    await prisma.$transaction(async (txDb) => {
      await txDb.userVault.update({
        where: { id: userVault.id },
        data: { amount: { decrement: amount } },
      });

      await txDb.transaction.create({
        data: {
          txHash: signature,
          userVaultId: userVault.id,
          userId: req.userId!,
          vaultId: vault.id,
          vaultPubkey: vault.vaultPubkey,
          walletAddress,
          token,
          amount: total,
          type: TransactionType.withdraw,
          status: TransactionStatus.confirmed,
        },
      });

      if (rewards > 0) {
        await txDb.reward.create({
          data: {
            userVaultId: userVault.id,
            vaultPubkey: vault.vaultPubkey,
            walletAddress,
            token,
            amount: rewards,
          },
        });
      }
    });

    return res.json({
      success: true,
      txHash: signature,
      summary: { total, rewards, fee },
    });
  } catch (err: any) {
    logger.error(`withdraw: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
};