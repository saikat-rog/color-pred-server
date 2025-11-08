import { Router } from 'express';
import { PaymentController } from '../controllers/paymentController';
import { authenticateToken } from '../middleware/auth';
import { config } from '../config';

const paymentController = new PaymentController();

const router = Router();

/**
 * @route   POST /api/payment/recharge
 * @desc    Add recharge to user account
 * @access  Private
 * @headers Authorization: Bearer <token>
 * @body    { amount: number, transactionId?: string, description?: string }
 */
router.post('/recharge', authenticateToken, paymentController.initiateRecharge.bind(paymentController));

/**
 * @route   POST /api/payment/callback
 * @desc    Handle payment gateway callbacks
 * @access  Public
 * @body    { merchantOrder: string, status: string, amount: number, createdAt: string, updatedAt: string }
 */
router.post('/callback', paymentController.paymentCallback.bind(paymentController));

router.get('/callback', (req, res) => {
	// Redirect GET requests (human/browser) to the info page
	return res.redirect(config.frontend.baseUrl);
});

export { router as paymentRoutes };
