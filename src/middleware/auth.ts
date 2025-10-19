import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { JWTPayload } from '../types';
import { databaseService } from '../services/databaseService';

/**
 * JWT Authentication Middleware
 * Verifies JWT token and adds user info to request object
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
      return;
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : authHeader;

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
      return;
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.jwt.secret as string) as JWTPayload;
    
    // Add user info to request object
    req.user = decoded;
    
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: 'Access token has expired'
      });
      return;
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: 'Invalid access token'
      });
      return;
    }

    console.error('Error in authenticateToken middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Optional Authentication Middleware
 * Adds user info to request if valid token is provided, but doesn't require it
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      next();
      return;
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : authHeader;

    if (!token) {
      next();
      return;
    }

    // Try to verify JWT token
    try {
      const decoded = jwt.verify(token, config.jwt.secret as string) as JWTPayload;
      req.user = decoded;
    } catch (error) {
      // Token is invalid, but we continue without user info
      // Could log this for security monitoring
    }
    
    next();
  } catch (error) {
    console.error('Error in optionalAuth middleware:', error);
    next(); // Continue even if there's an error
  }
};

/**
 * Banned User Guard
 * Ensures the authenticated user is not banned; use after authenticateToken
 */
export const ensureNotBanned = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    const dbUser = await databaseService.findUserById(user.userId);
    if (!dbUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if ((dbUser as any).isBanned) {
      return res.status(403).json({ success: false, message: 'Your account is banned. Please contact admin.' });
    }
    return next();
  } catch (err) {
    console.error('Error in ensureNotBanned middleware:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};