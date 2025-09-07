const mongoose = require('mongoose');
const Redis = require('redis');
const logger = require('./logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // 5 seconds instead of 30
      connectTimeoutMS: 5000,
      socketTimeoutMS: 5000,
      maxPoolSize: 10, // Maintain up to 10 socket connections
      minPoolSize: 1,  // Maintain at least 1 socket connection
      bufferCommands: false, // Disable buffer commands
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error; // Don't exit, let caller handle
  }
};

const connectRedis = async () => {
  try {
    const client = Redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 5000,
        lazyConnect: true,
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            return false; // Stop retrying after 3 attempts
          }
          return Math.min(retries * 50, 1000); // Exponential backoff
        }
      }
    });

    client.on('error', (err) => {
      logger.error('Redis connection error:', err);
    });

    client.on('connect', () => {
      logger.info('Redis connected');
    });

    client.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });

    client.on('ready', () => {
      logger.info('Redis ready');
    });

    await client.connect();
    return client;

  } catch (error) {
    logger.error('Redis connection failed:', error);
    throw error; // Don't exit, let caller handle
  }
};

module.exports = {
  connectDB,
  connectRedis
};