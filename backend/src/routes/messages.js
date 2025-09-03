const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Message = require('../models/Message');
const twilioService = require('../services/twilio');
const auth = require('../middleware/auth');
const logger = require('../config/logger');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

// Get all messages/conversations for the authenticated user
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('twilioNumber').optional().isIn(['don', 'demie', 'business']),
  query('direction').optional().isIn(['inbound', 'outbound']),
  query('search').optional().isLength({ max: 100 }),
  query('unreadOnly').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build query
    const query = { userId: req.user._id };
    
    if (req.query.twilioNumber) {
      query.twilioNumber = req.query.twilioNumber;
    }
    
    if (req.query.direction) {
      query.direction = req.query.direction;
    }
    
    if (req.query.unreadOnly === 'true') {
      query['thread.isRead'] = false;
    }
    
    if (req.query.search) {
      query.$or = [
        { from: { $regex: req.query.search, $options: 'i' } },
        { to: { $regex: req.query.search, $options: 'i' } },
        { body: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await Message.countDocuments(query);

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error getting messages'
    });
  }
});

// Get message threads (conversations)
router.get('/threads', [
  query('twilioNumber').optional().isIn(['don', 'demie', 'business']),
  query('limit').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const limit = parseInt(req.query.limit) || 20;
    
    const threads = await Message.getThreads(
      req.user._id,
      req.query.twilioNumber,
      limit
    );

    res.json({
      success: true,
      data: { threads }
    });

  } catch (error) {
    logger.error('Get message threads error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error getting message threads'
    });
  }
});

// Get conversation with specific number
router.get('/conversation/:twilioNumber/:otherNumber', [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { twilioNumber, otherNumber } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const conversation = await Message.getConversation(
      req.user._id,
      twilioNumber,
      otherNumber,
      limit,
      offset
    );

    res.json({
      success: true,
      data: { conversation }
    });

  } catch (error) {
    logger.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error getting conversation'
    });
  }
});

// Get message statistics
router.get('/stats', [
  query('twilioNumber').optional().isIn(['don', 'demie', 'business']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const dateRange = {};
    if (req.query.startDate) dateRange.start = req.query.startDate;
    if (req.query.endDate) dateRange.end = req.query.endDate;

    const stats = await Message.getMessageStats(
      req.user._id,
      req.query.twilioNumber,
      dateRange
    );

    res.json({
      success: true,
      data: stats[0] || {
        totalMessages: 0,
        inboundMessages: 0,
        outboundMessages: 0,
        deliveredMessages: 0,
        failedMessages: 0,
        totalSegments: 0,
        totalCost: 0,
        mediaMessages: 0
      }
    });

  } catch (error) {
    logger.error('Get message stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error getting message statistics'
    });
  }
});

// Get a specific message
router.get('/:id', async (req, res) => {
  try {
    const message = await Message.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    res.json({
      success: true,
      data: { message }
    });

  } catch (error) {
    logger.error('Get message error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error getting message'
    });
  }
});

// Send a new message
router.post('/', [
  body('to').isMobilePhone().withMessage('Valid phone number required'),
  body('twilioNumber').isIn(['don', 'demie', 'business']),
  body('body').isLength({ min: 1, max: 1600 }).withMessage('Message body required (max 1600 chars)'),
  body('mediaUrl').optional().isArray(),
  body('scheduledAt').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { to, twilioNumber, body, mediaUrl, scheduledAt } = req.body;

    // Get the Twilio phone number for this configuration
    const fromNumber = twilioService.getPhoneNumber(twilioNumber);
    if (!fromNumber) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Twilio number configuration'
      });
    }

    // If scheduled for later, save to database without sending
    if (scheduledAt && new Date(scheduledAt) > new Date()) {
      const message = new Message({
        userId: req.user._id,
        twilioNumber,
        from: fromNumber,
        to,
        direction: 'outbound',
        body,
        status: 'scheduled',
        scheduledAt: new Date(scheduledAt),
        media: mediaUrl ? mediaUrl.map(url => ({ url, contentType: 'image/jpeg' })) : []
      });

      await message.save();

      return res.status(201).json({
        success: true,
        data: { message }
      });
    }

    // Send message via Twilio
    const twilioMessage = await twilioService.sendMessage({
      to,
      from: fromNumber,
      body,
      mediaUrl
    });

    // Save message to database
    const message = new Message({
      messageSid: twilioMessage.sid,
      userId: req.user._id,
      twilioNumber,
      from: fromNumber,
      to,
      direction: 'outbound',
      body,
      status: 'queued',
      numSegments: twilioMessage.numSegments || 1,
      media: mediaUrl ? mediaUrl.map(url => ({ url, contentType: 'image/jpeg' })) : []
    });

    await message.save();

    logger.info(`Message sent by user ${req.user._id}: ${twilioMessage.sid}`);

    res.status(201).json({
      success: true,
      data: { message }
    });

  } catch (error) {
    logger.error('Send message error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error sending message'
    });
  }
});

// Mark message as read
router.put('/:id/read', async (req, res) => {
  try {
    const message = await Message.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    await message.markAsRead();

    res.json({
      success: true,
      data: { message }
    });

  } catch (error) {
    logger.error('Mark message as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error marking message as read'
    });
  }
});

// Mark all messages in thread as read
router.put('/thread/:threadId/read', async (req, res) => {
  try {
    const result = await Message.updateMany(
      { 
        userId: req.user._id,
        'thread.threadId': req.params.threadId,
        'thread.isRead': false
      },
      { 
        'thread.isRead': true 
      }
    );

    res.json({
      success: true,
      data: { 
        modifiedCount: result.modifiedCount 
      }
    });

  } catch (error) {
    logger.error('Mark thread as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error marking thread as read'
    });
  }
});

// Update message (add notes, tags)
router.put('/:id', [
  body('notes').optional().isLength({ max: 500 }),
  body('tags').optional().isArray(),
  body('tags.*').optional().isLength({ max: 50 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { notes, tags } = req.body;
    const updateData = {};
    
    if (notes !== undefined) updateData.notes = notes;
    if (tags !== undefined) updateData.tags = tags;

    const message = await Message.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      updateData,
      { new: true }
    );

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    res.json({
      success: true,
      data: { message }
    });

  } catch (error) {
    logger.error('Update message error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error updating message'
    });
  }
});

// Delete message
router.delete('/:id', async (req, res) => {
  try {
    const message = await Message.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });

  } catch (error) {
    logger.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error deleting message'
    });
  }
});

module.exports = router;