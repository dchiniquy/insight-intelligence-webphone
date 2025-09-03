const express = require('express');
const twilioService = require('../services/twilio');
const Call = require('../models/Call');
const Message = require('../models/Message');
const User = require('../models/User');
const logger = require('../config/logger');

const router = express.Router();

// Middleware to validate Twilio webhook signature
const validateTwilioSignature = (req, res, next) => {
  const signature = req.get('X-Twilio-Signature');
  const url = `${req.protocol}://${req.get('Host')}${req.originalUrl}`;
  
  if (process.env.NODE_ENV !== 'development') {
    if (!twilioService.validateWebhook(signature, url, req.body)) {
      logger.warn('Invalid Twilio webhook signature', { url, signature });
      return res.status(403).json({ error: 'Invalid signature' });
    }
  }
  
  next();
};

// Helper function to find user by Twilio number
async function findUserByTwilioNumber(twilioNumberKey) {
  // For now, return the first admin user
  // In a real app, you'd have proper user-number associations
  const user = await User.findOne({ role: 'admin' });
  return user;
}

// Voice webhook - handles incoming calls
router.post('/voice/:numberKey', validateTwilioSignature, async (req, res) => {
  try {
    const { numberKey } = req.params;
    const {
      CallSid,
      From,
      To,
      CallStatus,
      Direction,
      ForwardedFrom,
      CallerName,
      ParentCallSid
    } = req.body;

    logger.info(`Voice webhook received for ${numberKey}:`, req.body);

    // Find the user associated with this Twilio number
    const user = await findUserByTwilioNumber(numberKey);
    if (!user) {
      logger.error(`No user found for Twilio number: ${numberKey}`);
      return res.status(400).json({ error: 'Invalid number configuration' });
    }

    // Create or update call record
    const callData = {
      callSid: CallSid,
      parentCallSid: ParentCallSid,
      userId: user._id,
      twilioNumber: numberKey,
      from: From,
      to: To,
      direction: Direction.toLowerCase(),
      status: CallStatus.toLowerCase().replace('-', '-'),
      forwardedFrom: ForwardedFrom,
      callerName: CallerName,
      startTime: CallStatus === 'in-progress' ? new Date() : undefined
    };

    await Call.findOneAndUpdate(
      { callSid: CallSid },
      callData,
      { upsert: true, new: true }
    );

    // Generate TwiML response based on call status
    let twiml;
    if (CallStatus === 'ringing' || CallStatus === 'initiated') {
      // Handle incoming call
      const numberConfig = twilioService.getNumberConfig(numberKey);
      const greeting = `Hello, you've reached ${numberConfig?.type || 'our'} line. `;
      
      twiml = twilioService.generateVoiceTwiML({
        message: greeting + 'Please leave a message after the tone.',
        action: `/webhooks/recording/${numberKey}`,
        record: true
      });
    } else {
      // Status update, no TwiML needed
      res.status(200).send('OK');
      return;
    }

    res.type('text/xml').send(twiml);

  } catch (error) {
    logger.error('Voice webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// SMS webhook - handles incoming messages
router.post('/sms/:numberKey', validateTwilioSignature, async (req, res) => {
  try {
    const { numberKey } = req.params;
    const {
      MessageSid,
      From,
      To,
      Body,
      NumSegments,
      MessageStatus,
      NumMedia,
      MediaUrl0,
      MediaContentType0
    } = req.body;

    logger.info(`SMS webhook received for ${numberKey}:`, req.body);

    // Find the user associated with this Twilio number
    const user = await findUserByTwilioNumber(numberKey);
    if (!user) {
      logger.error(`No user found for Twilio number: ${numberKey}`);
      return res.status(400).json({ error: 'Invalid number configuration' });
    }

    // Process media attachments
    const media = [];
    if (NumMedia && parseInt(NumMedia) > 0) {
      for (let i = 0; i < parseInt(NumMedia); i++) {
        const mediaUrl = req.body[`MediaUrl${i}`];
        const contentType = req.body[`MediaContentType${i}`];
        
        if (mediaUrl && contentType) {
          media.push({
            url: mediaUrl,
            contentType,
            filename: `media_${MessageSid}_${i}.${contentType.split('/')[1]}`
          });
        }
      }
    }

    // Create or update message record
    const messageData = {
      messageSid: MessageSid,
      userId: user._id,
      twilioNumber: numberKey,
      from: From,
      to: To,
      direction: 'inbound',
      body: Body || '',
      status: MessageStatus?.toLowerCase() || 'received',
      numSegments: parseInt(NumSegments) || 1,
      media,
      thread: {
        isRead: false,
        lastMessageAt: new Date()
      }
    };

    await Message.findOneAndUpdate(
      { messageSid: MessageSid },
      messageData,
      { upsert: true, new: true }
    );

    // Auto-reply logic (optional)
    const numberConfig = twilioService.getNumberConfig(numberKey);
    let autoReply = null;
    
    if (numberConfig?.type === 'business') {
      autoReply = 'Thank you for your message. We will get back to you shortly during business hours.';
    } else if (Body?.toLowerCase().includes('help')) {
      autoReply = 'This is an automated response. Your message has been received.';
    }

    // Generate TwiML response
    let twiml = '';
    if (autoReply) {
      twiml = twilioService.generateSMSTwiML(autoReply);
    }

    res.type('text/xml').send(twiml);

  } catch (error) {
    logger.error('SMS webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Status callback webhook - handles call/message status updates
router.post('/status/:numberKey', validateTwilioSignature, async (req, res) => {
  try {
    const { numberKey } = req.params;
    const {
      CallSid,
      MessageSid,
      CallStatus,
      MessageStatus,
      CallDuration,
      RecordingUrl,
      RecordingDuration,
      Price,
      PriceUnit
    } = req.body;

    logger.info(`Status webhook received for ${numberKey}:`, req.body);

    if (CallSid) {
      // Update call status
      const updateData = {
        status: CallStatus?.toLowerCase().replace('-', '-'),
        price: Price,
        priceUnit: PriceUnit
      };

      if (CallStatus === 'completed') {
        updateData.endTime = new Date();
        updateData.duration = parseInt(CallDuration) || 0;
      }

      if (RecordingUrl) {
        updateData.recording = {
          url: RecordingUrl,
          duration: parseInt(RecordingDuration) || 0
        };
      }

      await Call.findOneAndUpdate(
        { callSid: CallSid },
        updateData,
        { new: true }
      );

    } else if (MessageSid) {
      // Update message status
      const updateData = {
        status: MessageStatus?.toLowerCase(),
        price: Price,
        priceUnit: PriceUnit
      };

      if (MessageStatus === 'sent') {
        updateData.sentAt = new Date();
      } else if (MessageStatus === 'delivered') {
        updateData.deliveredAt = new Date();
      }

      await Message.findOneAndUpdate(
        { messageSid: MessageSid },
        updateData,
        { new: true }
      );
    }

    res.status(200).send('OK');

  } catch (error) {
    logger.error('Status webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Recording webhook - handles call recordings
router.post('/recording/:numberKey', validateTwilioSignature, async (req, res) => {
  try {
    const { numberKey } = req.params;
    const {
      CallSid,
      RecordingSid,
      RecordingUrl,
      RecordingDuration,
      RecordingStatus
    } = req.body;

    logger.info(`Recording webhook received for ${numberKey}:`, req.body);

    // Update call with recording information
    await Call.findOneAndUpdate(
      { callSid: CallSid },
      {
        recording: {
          url: RecordingUrl,
          duration: parseInt(RecordingDuration) || 0,
          sid: RecordingSid,
          status: RecordingStatus
        }
      },
      { new: true }
    );

    res.status(200).send('OK');

  } catch (error) {
    logger.error('Recording webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Transcription webhook - handles call transcriptions
router.post('/transcription/:numberKey', validateTwilioSignature, async (req, res) => {
  try {
    const { numberKey } = req.params;
    const {
      CallSid,
      TranscriptionText,
      TranscriptionStatus,
      TranscriptionUrl
    } = req.body;

    logger.info(`Transcription webhook received for ${numberKey}:`, req.body);

    // Update call with transcription
    await Call.findOneAndUpdate(
      { callSid: CallSid },
      {
        transcript: {
          text: TranscriptionText,
          status: TranscriptionStatus?.toLowerCase(),
          url: TranscriptionUrl
        }
      },
      { new: true }
    );

    res.status(200).send('OK');

  } catch (error) {
    logger.error('Transcription webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check for webhooks
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'webhooks',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;