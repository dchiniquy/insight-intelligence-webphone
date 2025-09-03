const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Call = require('../models/Call');
const twilioService = require('../services/twilio');
const auth = require('../middleware/auth');
const logger = require('../config/logger');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

// Get all calls for the authenticated user
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('twilioNumber').optional().isIn(['don', 'demie', 'business']),
  query('direction').optional().isIn(['inbound', 'outbound']),
  query('status').optional(),
  query('search').optional().isLength({ max: 100 })
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
    
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    if (req.query.search) {
      query.$or = [
        { from: { $regex: req.query.search, $options: 'i' } },
        { to: { $regex: req.query.search, $options: 'i' } },
        { callerName: { $regex: req.query.search, $options: 'i' } },
        { notes: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const calls = await Call.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await Call.countDocuments(query);

    res.json({
      success: true,
      data: {
        calls,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('Get calls error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error getting calls'
    });
  }
});

// Get call statistics
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

    const stats = await Call.getCallStats(
      req.user._id,
      req.query.twilioNumber,
      dateRange
    );

    res.json({
      success: true,
      data: stats[0] || {
        totalCalls: 0,
        inboundCalls: 0,
        outboundCalls: 0,
        answeredCalls: 0,
        missedCalls: 0,
        totalDuration: 0,
        totalCost: 0
      }
    });

  } catch (error) {
    logger.error('Get call stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error getting call statistics'
    });
  }
});

// Get a specific call
router.get('/:id', async (req, res) => {
  try {
    const call = await Call.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!call) {
      return res.status(404).json({
        success: false,
        error: 'Call not found'
      });
    }

    res.json({
      success: true,
      data: { call }
    });

  } catch (error) {
    logger.error('Get call error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error getting call'
    });
  }
});

// Make a new call
router.post('/', [
  body('to').isMobilePhone().withMessage('Valid phone number required'),
  body('twilioNumber').isIn(['don', 'demie', 'business']),
  body('message').optional().isLength({ max: 500 })
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

    const { to, twilioNumber, message } = req.body;

    // Get the Twilio phone number for this configuration
    const fromNumber = twilioService.getPhoneNumber(twilioNumber);
    if (!fromNumber) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Twilio number configuration'
      });
    }

    // Generate TwiML URL for the call
    const baseUrl = process.env.BASE_URL || `http://${req.get('host')}`;
    const twimlUrl = `${baseUrl}/webhooks/voice/${twilioNumber}`;
    const statusCallback = `${baseUrl}/webhooks/status/${twilioNumber}`;

    // Make the call via Twilio
    const twilioCall = await twilioService.makeCall({
      to,
      from: fromNumber,
      url: twimlUrl,
      statusCallback
    });

    // Save call to database
    const call = new Call({
      callSid: twilioCall.sid,
      userId: req.user._id,
      twilioNumber,
      from: fromNumber,
      to,
      direction: 'outbound',
      status: 'initiated'
    });

    await call.save();

    logger.info(`Call initiated by user ${req.user._id}: ${twilioCall.sid}`);

    res.status(201).json({
      success: true,
      data: { call }
    });

  } catch (error) {
    logger.error('Make call error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error making call'
    });
  }
});

// Update call (add notes, tags, etc.)
router.put('/:id', [
  body('notes').optional().isLength({ max: 1000 }),
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

    const call = await Call.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      updateData,
      { new: true }
    );

    if (!call) {
      return res.status(404).json({
        success: false,
        error: 'Call not found'
      });
    }

    res.json({
      success: true,
      data: { call }
    });

  } catch (error) {
    logger.error('Update call error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error updating call'
    });
  }
});

// Delete call record
router.delete('/:id', async (req, res) => {
  try {
    const call = await Call.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!call) {
      return res.status(404).json({
        success: false,
        error: 'Call not found'
      });
    }

    res.json({
      success: true,
      message: 'Call deleted successfully'
    });

  } catch (error) {
    logger.error('Delete call error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error deleting call'
    });
  }
});

module.exports = router;