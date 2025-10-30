import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';


declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.error('Authentication failed: No token provided or invalid format');
    return res.status(401).json({ error: 'No token provided or invalid format' });
  }

  const token = authHeader.split(' ')[1];

  if (!process.env.JWT_SECRET) {
    logger.error('Authentication failed: JWT_SECRET not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    logger.info(`Authenticated user: ${decoded.userId}`);
    next();
  } catch (error) {
    logger.error(`Authentication failed: Invalid token - ${(error as Error).message}`);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export default authMiddleware;