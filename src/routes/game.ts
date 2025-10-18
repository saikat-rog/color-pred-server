import { Router } from 'express';
import {
  getCurrentPeriod,
  placeBet,
  getUserBetsForCurrentPeriod,
  getUserBetHistory,
  getPeriodHistory,
  getGameSettings,
  updateGameSettings,
  getReferralInfo,
  getReferralEarnings,
} from '../controllers/gameController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/period/current', getCurrentPeriod);
router.get('/period/history', getPeriodHistory);
router.get('/settings', getGameSettings);

// Protected routes (require authentication)
router.post('/bet', authenticateToken, placeBet);
router.get('/bet/current', authenticateToken, getUserBetsForCurrentPeriod);
router.get('/bet/history', authenticateToken, getUserBetHistory);

// Admin routes (you can add admin middleware later)
router.put('/settings', authenticateToken, updateGameSettings);

export { router as gameRoutes };
