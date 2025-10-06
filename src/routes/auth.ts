import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import { config } from '../config';

const router = Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs, // 15 minutes
  max: config.rateLimit.maxRequests, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// More strict rate limiting for OTP requests
const otpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Limit each IP to 2 OTP requests per minute
  message: {
    success: false,
    message: 'Too many OTP requests. Please wait before requesting again.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public routes (no authentication required)

/**
 * @route   POST /api/auth/signup/initiate
 * @desc    Initiate signup process by sending OTP
 * @access  Public
 * @body    { phoneNumber: string }
 */
router.post('/signup/initiate', otpLimiter, authController.initiateSignup.bind(authController));

/**
 * @route   POST /api/auth/signup/complete
 * @desc    Complete signup by verifying OTP and setting password
 * @access  Public
 * @body    { phoneNumber: string, otp: string, password: string }
 */
router.post('/signup/complete', authLimiter, authController.completeSignup.bind(authController));

/**
 * @route   POST /api/auth/login
 * @desc    Login user with phone number and password
 * @access  Public
 * @body    { phoneNumber: string, password: string }
 */
router.post('/login', authLimiter, authController.login.bind(authController));

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh access token using refresh token
 * @access  Public
 * @body    { refreshToken: string }
 */
router.post('/refresh-token', authLimiter, authController.refreshToken.bind(authController));

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and invalidate refresh token
 * @access  Public
 * @body    { refreshToken: string }
 */
router.post('/logout', authController.logout.bind(authController));

// Protected routes (authentication required)

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 * @headers Authorization: Bearer <token>
 */
router.get('/profile', authenticateToken, authController.getProfile.bind(authController));

/**
 * @route   GET /api/auth/verify-token
 * @desc    Verify if current token is valid
 * @access  Private
 * @headers Authorization: Bearer <token>
 */
router.get('/verify-token', authenticateToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Token is valid',
    data: {
      user: req.user
    }
  });
});

export { router as authRoutes };