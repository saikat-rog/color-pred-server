import { Router } from 'express';
import { userController } from '../controllers/userController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All user routes require authentication
router.use(authenticateToken);

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

export { router as userRoutes };