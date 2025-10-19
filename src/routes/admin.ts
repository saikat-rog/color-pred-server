import { Router } from 'express';
import { adminController } from '../controllers/adminController';
import { authenticateAdmin } from '../middleware/adminAuth';

const router = Router();

// Public admin route (login)
router.post('/login', adminController.login.bind(adminController));

// Protected admin routes
router.use(authenticateAdmin);

// Users
router.get('/users', adminController.listUsers.bind(adminController));
// Get users by date or range
router.get('/users/by-date', adminController.getUsersByDate.bind(adminController));
router.get('/user/:id', adminController.getUser.bind(adminController));
router.put('/user/:id/ban', adminController.banUser.bind(adminController));
router.get('/user/:id/summary', adminController.userSummary.bind(adminController));
router.get('/user/:id/transactions', adminController.getUserTransactions.bind(adminController));
router.get('/user/:id/withdrawals', adminController.getUserWithdrawals.bind(adminController));
router.get('/user/:id/bets', adminController.getUserBets.bind(adminController));

// Dashboard
router.get('/dashboard', adminController.dashboard.bind(adminController));
router.get('/periods', adminController.listPeriods.bind(adminController));

// Settings
router.get('/settings', adminController.getSettings.bind(adminController));
router.put('/settings', adminController.updateSettings.bind(adminController));

export { router as adminRoutes };
