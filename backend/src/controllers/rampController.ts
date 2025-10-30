import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import logger from '../utils/logger';

const prisma = new PrismaClient();
const PROVIDER_API_URL = '';
const PROVIDER_API_KEY = process.env.PROVIDER_API_KEY;

interface AuthenticatedRequest extends Request {
  userId?: string;
}

// ------------------------- ON-RAMP -------------------------
export const onRamp = async (req: AuthenticatedRequest, res: Response) => {
  const { amount, currency, walletAddress: walletFromBody } = req.body;

  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!amount || !currency)
    return res.status(400).json({ error: 'Missing parameters' });

  try {
    //  Get user's wallet from DB 
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { solanaPubkey: true },
    });

    const walletAddress = walletFromBody || user?.solanaPubkey;
    if (!walletAddress)
      return res.status(400).json({ error: 'Missing user wallet address' });

    //  Create pending transaction record
    const pendingTx = await prisma.transaction.create({
      data: {
        userId: req.userId,
        walletAddress,
        token: currency,
        amount,
        type: 'onramp',
        status: 'pending',
        txHash: 'pending-' + Date.now(),
      },
    });

    //  Notify provider with full payload
    const providerResponse = await axios.post(`${PROVIDER_API_URL}/onramp`, {
      userId: req.userId,
      walletAddress,
      amount,
      currency,
      callbackUrl: `${process.env.BACKEND_URL}/api/webhook/provider`,
      txId: pendingTx.id,
      apiKey: PROVIDER_API_KEY,
    });

    return res.status(200).json({
      message: 'On-ramp initiated successfully',
      providerData: providerResponse.data,
      pendingTx,
    });
  } catch (err) {
    logger.error(`On-ramp error: ${(err as Error).message}`);
    return res.status(500).json({ error: 'On-ramp failed' });
  }
};

// ------------------------- OFF-RAMP -------------------------
export const offRamp = async (req: AuthenticatedRequest, res: Response) => {
    const { amount, currency, destination } = req.body;
  
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!amount || !currency || !destination)
      return res.status(400).json({ error: 'Missing parameters' });
  
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { solanaPubkey: true },
      });
  
      if (!user?.solanaPubkey)
        return res.status(400).json({ error: 'User wallet not found' });
  
      const pendingTx = await prisma.transaction.create({
        data: {
          userId: req.userId,
          walletAddress: user.solanaPubkey,
          token: currency,
          amount,
          type: 'offramp',
          status: 'pending',
          txHash: 'pending-' + Date.now(),
        },
      });
  
      //  Get deposit address from provider
      const providerResponse = await axios.post(`${PROVIDER_API_URL}/offramp`, {
        userId: req.userId,
        walletAddress: user.solanaPubkey,
        amount,
        currency,
        destination,
        callbackUrl: `${process.env.BACKEND_URL}/api/webhook/provider`,
        txId: pendingTx.id,
        apiKey: PROVIDER_API_KEY,
      });
  
      // Return deposit info for frontend to send crypto
      return res.status(200).json({
        message: 'Off-ramp initiated',
        providerData: providerResponse.data,  // should include depositAddress
        pendingTx,
      });
    } catch (err) {
      logger.error(`Off-ramp error: ${(err as Error).message}`);
      return res.status(500).json({ error: 'Off-ramp failed' });
    }
  };
// ------------------------- PROVIDER WEBHOOK -------------------------
export const providerWebhook = async (req: Request, res: Response) => {
  const { txId, status, providerTxHash, amount, currency, apiKey } = req.body;

  //  Verify provider authenticity
  if (apiKey !== PROVIDER_API_KEY)
    return res.status(403).send('Unauthorized provider');
  if (!txId || !status) return res.status(400).send('Missing txId or status');

  try {
    //  Update transaction in DB
    const tx = await prisma.transaction.update({
      where: { id: txId },
      data: {
        txHash: providerTxHash || txId,
        amount: amount || undefined,
        token: currency || undefined,
        status,
        timestamp: new Date(),
      },
    });

    logger.info(` Webhook updated transaction ${txId} → ${status}`);
    return res.status(200).send('OK');
  } catch (err) {
    logger.error(`Webhook error: ${(err as Error).message}`);
    return res.status(500).send('Failed to update transaction');
  }
};