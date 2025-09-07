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

const { connectDB, connectRedis } = require('./config/database');
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

async function startServer() {
  try {
    // Connect to databases
    await connectDB();
    const redisClient = await connectRedis();

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

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
    });
    app.use(limiter);

    // CORS configuration
    app.use(cors({
      origin: process.env.NODE_ENV === 'production' 
        ? [process.env.FRONTEND_URL] 
        : ['http://localhost:3000', 'http://localhost:3002', 'http://localhost'],
      credentials: true
    }));

    // Basic middleware
    app.use(compression());
    app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) }}));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Session configuration
    app.use(session({
      store: new RedisStore({ client: redisClient }),
      secret: process.env.SESSION_SECRET || 'dev-session-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    }));

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: require('../package.json').version
      });
    });

    // API routes
    app.use('/api/auth', authRoutes);
    app.use('/api/calls', callRoutes);
    app.use('/api/messages', messageRoutes);
    app.use('/api/users', userRoutes);
    
    // Webhook routes (no auth required)
    app.use('/webhooks', webhookRoutes);

    // Serve frontend static files in production
    if (process.env.NODE_ENV === 'production') {
      app.use(express.static('/app/public'));
      
      // Handle React Router - send all non-API routes to index.html
      app.get('*', (req, res) => {
        // Only serve index.html for non-API routes
        if (!req.path.startsWith('/api') && !req.path.startsWith('/webhooks')) {
          res.sendFile('/app/public/index.html');
        } else {
          res.status(404).json({ error: 'Route not found' });
        }
      });
    } else {
      // 404 handler for development
      app.use('*', (req, res) => {
        res.status(404).json({ error: 'Route not found' });
      });
    }

    // Error handling middleware
    app.use(errorHandler);

    // WebSocket handler
    websocketHandler(wss);

    // Start server
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received. Shutting down gracefully...');
      server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();