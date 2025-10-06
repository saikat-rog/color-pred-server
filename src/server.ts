import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { authRoutes } from './routes/auth';
import { databaseService } from './services/databaseService';

// Initialize Express app
const app: Express = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.nodeEnv === 'production' 
    ? ['https://yourdomain.com'] // Replace with your frontend domain in production
    : true, // Allow all origins in development
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Color Prediction API - Authentication Ready! 🎮',
    status: 'active',
    version: '1.0.0',
    environment: config.nodeEnv,
    endpoints: {
      signup: 'POST /api/auth/signup/initiate',
      completeSignup: 'POST /api/auth/signup/complete',
      login: 'POST /api/auth/login',
      refreshToken: 'POST /api/auth/refresh-token',
      logout: 'POST /api/auth/logout',
      profile: 'GET /api/auth/profile',
      verifyToken: 'GET /api/auth/verify-token'
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
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
    
    app.listen(PORT, () => {
      console.log(`🚀 Color Prediction Server running on port ${PORT}`);
      console.log(`🔐 Authentication system ready!`);
      console.log(`🗄️ PostgreSQL database connected!`);
      console.log(`🌍 Environment: ${config.nodeEnv}`);
      console.log(`📋 API Documentation: http://localhost:${PORT}/`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔄 Shutting down gracefully...');
  await databaseService.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🔄 Shutting down gracefully...');
  await databaseService.disconnect();
  process.exit(0);
});

startServer();