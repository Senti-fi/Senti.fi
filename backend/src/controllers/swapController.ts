import { Request, Response, Router } from 'express';
import axios from 'axios';
import prisma from '../lib/prisma'; 
import logger from '../utils/logger';

interface AuthenticatedRequest extends Request {
  userId?: string;
}

// Token mint addresses & decimals
const TOKEN_MINTS: Record<string, { mint: string; decimals: number }> = {
  USDC: { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  USDT: { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
  SOL:  { mint: 'So11111111111111111111111111111111111111112', decimals: 9 },
};

// ---------------- SWAP TOKENS ----------------
export const swapTokens = async (req: AuthenticatedRequest, res: Response) => {
  const { fromToken, toToken, amount, userPubkey } = req.body;

  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!fromToken || !toToken || !amount || !userPubkey)
    return res.status(400).json({ error: 'Missing parameters' });

  try {
    const fromInfo = TOKEN_MINTS[fromToken];
    const toInfo = TOKEN_MINTS[toToken];
    if (!fromInfo || !toInfo) return res.status(400).json({ error: 'Invalid token' });

    
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || user.solanaPubkey !== userPubkey)
      return res.status(403).json({ error: 'Wallet does not belong to user' });

    
    const amountRaw = Math.floor(amount * 10 ** fromInfo.decimals);

    //  Call Jupiter quote API
    const quoteResponse = await axios.get('https://quote-api.jup.ag/v4/quote', {
      params: {
        inputMint: fromInfo.mint,
        outputMint: toInfo.mint,
        amount: amountRaw,
        slippageBps: 50,
        userPublicKey: userPubkey,
      },
    });

    const quote = quoteResponse.data;
    if (!quote?.data || quote.data.length === 0)
      return res.status(400).json({ error: 'No swap routes available' });

    // Pick the best route
    const bestRoute = quote.data.reduce((best: any, route: any) =>
      route.outAmount > best.outAmount ? route : best,
      quote.data[0]
    );

    // Create pending swap transaction in DB
    const pendingTx = await prisma.transaction.create({
      data: {
        userId: req.userId,
        walletAddress: userPubkey,
        token: fromToken,
        amount,
        type: 'swap',
        status: 'pending',
        timestamp: new Date(),
        txHash: 'pending-' + Date.now(),
        recipient: toToken,
      },
    });

    // Get serialized swap instructions
    const swapTxResponse = await axios.post('https://quote-api.jup.ag/v4/swap', {
      route: bestRoute,
      userPublicKey: userPubkey,
    });

    return res.status(200).json({
      message: 'Swap ready',
      pendingTx,
      quote: bestRoute,
      swapInstructions: swapTxResponse.data,
    });

  } catch (err) {
    logger.error(`Swap error: ${(err as Error).message}`);
    return res.status(500).json({ error: 'Swap failed' });
  }
};

// ---------------- SWAP WEBHOOK ----------------
export const swapWebhook = async (req: Request, res: Response) => {
  const { txId, status, providerTxHash, receivedAmount } = req.body;

  if (!txId || !status) return res.status(400).json({ error: 'Missing txId or status' });

  try {
    const tx = await prisma.transaction.updateMany({
      where: { id: txId, status: 'pending' },
      data: {
        status, 
        txHash: providerTxHash || undefined,
        amount: receivedAmount || undefined,
        updatedAt: new Date(),
      },
    });

    if (tx.count === 0) {
      logger.warn(`Swap webhook: transaction ${txId} already updated or not found`);
    } else {
      logger.info(`Swap tx ${txId} updated with status ${status}`);
    }

    res.status(200).send('OK');
  } catch (err) {
    logger.error(`Swap webhook error: ${(err as Error).message}`);
    res.status(500).json({ error: 'Failed to update swap transaction' });
  }
};

