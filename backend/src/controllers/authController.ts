import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';
import { PublicKey } from '@solana/web3.js';

const prisma = new PrismaClient();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_EXPIRATION = "7d";

/**
 * Signup controller - handles wallet, Google, Apple
 */
export const signup = async (req: Request, res: Response) => {
  try {
    const { provider, token, solanaPubkey } = req.body as {
      provider: 'wallet' | 'google' | 'apple';
      token?: string;
      solanaPubkey: string;
    };

    if (!solanaPubkey) return res.status(400).json({ error: 'Missing Solana public key' });

    let pubKeyObj: PublicKey;
    try {
      pubKeyObj = new PublicKey(solanaPubkey);
    } catch {
      return res.status(400).json({ error: 'Invalid Solana public key' });
    }

    // Check if wallet already exists
    const existingWallet = await prisma.user.findUnique({ where: { solanaPubkey } });
    if (existingWallet) return res.status(400).json({ error: 'Wallet already exists' });

    let email: string | undefined;

    // Validate Google / Apple token
    if (provider === 'google') {
      if (!token) return res.status(400).json({ error: 'Missing Google token' });
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      email = ticket.getPayload()?.email;
      if (!email) return res.status(400).json({ error: 'Google token has no email' });
    } else if (provider === 'apple') {
      if (!token) return res.status(400).json({ error: 'Missing Apple token' });
      const response = await appleSignin.verifyIdToken(token, { audience: process.env.APPLE_CLIENT_ID });
      email = response.email;
      if (!email) return res.status(400).json({ error: 'Apple token has no email' });
    } else if (provider !== 'wallet') {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        provider,
        solanaPubkey,
        ...(email && { email }), 
      },
    });

    // Generate JWT
    const jwtToken = jwt.sign(
      { userId: user.id, solanaPubkey: user.solanaPubkey },
      process.env.JWT_SECRET!,
      { expiresIn: JWT_EXPIRATION }
    );

    return res.status(200).json({ token: jwtToken, user });
  } catch (err) {
    logger.error(`Signup failed: ${(err as Error).message}`);
    return res.status(500).json({ error: 'Failed to sign up' });
  }
};

/**
 * Login controller - wallet-based login
 */

export const login = async (req: Request, res: Response) => {
  try {
    const { provider, token, solanaPubkey } = req.body as {
      provider: 'wallet' | 'google' | 'apple';
      token?: string;
      solanaPubkey?: string;
    };

    let user;

    if (provider === 'wallet') {
      if (!solanaPubkey) return res.status(400).json({ error: 'Missing Solana public key' });

      user = await prisma.user.findUnique({ where: { solanaPubkey } });
      if (!user) return res.status(404).json({ error: 'User not found' });

    } else if (provider === 'google') {
      if (!token) return res.status(400).json({ error: 'Missing Google token' });

      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const email = ticket.getPayload()?.email;
      if (!email) return res.status(400).json({ error: 'Google token has no email' });

      user = await prisma.user.findUnique({ where: { email } });
      if (!user || user.provider !== 'google')
        return res.status(404).json({ error: 'User not found or wrong provider' });

    } else if (provider === 'apple') {
      if (!token) return res.status(400).json({ error: 'Missing Apple token' });

      const response = await appleSignin.verifyIdToken(token, { audience: process.env.APPLE_CLIENT_ID });
      const email = response.email;
      if (!email) return res.status(400).json({ error: 'Apple token has no email' });

      user = await prisma.user.findUnique({ where: { email } });
      if (!user || user.provider !== 'apple')
        return res.status(404).json({ error: 'User not found or wrong provider' });

    } else {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    // Generate JWT
    const jwtToken = jwt.sign(
      { userId: user.id, solanaPubkey: user.solanaPubkey },
      process.env.JWT_SECRET!,
      { expiresIn: JWT_EXPIRATION }
    );

    return res.status(200).json({ token: jwtToken, user });
  } catch (err) {
    logger.error(`Login failed: ${(err as Error).message}`);
    return res.status(500).json({ error: 'Failed to login' });
  }
};

