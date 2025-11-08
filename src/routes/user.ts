import { Router } from 'express';
import { userController } from '../controllers/userController';
import { getReferralInfo, getReferralEarnings } from '../controllers/gameController';
import { authenticateToken, ensureNotBanned } from '../middleware/auth';

const router = Router();


// All user routes require authentication
router.use(authenticateToken, ensureNotBanned);

// Referral routes
/**
 * @route   GET /api/user/referral/info
 * @desc    Get user's referral information
 * @access  Private
 * @headers Authorization: Bearer <token>
 */
router.get('/referral/info', getReferralInfo);

/**
 * @route   GET /api/user/referral/earnings
 * @desc    Get user's referral earnings
 * @access  Private
 * @headers Authorization: Bearer <token>
 * @query   limit (optional, default: 50)
 */
router.get('/referral/earnings', getReferralEarnings);

/**
 * @route   PUT /api/user/profile
 * @desc    Update user profile
 * @access  Private
 * @headers Authorization: Bearer <token>
 * @body    User profile data (excluding phoneNumber)
 */
router.put('/profile', userController.updateProfile.bind(userController));

// Bank Account Management Routes

/**
 * @route   GET /api/user/bank-accounts
 * @desc    Get user's bank accounts
 * @access  Private
 * @headers Authorization: Bearer <token>
 */
router.get('/bank-accounts', userController.getBankAccounts.bind(userController));

/**
 * @route   POST /api/user/bank-accounts
 * @desc    Add new bank account
 * @access  Private
 * @headers Authorization: Bearer <token>
 * @body    { accountNumber, accountName, ifscCode, upiId?, isDefault? }
 */
router.post('/bank-accounts', userController.addBankAccount.bind(userController));

/**
 * @route   PUT /api/user/bank-accounts/:id
 * @desc    Update bank account
 * @access  Private
 * @headers Authorization: Bearer <token>
 * @param   id - Bank account ID
 * @body    { accountNumber?, accountName?, ifscCode?, upiId?, isDefault? }
 */
router.put('/bank-accounts/:id', userController.updateBankAccount.bind(userController));

/**
 * @route   DELETE /api/user/bank-accounts/:id
 * @desc    Delete bank account
 * @access  Private
 * @headers Authorization: Bearer <token>
 * @param   id - Bank account ID
 */
router.delete('/bank-accounts/:id', userController.deleteBankAccount.bind(userController));

// Withdrawal Request Management Routes

/**
 * @route   POST /api/user/withdrawal-requests
 * @desc    Submit withdrawal request
 * @access  Private
 * @headers Authorization: Bearer <token>
 * @body    { bankAccountId: number, amount: number }
 */
router.post('/withdrawal-requests', userController.submitWithdrawalRequest.bind(userController));

/**
 * @route   GET /api/user/withdrawal-requests
 * @desc    Get user's withdrawal requests
 * @access  Private
 * @headers Authorization: Bearer <token>
 */
router.get('/withdrawal-requests', userController.getWithdrawalRequests.bind(userController));

/**
 * @route   DELETE /api/user/withdrawal-requests/:id
 * @desc    Cancel withdrawal request (only if pending)
 * @access  Private
 * @headers Authorization: Bearer <token>
 * @param   id - Withdrawal request ID
 */
router.delete('/withdrawal-requests/:id', userController.cancelWithdrawalRequest.bind(userController));

// Transaction Management Routes

/**
 * @route   GET /api/user/transactions
 * @desc    Get user's transaction history
 * @access  Private
 * @headers Authorization: Bearer <token>
 * @query   limit (optional, default: 50), offset (optional, default: 0)
 */
router.get('/transactions', userController.getTransactions.bind(userController));

export { router as userRoutes };