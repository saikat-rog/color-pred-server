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
import { bowGameService } from './services/bowGameService';
import { thirtySecondGameService } from './services/thirtySecondGameService';
import { paymentRoutes } from './routes/payment';
import { bowGameRoutes } from './routes/bowGame';
import { thirtySecondGameRoutes } from './routes/thirtySecondGame';

// Initialize Express app
const app: Express = express();

app.set('trust proxy', 1); // Trust first proxy

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
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/bow-game', bowGameRoutes);
app.use('/api/thirty-second-game', thirtySecondGameRoutes);
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

    // Initialize BOW game service
    await bowGameService.initialize();

    // Initialize Thirty Second game service
    await thirtySecondGameService.initialize();

    const server = app.listen(PORT, '0.0.0.0');

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
  bowGameService.cleanup();
  thirtySecondGameService.cleanup();
  await databaseService.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🔄 Shutting down gracefully...');
  gameService.cleanup();
  bowGameService.cleanup();
  thirtySecondGameService.cleanup();
  await databaseService.disconnect();
  process.exit(0);
});

startServer();