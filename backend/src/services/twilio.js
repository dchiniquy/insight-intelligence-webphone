const twilio = require('twilio');
const logger = require('../config/logger');

class TwilioService {
  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    // Parse Twilio numbers configuration
    try {
      this.numbersConfig = JSON.parse(process.env.TWILIO_NUMBERS_CONFIG || '{}');
    } catch (error) {
      logger.error('Failed to parse TWILIO_NUMBERS_CONFIG:', error);
      this.numbersConfig = {};
    }

    logger.info('Twilio service initialized with numbers:', Object.keys(this.numbersConfig));
  }

  // Get Twilio number configuration by key (don, demie, business)
  getNumberConfig(numberKey) {
    return this.numbersConfig[numberKey];
  }

  // Get all configured numbers
  getAllNumbers() {
    return this.numbersConfig;
  }

  // Get the actual phone number string by key
  getPhoneNumber(numberKey) {
    const config = this.getNumberConfig(numberKey);
    return config ? config.number : null;
  }

  // Find number key by phone number
  findNumberKey(phoneNumber) {
    for (const [key, config] of Object.entries(this.numbersConfig)) {
      if (config.number === phoneNumber) {
        return key;
      }
    }
    return null;
  }

  // Make a voice call
  async makeCall(options) {
    try {
      const { to, from, url, method = 'POST', statusCallback, statusCallbackMethod = 'POST' } = options;

      const call = await this.client.calls.create({
        to,
        from,
        url,
        method,
        statusCallback,
        statusCallbackMethod,
        record: true, // Record calls by default
        recordingStatusCallback: statusCallback,
        machineDetection: 'Enable',
        timeout: 30
      });

      logger.info(`Call initiated: ${call.sid} from ${from} to ${to}`);
      return call;
    } catch (error) {
      logger.error('Failed to make call:', error);
      throw error;
    }
  }

  // Send SMS message
  async sendMessage(options) {
    try {
      const { to, from, body, mediaUrl } = options;

      const messageOptions = {
        to,
        from,
        body
      };

      if (mediaUrl && mediaUrl.length > 0) {
        messageOptions.mediaUrl = Array.isArray(mediaUrl) ? mediaUrl : [mediaUrl];
      }

      const message = await this.client.messages.create(messageOptions);

      logger.info(`Message sent: ${message.sid} from ${from} to ${to}`);
      return message;
    } catch (error) {
      logger.error('Failed to send message:', error);
      throw error;
    }
  }

  // Generate TwiML for voice calls
  generateVoiceTwiML(options = {}) {
    const { message, action, method = 'POST', record = true } = options;
    
    const twiml = new twilio.twiml.VoiceResponse();

    if (record) {
      twiml.record({
        action: action || '/webhooks/recording',
        method,
        transcribe: true,
        transcribeCallback: action || '/webhooks/transcription'
      });
    }

    if (message) {
      twiml.say(message);
    }

    // Default behavior: dial voicemail or forward to another number
    twiml.say('Please leave a message after the tone.');
    twiml.record({
      maxLength: 120,
      finishOnKey: '#',
      action: action || '/webhooks/voicemail'
    });

    return twiml.toString();
  }

  // Generate TwiML for SMS auto-reply
  generateSMSTwiML(message) {
    const twiml = new twilio.twiml.MessagingResponse();
    
    if (message) {
      twiml.message(message);
    }

    return twiml.toString();
  }

  // Update call status
  async updateCall(callSid, options) {
    try {
      const call = await this.client.calls(callSid).update(options);
      logger.info(`Call updated: ${callSid}`);
      return call;
    } catch (error) {
      logger.error('Failed to update call:', error);
      throw error;
    }
  }

  // Get call details
  async getCall(callSid) {
    try {
      const call = await this.client.calls(callSid).fetch();
      return call;
    } catch (error) {
      logger.error('Failed to get call:', error);
      throw error;
    }
  }

  // Get message details
  async getMessage(messageSid) {
    try {
      const message = await this.client.messages(messageSid).fetch();
      return message;
    } catch (error) {
      logger.error('Failed to get message:', error);
      throw error;
    }
  }

  // Get call recordings
  async getCallRecordings(callSid) {
    try {
      const recordings = await this.client.recordings.list({ callSid });
      return recordings;
    } catch (error) {
      logger.error('Failed to get call recordings:', error);
      throw error;
    }
  }

  // Delete recording
  async deleteRecording(recordingSid) {
    try {
      await this.client.recordings(recordingSid).remove();
      logger.info(`Recording deleted: ${recordingSid}`);
    } catch (error) {
      logger.error('Failed to delete recording:', error);
      throw error;
    }
  }

  // Validate webhook signature
  validateWebhook(signature, url, params) {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    return twilio.validateRequest(authToken, signature, url, params);
  }

  // Get account information
  async getAccountInfo() {
    try {
      const account = await this.client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
      return account;
    } catch (error) {
      logger.error('Failed to get account info:', error);
      throw error;
    }
  }

  // List all phone numbers on the account
  async listPhoneNumbers() {
    try {
      const phoneNumbers = await this.client.incomingPhoneNumbers.list();
      return phoneNumbers;
    } catch (error) {
      logger.error('Failed to list phone numbers:', error);
      throw error;
    }
  }

  // Update phone number webhook URLs
  async updatePhoneNumberWebhooks(phoneNumberSid, options) {
    try {
      const { voiceUrl, smsUrl, statusCallback } = options;
      
      const updateData = {};
      if (voiceUrl) updateData.voiceUrl = voiceUrl;
      if (smsUrl) updateData.smsUrl = smsUrl;
      if (statusCallback) updateData.statusCallback = statusCallback;

      const phoneNumber = await this.client.incomingPhoneNumbers(phoneNumberSid).update(updateData);
      logger.info(`Phone number webhooks updated: ${phoneNumber.phoneNumber}`);
      return phoneNumber;
    } catch (error) {
      logger.error('Failed to update phone number webhooks:', error);
      throw error;
    }
  }

  // Get usage statistics
  async getUsageStats(category = 'calls', startDate, endDate) {
    try {
      const options = { category };
      if (startDate) options.startDate = startDate;
      if (endDate) options.endDate = endDate;

      const usage = await this.client.usage.records.list(options);
      return usage;
    } catch (error) {
      logger.error('Failed to get usage stats:', error);
      throw error;
    }
  }
}

// Create singleton instance
const twilioService = new TwilioService();

module.exports = twilioService;