import { Request, Response } from 'express';
import { Connection, PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferCheckedInstruction, getAccount, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';
import withRetry from '../utils/withRetry';

const prisma = new PrismaClient();
const connection = new Connection(process.env.SOLANA_RPC || 'https://api.devnet.solana.com', 'confirmed');

const TOKEN_MINTS: { [key: string]: PublicKey } = {
  USDC: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
  USDT: new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'),
  SOL: new PublicKey('So11111111111111111111111111111111111111112'),
};

const DECIMALS: { [key: string]: number } = {
  USDC: 6,
  USDT: 6,
  SOL: 9,
};

const LAMPORTS_PER_SOL = 1_000_000_000;

// --------------------- SEND ---------------------
export const send = async (req: Request, res: Response) => {
  const { token, amount, recipient } = req.body as {
    token: string;
    amount: number;
    recipient: string;
  };

  if (!token || !amount || !recipient)
    return res.status(400).json({ error: "Missing parameters" });
  if (!["USDC", "USDT", "SOL"].includes(token))
    return res.status(400).json({ error: "Invalid token" });
  if (amount <= 0)
    return res.status(400).json({ error: "Amount must be positive" });
  if (!req.userId)
    return res.status(401).json({ error: "Unauthorized" });

  try {
    const sender = await prisma.user.findUnique({
      where: { id: req.userId },
    });
    if (!sender) return res.status(404).json({ error: "Sender not found" });

    //  Resolve recipient
    let recipientPubkey: PublicKey;
    if (recipient.includes("@")) {
      const recipientUser = await prisma.user.findUnique({
        where: { email: recipient },
      });
      if (!recipientUser)
        return res.status(404).json({ error: "Recipient not found" });
      recipientPubkey = new PublicKey(recipientUser.solanaPubkey);
    } else {
      recipientPubkey = new PublicKey(recipient);
    }

    const senderPk = new PublicKey(sender.solanaPubkey);
    const instructions: TransactionInstruction[] = [];

    if (token === "SOL") {
      //  Native SOL transfer
      instructions.push(
        SystemProgram.transfer({
          fromPubkey: senderPk,
          toPubkey: recipientPubkey,
          lamports: BigInt(Math.floor(amount * LAMPORTS_PER_SOL)),
        })
      );
    } else {
      //  SPL Token (USDC / USDT)
      const mint = TOKEN_MINTS[token];
      const senderATA = await getAssociatedTokenAddress(mint, senderPk);
      const recipientATA = await getAssociatedTokenAddress(
        mint,
        recipientPubkey
      );

      //  Check if recipient ATA exists; if not, add createATA instruction
      try {
        await getAccount(connection, recipientATA);
      } catch {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            senderPk, // payer
            recipientATA,
            recipientPubkey,
            mint
          )
        );
      }

      // Transfer token
      instructions.push(
        createTransferCheckedInstruction(
          senderATA,
          mint,
          recipientATA,
          senderPk,
          BigInt(Math.floor(amount * Math.pow(10, DECIMALS[token]))),
          DECIMALS[token]
        )
      );
    }

    //  Format instructions for frontend
    const formattedInstructions = instructions.map((ix) => ({
      programId: ix.programId.toBase58(),
      keys: ix.keys.map((k) => ({
        pubkey: k.pubkey.toBase58(),
        isSigner: k.isSigner,
        isWritable: k.isWritable,
      })),
      data: ix.data.toString("base64"),
    }));

    return res.status(200).json({
      instructions: formattedInstructions,
      senderPubkey: senderPk.toBase58(),
      recipientPubkey: recipientPubkey.toBase58(),
      token,
      amount,
    });
  } catch (error) {
    logger.error(`Send failed: ${(error as Error).message}`);
    return res
      .status(500)
      .json({ error: "Failed to generate send instructions" });
  } finally {
    await prisma.$disconnect();
  }
};

// --------------------- RECEIVE ---------------------
export const receive = async (req: Request, res: Response) => {
  const { token, amount, txHash } = req.body as { token: string; amount: number; txHash: string };

  if (!token || !amount || !txHash) return res.status(400).json({ error: 'Missing parameters' });
  if (!['USDC', 'USDT', 'SOL'].includes(token)) return res.status(400).json({ error: 'Invalid token' });
  if (amount <= 0) return res.status(400).json({ error: 'Amount must be positive' });
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const txInfo = await connection.getTransaction(txHash, { maxSupportedTransactionVersion: 0 });
    if (!txInfo) return res.status(400).json({ error: 'Transaction not found' });

    
    await prisma.transaction.create({
      data: {
        txHash,
        userId: req.userId,
        walletAddress: user.solanaPubkey,
        token,
        amount,
        type: 'receive',
        timestamp: new Date(),
      },
    });

    return res.status(200).json({ success: true, amount, token });
  } catch (error) {
    logger.error(`Receive failed: ${(error as Error).message}`);
    return res.status(500).json({ error: 'Failed to record receive transaction' });
  } finally {
    await prisma.$disconnect();
  }
};

// --------------------- MONITOR ---------------------
export const monitor = async (req: Request, res: Response) => {
  if (!req.userId)
    return res.status(401).json({ error: 'Unauthorized' });

  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const userPk = new PublicKey(user.solanaPubkey);

    // Fetch recent transactions
    const addressesToCheck = [
      userPk,
      await getAssociatedTokenAddress(TOKEN_MINTS.USDC, userPk),
      await getAssociatedTokenAddress(TOKEN_MINTS.USDT, userPk),
    ];
    
    let allSignatures: any[] = [];
    for (const addr of addressesToCheck) {
      const sigs = await withRetry(() =>
        connection.getSignaturesForAddress(addr, { limit: 10 })
      );
      allSignatures.push(...sigs);
    }
    
    // remove duplicates by signature
    const signatures = Array.from(
      new Map(allSignatures.map(s => [s.signature, s])).values()
    );

    if (!signatures.length)
      return res.status(200).json({ newTransactions: [] });

    const transactions = await Promise.all(
      signatures.map(sig =>
        connection
          .getTransaction(sig.signature, { maxSupportedTransactionVersion: 0 })
          .catch(() => null)
      )
    );

    const newTransactions: any[] = [];

    for (let i = 0; i < signatures.length; i++) {
      const sig = signatures[i];
      const txInfo = transactions[i];
      if (!txInfo || !txInfo.meta) continue;

      const existing = await prisma.transaction.findUnique({
        where: { txHash: sig.signature },
      });
      if (existing) continue;

      let detectedToken = 'SOL';
      let amount = 0;
      let type: 'send' | 'receive' = 'receive';

      // ----------------  detect SPL token movement ----------------
      const preTokenBalances = txInfo.meta.preTokenBalances || [];
      const postTokenBalances = txInfo.meta.postTokenBalances || [];

      for (const post of postTokenBalances) {
        if (post.owner !== user.solanaPubkey) continue;
        const pre = preTokenBalances.find(
          b => b.mint === post.mint && b.owner === post.owner
        );
        if (!pre) continue;

        const preRaw = Number(pre.uiTokenAmount.amount);
        const postRaw = Number(post.uiTokenAmount.amount);
        const deltaRaw = postRaw - preRaw;
        if (Math.abs(deltaRaw) === 0) continue;

        const decimals = post.uiTokenAmount.decimals;
        amount = Math.abs(deltaRaw) / Math.pow(10, decimals);
        type = deltaRaw > 0 ? 'receive' : 'send';

        // Match mint to known token
        detectedToken =
          Object.keys(TOKEN_MINTS).find(
            key => TOKEN_MINTS[key].toBase58() === post.mint
          ) || post.mint.slice(0, 6);
      }

      // ---------------- If no SPL movement, check SOL ----------------
      if (amount === 0) {
        const accountKeys = txInfo.transaction.message.getAccountKeys();
        const staticKeys = accountKeys.staticAccountKeys;
        const userIndex = staticKeys.findIndex(
          pk => pk.toBase58() === user.solanaPubkey
        );
        if (userIndex !== -1) {
          const preLamports = txInfo.meta.preBalances[userIndex];
          const postLamports = txInfo.meta.postBalances[userIndex];
          const deltaLamports = postLamports - preLamports;

          // Ignore tiny SOL fee changes (<0.000001 SOL)
          if (Math.abs(deltaLamports) > 1000) {
            amount = Math.abs(deltaLamports) / LAMPORTS_PER_SOL;
            type = deltaLamports > 0 ? 'receive' : 'send';
            detectedToken = 'SOL';
          }
        }
      }

      if (amount === 0) continue;

      const createdTx = await prisma.transaction.create({
        data: {
          txHash: sig.signature,
          userId: req.userId,
          walletAddress: user.solanaPubkey,
          token: detectedToken,
          amount,
          type,
          timestamp: new Date(sig.blockTime ? sig.blockTime * 1000 : Date.now()),
        },
      });

      newTransactions.push({
        txHash: createdTx.txHash,
        token: createdTx.token,
        amount: createdTx.amount,
        type: createdTx.type,
        timestamp: createdTx.timestamp,
      });
    }

    return res.status(200).json({ newTransactions });
  } catch (error) {
    logger.error(`Monitor failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return res.status(500).json({
      error: 'Failed to monitor transactions',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    await prisma.$disconnect();
  }
};
// --------------------- QR SEND ---------------------
export const sendQr = async (req: Request, res: Response) => {
  const { qrData } = req.body as { qrData: string };
  if (!qrData) return res.status(400).json({ error: 'Missing QR data' });
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const sender = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!sender) return res.status(404).json({ error: 'Sender not found' });

    const url = new URL(qrData.startsWith('solana:') ? qrData : `solana:${qrData}`);
    const recipientPubkey = new PublicKey(url.pathname);
    const token = url.searchParams.get('token') || '';
    const amount = parseFloat(url.searchParams.get('amount') || '0');

    if (!['USDC', 'USDT', 'SOL'].includes(token)) return res.status(400).json({ error: 'Invalid token in QR' });

    const senderPk = new PublicKey(sender.solanaPubkey);
    let instruction: TransactionInstruction | null = null;

    if (token === 'SOL') {
      if (amount > 0) {
        instruction = SystemProgram.transfer({
          fromPubkey: senderPk,
          toPubkey: recipientPubkey,
          lamports: BigInt(Math.floor(amount * LAMPORTS_PER_SOL)),
        });
      }
    } else {
      const mint = TOKEN_MINTS[token];
      const senderATA = await getAssociatedTokenAddress(mint, senderPk);
      const recipientATA = await getAssociatedTokenAddress(mint, recipientPubkey);

      if (amount > 0) {
        instruction = createTransferCheckedInstruction(
          senderATA,
          mint,
          recipientATA,
          senderPk,
          BigInt(Math.floor(amount * Math.pow(10, DECIMALS[token]))),
          DECIMALS[token]
        );
      }
    }

    const response: any = {
      recipientPubkey: recipientPubkey.toBase58(),
      token,
      amount,
    };

    if (instruction) {
      response.instruction = {
        programId: instruction.programId.toBase58(),
        keys: instruction.keys.map(k => ({
          pubkey: k.pubkey.toBase58(),
          isSigner: k.isSigner,
          isWritable: k.isWritable,
        })),
        data: instruction.data.toString('base64'),
      };
    }

    return res.status(200).json(response);
  } catch (error) {
    logger.error(`QR send failed: ${(error as Error).message}`);
    return res.status(500).json({ error: 'Failed to process QR send' });
  } finally {
    await prisma.$disconnect();
  }
};
