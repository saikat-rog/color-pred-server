import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

interface AdminJWTPayload {
  adminId: number;
  username: string;
  iat?: number;
  exp?: number;
}

export const authenticateAdmin = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ success: false, message: 'Admin access token is required' });
      return;
    }
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    if (!token) {
      res.status(401).json({ success: false, message: 'Admin access token is required' });
      return;
    }
    const decoded = jwt.verify(token, (process.env.ADMIN_JWT_SECRET || config.jwt.secret) as string) as AdminJWTPayload;
    (req as any).admin = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, message: 'Admin access token has expired' });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ success: false, message: 'Invalid admin access token' });
      return;
    }
    console.error('Error in authenticateAdmin middleware:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
