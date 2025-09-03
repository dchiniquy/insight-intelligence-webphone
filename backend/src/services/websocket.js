const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../config/logger');

const connectedClients = new Map();

const websocketHandler = (wss) => {
  logger.info('WebSocket server initialized');

  wss.on('connection', async (ws, req) => {
    try {
      // Extract token from query string or headers
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token') || req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        ws.close(1008, 'No authentication token provided');
        return;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);

      if (!user || !user.isActive) {
        ws.close(1008, 'Invalid authentication token');
        return;
      }

      // Store connection with user information
      const clientId = `${user._id}_${Date.now()}`;
      connectedClients.set(clientId, {
        ws,
        user,
        lastSeen: new Date()
      });

      logger.info(`WebSocket client connected: ${user.email} (${clientId})`);

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        data: {
          message: 'Connected to WebPhone service',
          userId: user._id,
          clientId
        }
      }));

      // Handle incoming messages
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await handleClientMessage(clientId, message);
        } catch (error) {
          logger.error('WebSocket message error:', error);
          ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Invalid message format' }
          }));
        }
      });

      // Handle client disconnect
      ws.on('close', (code, reason) => {
        connectedClients.delete(clientId);
        logger.info(`WebSocket client disconnected: ${user.email} (${clientId}) - Code: ${code}, Reason: ${reason}`);
      });

      // Handle connection errors
      ws.on('error', (error) => {
        logger.error(`WebSocket error for client ${clientId}:`, error);
        connectedClients.delete(clientId);
      });

      // Send ping periodically to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === ws.OPEN) {
          ws.ping();
          // Update last seen
          const client = connectedClients.get(clientId);
          if (client) {
            client.lastSeen = new Date();
          }
        } else {
          clearInterval(pingInterval);
        }
      }, 30000); // 30 seconds

    } catch (error) {
      logger.error('WebSocket connection error:', error);
      ws.close(1011, 'Internal server error');
    }
  });

  // Clean up stale connections every 5 minutes
  setInterval(() => {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
    
    for (const [clientId, client] of connectedClients.entries()) {
      if (client.lastSeen < cutoff || client.ws.readyState !== client.ws.OPEN) {
        logger.info(`Cleaning up stale WebSocket connection: ${clientId}`);
        client.ws.terminate();
        connectedClients.delete(clientId);
      }
    }
  }, 5 * 60 * 1000);
};

// Handle messages from clients
const handleClientMessage = async (clientId, message) => {
  const client = connectedClients.get(clientId);
  if (!client) return;

  const { ws, user } = client;

  logger.info(`WebSocket message from ${user.email}:`, message);

  switch (message.type) {
    case 'ping':
      ws.send(JSON.stringify({
        type: 'pong',
        data: { timestamp: new Date().toISOString() }
      }));
      break;

    case 'subscribe':
      // Subscribe to specific events (calls, messages, etc.)
      const { events } = message.data;
      if (events && Array.isArray(events)) {
        client.subscriptions = events;
        ws.send(JSON.stringify({
          type: 'subscribed',
          data: { events }
        }));
      }
      break;

    case 'get_status':
      // Send current connection status
      ws.send(JSON.stringify({
        type: 'status',
        data: {
          connected: true,
          userId: user._id,
          subscriptions: client.subscriptions || [],
          connectedAt: client.lastSeen
        }
      }));
      break;

    default:
      ws.send(JSON.stringify({
        type: 'error',
        data: { message: `Unknown message type: ${message.type}` }
      }));
  }
};

// Broadcast message to all connected clients for a specific user
const broadcastToUser = (userId, message) => {
  const userClients = Array.from(connectedClients.values())
    .filter(client => client.user._id.toString() === userId.toString());

  userClients.forEach(client => {
    if (client.ws.readyState === client.ws.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  });

  return userClients.length;
};

// Broadcast to all clients subscribed to a specific event
const broadcastToSubscribers = (eventType, message) => {
  let count = 0;
  
  for (const client of connectedClients.values()) {
    if (client.subscriptions && client.subscriptions.includes(eventType)) {
      if (client.ws.readyState === client.ws.OPEN) {
        client.ws.send(JSON.stringify(message));
        count++;
      }
    }
  }

  return count;
};

// Notify user of new call
const notifyNewCall = (userId, callData) => {
  const message = {
    type: 'new_call',
    data: callData
  };
  
  const clientsNotified = broadcastToUser(userId, message);
  logger.info(`Notified ${clientsNotified} clients of new call for user ${userId}`);
};

// Notify user of call status update
const notifyCallUpdate = (userId, callData) => {
  const message = {
    type: 'call_update',
    data: callData
  };
  
  const clientsNotified = broadcastToUser(userId, message);
  logger.info(`Notified ${clientsNotified} clients of call update for user ${userId}`);
};

// Notify user of new message
const notifyNewMessage = (userId, messageData) => {
  const message = {
    type: 'new_message',
    data: messageData
  };
  
  const clientsNotified = broadcastToUser(userId, message);
  logger.info(`Notified ${clientsNotified} clients of new message for user ${userId}`);
};

// Notify user of message status update
const notifyMessageUpdate = (userId, messageData) => {
  const message = {
    type: 'message_update',
    data: messageData
  };
  
  const clientsNotified = broadcastToUser(userId, message);
  logger.info(`Notified ${clientsNotified} clients of message update for user ${userId}`);
};

// Get connected clients count
const getConnectedClientsCount = () => {
  return connectedClients.size;
};

// Get connected users count
const getConnectedUsersCount = () => {
  const uniqueUsers = new Set();
  for (const client of connectedClients.values()) {
    uniqueUsers.add(client.user._id.toString());
  }
  return uniqueUsers.size;
};

module.exports = {
  websocketHandler,
  broadcastToUser,
  broadcastToSubscribers,
  notifyNewCall,
  notifyCallUpdate,
  notifyNewMessage,
  notifyMessageUpdate,
  getConnectedClientsCount,
  getConnectedUsersCount
};