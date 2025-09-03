const mongoose = require('mongoose');
const Redis = require('redis');
const logger = require('./logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
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
    process.exit(1);
  }
};

const connectRedis = async () => {
  try {
    const client = Redis.createClient({
      url: process.env.REDIS_URL
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
    process.exit(1);
  }
};

module.exports = {
  connectDB,
  connectRedis
};