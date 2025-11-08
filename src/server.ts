import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/user';
import { gameRoutes } from './routes/game';
import { databaseService } from './services/databaseService';
import { adminRoutes } from './routes/admin';
import { gameService } from './services/gameService';
import { paymentRoutes } from './routes/payment';

// Initialize Express app
const app: Express = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.nodeEnv === 'production' 
    ? [config.frontend.baseUrl]
    : true, // Allow all origins in development
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Color Game API Ready!',
    status: 'active',
    version: '1.0.0',
    environment: config.nodeEnv,
    // endpoints: {
    //   signup: 'POST /api/auth/signup/initiate',
    //   completeSignup: 'POST /api/auth/signup/complete',
    //   login: 'POST /api/auth/login',
    //   refreshToken: 'POST /api/auth/refresh-token',
    //   logout: 'POST /api/auth/logout',
    //   passwordResetInitiate: 'POST /api/auth/password-reset/initiate',
    //   passwordResetComplete: 'POST /api/auth/password-reset/complete',
    //   profile: 'GET /api/auth/profile',
    //   verifyToken: 'GET /api/auth/verify-token',
    //   updateProfile: 'PUT /api/user/profile',
    //   getBankAccounts: 'GET /api/user/bank-accounts',
    //   addBankAccount: 'POST /api/user/bank-accounts',
    //   updateBankAccount: 'PUT /api/user/bank-accounts/:id',
    //   deleteBankAccount: 'DELETE /api/user/bank-accounts/:id',
    //   submitWithdrawal: 'POST /api/user/withdrawal-requests',
    //   getWithdrawals: 'GET /api/user/withdrawal-requests',
    //   cancelWithdrawal: 'DELETE /api/user/withdrawal-requests/:id',
    //   getTransactions: 'GET /api/user/transactions',
    //   getCurrentPeriod: 'GET /api/game/period/current',
    //   placeBet: 'POST /api/game/bet',
    //   getUserBets: 'GET /api/game/bet/current',
    //   getBetHistory: 'GET /api/game/bet/history',
    //   getPeriodHistory: 'GET /api/game/period/history',
    //   getGameSettings: 'GET /api/game/settings',
    //   updateGameSettings: 'PUT /api/game/settings',
    //   // callbackURL: 'POST /api/payment/callback',
    //   addRecharge: 'POST /api/payment/recharge',
    //   // Admin endpoints
    //   adminLogin: 'POST /api/admin/login',
    //   adminUsers: 'GET /api/admin/users',
    //   adminUserDetail: 'GET /api/admin/user/:id',
    //   adminBanUser: 'PUT /api/admin/user/:id/ban',
    //   adminUserSummary: 'GET /api/admin/user/:id/summary',
    //   adminDashboard: 'GET /api/admin/dashboard',
    //   adminPeriods: 'GET /api/admin/periods',
    //   adminGetSettings: 'GET /api/admin/settings',
    //   adminUpdateSettings: 'PUT /api/admin/settings'
    // }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Sorry, the requested resource was not found please try again.',
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Start server
const PORT: number = config.port;

// Initialize database and start server
async function startServer() {
  try {
    // Connect to database
    await databaseService.connect();
    
    // Initialize game service
    await gameService.initialize();

    const server = app.listen(PORT, '0.0.0.0:8080');

    server.on('listening', () => {
      console.log(`Color game Server running on port ${PORT} (bound to 0.0.0.0)`);
      console.log(`🌍 Environment: ${config.nodeEnv}`);
    });

    server.on('error', (err: any) => {
      console.error('Server failed to bind:', err);
      // Exit so the platform can restart the process if desired
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔄 Shutting down gracefully...');
  gameService.cleanup();
  await databaseService.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🔄 Shutting down gracefully...');
  gameService.cleanup();
  await databaseService.disconnect();
  process.exit(0);
});

startServer();