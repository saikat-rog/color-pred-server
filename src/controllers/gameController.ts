import { Request, Response } from 'express';
import { gameService } from '../services/gameService';
import type { Color } from '@prisma/client';


/**
 * Get current game period information
 */
export const getCurrentPeriod = async (req: Request, res: Response): Promise<any> => {
  try {
    const period = await gameService.getCurrentPeriod();
    
    if (!period) {
      return res.status(404).json({
        success: false,
        message: 'No active period found',
      });
    }

    res.json({
      success: true,
      data: period,
    });
  } catch (error: any) {
    console.error('Error fetching current period:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch current period',
      error: error.message,
    });
  }
};

/**
 * Place a bet
 */
export const placeBet = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.user?.userId;
    const { color, amount } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    // Validate input
    if (!color || !['green', 'purple', 'red'].includes(color.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid color. Must be green, purple, or red',
      });
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount. Must be a positive number',
      });
    }

    const bet = await gameService.placeBet(
      userId,
      color.toLowerCase() as Color,
      amount
    );

    res.json({
      success: true,
      message: 'Bet placed successfully',
      data: bet,
    });
  } catch (error: any) {
    console.error('Error placing bet:', error);
    
    // Handle specific errors
    if (error.message.includes('Betting is closed') ||
        error.message.includes('Betting time has ended') ||
        error.message.includes('Insufficient balance') ||
        error.message.includes('Minimum bet') ||
        error.message.includes('Maximum bet')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to place bet',
      error: error.message,
    });
  }
};

/**
 * Get user's bets for current period
 */
export const getUserBetsForCurrentPeriod = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }
    
    const currentPeriod = await gameService.getCurrentPeriod();
    if (!currentPeriod) {
      return res.status(404).json({
        success: false,
        message: 'No active period found',
      });
    }

    const bets = await gameService.getUserBetsForPeriod(userId, currentPeriod.periodId);

    res.json({
      success: true,
      data: bets,
    });
  } catch (error: any) {
    console.error('Error fetching user bets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user bets',
      error: error.message,
    });
  }
};

/**
 * Get user's bet history
 */
export const getUserBetHistory = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.user?.userId;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const bets = await gameService.getUserBetHistory(userId, limit);

    res.json({
      success: true,
      data: bets,
    });
  } catch (error: any) {
    console.error('Error fetching bet history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bet history',
      error: error.message,
    });
  }
};

/**
 * Get period history
 */
export const getPeriodHistory = async (req: Request, res: Response): Promise<any> => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    const periods = await gameService.getPeriodHistory(limit);

    res.json({
      success: true,
      data: periods,
    });
  } catch (error: any) {
    console.error('Error fetching period history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch period history',
      error: error.message,
    });
  }
};

/**
 * Get game settings
 */
export const getGameSettings = async (req: Request, res: Response): Promise<any> => {
  try {
    const settings = await gameService.getGameSettings();

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Game settings not found',
      });
    }

    res.json({
      success: true,
      data: settings,
    });
  } catch (error: any) {
    console.error('Error fetching game settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch game settings',
      error: error.message,
    });
  }
};

/**
 * Get user's referral information
 */
export const getReferralInfo = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.userId;

    const referralInfo = await gameService.getReferralInfo(userId);

    res.json({
      success: true,
      data: referralInfo,
    });
  } catch (error: any) {
    console.error('Error fetching referral info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch referral information',
      error: error.message,
    });
  }
};

/**
 * Get user's referral earnings
 */
export const getReferralEarnings = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.userId;
    const limit = parseInt(req.query.limit as string) || 50;

    const earnings = await gameService.getReferralEarnings(userId, limit);

    res.json({
      success: true,
      data: earnings,
    });
  } catch (error: any) {
    console.error('Error fetching referral earnings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch referral earnings',
      error: error.message,
    });
  }
};
