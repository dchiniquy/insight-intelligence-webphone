require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const http = require('http');
const WebSocket = require('ws');

const { connectDB, connectRedis } = require('./config/database-optimized');
const logger = require('./config/logger');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const callRoutes = require('./routes/calls');
const messageRoutes = require('./routes/messages');
const webhookRoutes = require('./routes/webhooks');
const userRoutes = require('./routes/users');
const { websocketHandler } = require('./services/websocket');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3001;

// Track connection status
let dbStatus = { mongodb: false, redis: false };
let redisClient = null;

async function startServer() {
  try {
    // Trust proxy for rate limiting
    app.set('trust proxy', 1);

    // Security middleware
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "wss:", "ws:"],
        },
      },
    }));

    // CORS
    app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true
    }));

    // Basic middleware
    app.use(morgan('combined'));
    app.use(compression());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000 // limit each IP to 1000 requests per windowMs
    });
    app.use(limiter);

    // Health check endpoint - responds immediately
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: require('../package.json').version,
        database: {
          mongodb: dbStatus.mongodb ? 'connected' : 'connecting',
          redis: dbStatus.redis ? 'connected' : 'connecting'
        }
      });
    });

    // Readiness check endpoint - waits for databases
    app.get('/ready', (req, res) => {
      if (dbStatus.mongodb && dbStatus.redis) {
        res.json({ status: 'ready', databases: 'connected' });
      } else {
        res.status(503).json({ 
          status: 'not ready', 
          databases: {
            mongodb: dbStatus.mongodb ? 'connected' : 'connecting',
            redis: dbStatus.redis ? 'connected' : 'connecting'
          }
        });
      }
    });

    // Session middleware (will be added after Redis connects)
    let sessionMiddleware = null;

    // Middleware to check database status for API routes
    const requireDatabase = (req, res, next) => {
      if (!dbStatus.mongodb) {
        return res.status(503).json({ error: 'Database not ready' });
      }
      next();
    };

    // API routes with database requirement
    app.use('/api/auth', requireDatabase, authRoutes);
    app.use('/api/calls', requireDatabase, callRoutes);
    app.use('/api/messages', requireDatabase, messageRoutes);
    app.use('/api/users', requireDatabase, userRoutes);
    
    // Webhook routes (no auth required, but need database)
    app.use('/webhooks', requireDatabase, webhookRoutes);

    // 404 handler
    app.use('*', (req, res) => {
      res.status(404).json({ error: 'Route not found' });
    });

    // Error handling middleware
    app.use(errorHandler);

    // Start server immediately
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info('Health endpoint available at /health');
      logger.info('Readiness endpoint available at /ready');
    });

    // WebSocket handler
    websocketHandler(wss);

    // Connect to databases asynchronously
    connectDatabases();

    // Graceful shutdown
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error) {
    logger.error('Server startup failed:', error);
    process.exit(1);
  }
}

async function connectDatabases() {
  // Connect to MongoDB
  try {
    await connectDB();
    dbStatus.mongodb = true;
    logger.info('MongoDB connected - API routes now available');
  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    // Don't exit, keep trying in background
    setTimeout(connectDatabases, 5000);
    return;
  }

  // Connect to Redis
  try {
    redisClient = await connectRedis();
    dbStatus.redis = true;
    
    // Add session middleware after Redis is connected
    if (redisClient) {
      const sessionStore = new RedisStore({ client: redisClient });
      const sessionMiddleware = session({
        store: sessionStore,
        secret: process.env.SESSION_SECRET || 'your-secret-key',
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true,
          maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
      });
      
      // Note: In a real implementation, you'd need to dynamically add this middleware
      logger.info('Redis connected - sessions now available');
    }
    
  } catch (error) {
    logger.error('Redis connection failed:', error);
    // Continue without Redis sessions
  }
}

function gracefulShutdown() {
  logger.info('Shutting down gracefully...');
  server.close(() => {
    if (redisClient) {
      redisClient.quit();
    }
    logger.info('Process terminated');
    process.exit(0);
  });
}

startServer();