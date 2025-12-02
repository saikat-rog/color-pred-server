import { Router } from 'express';
import { authenticateToken, ensureNotBanned } from '../middleware/auth';
import * as bowGameController from '../controllers/bowGameController';

const router = Router();

/**
 * @route   GET /api/bow-game/period/current
 * @desc    Get current BOW game period
 * @access  Public
 */
router.get('/period/current', bowGameController.getCurrentPeriod);

/**
 * @route   POST /api/bow-game/bet
 * @desc    Place a bet in BOW game
 * @access  Private
 */
router.post('/bet', authenticateToken, ensureNotBanned, bowGameController.placeBet);

/**
 * @route   GET /api/bow-game/bet/current
 * @desc    Get user's bets for current period
 * @access  Private
 */
router.get('/bet/current', authenticateToken, ensureNotBanned, bowGameController.getUserBetsForCurrentPeriod);

/**
 * @route   GET /api/bow-game/bet/history
 * @desc    Get user's bet history
 * @access  Private
 */
router.get('/bet/history', authenticateToken, ensureNotBanned, bowGameController.getUserBetHistory);

/**
 * @route   GET /api/bow-game/period/history
 * @desc    Get period history
 * @access  Public
 */
router.get('/period/history', bowGameController.getPeriodHistory);

/**
 * @route   GET /api/bow-game/settings
 * @desc    Get BOW game settings
 * @access  Public
 */
router.get('/settings', bowGameController.getGameSettings);

export { router as bowGameRoutes };
