import { Router } from 'express';
import {
  getCurrentPeriod,
  placeBet,
  getUserBetsForCurrentPeriod,
  getUserBetHistory,
  getPeriodHistory,
  getGameSettings,
} from '../controllers/gameController';
import { authenticateToken, ensureNotBanned } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/period/current', getCurrentPeriod);
router.get('/period/history', getPeriodHistory);
router.get('/settings', getGameSettings);

// Protected routes (require authentication)
router.post('/bet', authenticateToken, ensureNotBanned, placeBet);
router.get('/bet/current', authenticateToken, ensureNotBanned, getUserBetsForCurrentPeriod);
router.get('/bet/history', authenticateToken, ensureNotBanned, getUserBetHistory);

export { router as gameRoutes };
