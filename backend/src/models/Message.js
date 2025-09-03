const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  messageSid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  twilioNumber: {
    type: String,
    required: true,
    enum: ['don', 'demie', 'business'],
    index: true
  },
  from: {
    type: String,
    required: true,
    trim: true
  },
  to: {
    type: String,
    required: true,
    trim: true
  },
  direction: {
    type: String,
    required: true,
    enum: ['inbound', 'outbound'],
    index: true
  },
  body: {
    type: String,
    required: true,
    maxlength: 1600
  },
  status: {
    type: String,
    required: true,
    enum: [
      'accepted', 'queued', 'sending', 'sent', 'receiving', 
      'received', 'delivered', 'undelivered', 'failed', 'read'
    ],
    index: true
  },
  numSegments: {
    type: Number,
    default: 1
  },
  price: {
    type: String,
    default: null
  },
  priceUnit: {
    type: String,
    default: 'USD'
  },
  errorCode: {
    type: String,
    default: null
  },
  errorMessage: {
    type: String,
    default: null
  },
  media: [{
    contentType: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    filename: {
      type: String,
      default: null
    },
    size: {
      type: Number,
      default: null
    }
  }],
  metadata: {
    accountSid: String,
    apiVersion: String,
    customParameters: mongoose.Schema.Types.Mixed
  },
  thread: {
    threadId: {
      type: String,
      index: true
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    },
    lastMessageAt: {
      type: Date,
      default: Date.now
    }
  },
  notes: {
    type: String,
    maxlength: 500
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  scheduledAt: {
    type: Date,
    default: null,
    index: true
  },
  sentAt: {
    type: Date,
    default: null
  },
  deliveredAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound indexes for better query performance
messageSchema.index({ userId: 1, createdAt: -1 });
messageSchema.index({ twilioNumber: 1, createdAt: -1 });
messageSchema.index({ direction: 1, status: 1 });
messageSchema.index({ from: 1, to: 1, createdAt: -1 });
messageSchema.index({ 'thread.threadId': 1, createdAt: 1 });
messageSchema.index({ 'thread.isRead': 1, userId: 1 });
messageSchema.index({ scheduledAt: 1, status: 1 });

// Update the updatedAt field before saving
messageSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Pre-save middleware to generate thread ID
messageSchema.pre('save', function(next) {
  if (!this.thread.threadId) {
    // Create a consistent thread ID based on the two phone numbers
    const numbers = [this.from, this.to].sort();
    this.thread.threadId = `${numbers[0]}-${numbers[1]}-${this.twilioNumber}`;
  }
  next();
});

// Virtual for formatted phone numbers
messageSchema.virtual('fromFormatted').get(function() {
  return this.formatPhoneNumber(this.from);
});

messageSchema.virtual('toFormatted').get(function() {
  return this.formatPhoneNumber(this.to);
});

// Virtual for message preview (truncated body)
messageSchema.virtual('preview').get(function() {
  if (this.body.length <= 100) return this.body;
  return this.body.substring(0, 100) + '...';
});

// Instance method to format phone numbers
messageSchema.methods.formatPhoneNumber = function(phoneNumber) {
  if (!phoneNumber) return null;
  
  // Remove country code and format as (XXX) XXX-XXXX
  const cleaned = phoneNumber.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const number = cleaned.slice(1);
    return `(${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`;
  } else if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phoneNumber;
};

// Instance method to calculate cost
messageSchema.methods.calculateCost = function() {
  if (!this.price) return 0;
  return parseFloat(this.price.replace('$', ''));
};

// Instance method to mark as read
messageSchema.methods.markAsRead = function() {
  this.thread.isRead = true;
  return this.save();
};

// Static method to get conversation between two numbers
messageSchema.statics.getConversation = function(userId, twilioNumber, otherNumber, limit = 50, offset = 0) {
  const threadId = [twilioNumber, otherNumber].sort().join('-') + `-${twilioNumber}`;
  
  return this.find({
    userId,
    'thread.threadId': threadId
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .skip(offset)
  .exec();
};

// Static method to get message threads (conversations)
messageSchema.statics.getThreads = function(userId, twilioNumber, limit = 20) {
  return this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        ...(twilioNumber && { twilioNumber })
      }
    },
    {
      $sort: { 'thread.lastMessageAt': -1 }
    },
    {
      $group: {
        _id: '$thread.threadId',
        lastMessage: { $first: '$$ROOT' },
        unreadCount: {
          $sum: { $cond: [{ $eq: ['$thread.isRead', false] }, 1, 0] }
        },
        messageCount: { $sum: 1 },
        participants: { 
          $addToSet: { 
            $cond: [
              { $eq: ['$direction', 'inbound'] },
              '$from',
              '$to'
            ]
          }
        }
      }
    },
    {
      $sort: { 'lastMessage.thread.lastMessageAt': -1 }
    },
    {
      $limit: limit
    }
  ]);
};

// Static method to get message statistics
messageSchema.statics.getMessageStats = function(userId, twilioNumber, dateRange = {}) {
  const matchStage = { userId: mongoose.Types.ObjectId(userId) };
  
  if (twilioNumber) {
    matchStage.twilioNumber = twilioNumber;
  }
  
  if (dateRange.start || dateRange.end) {
    matchStage.createdAt = {};
    if (dateRange.start) matchStage.createdAt.$gte = new Date(dateRange.start);
    if (dateRange.end) matchStage.createdAt.$lte = new Date(dateRange.end);
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalMessages: { $sum: 1 },
        inboundMessages: {
          $sum: { $cond: [{ $eq: ['$direction', 'inbound'] }, 1, 0] }
        },
        outboundMessages: {
          $sum: { $cond: [{ $eq: ['$direction', 'outbound'] }, 1, 0] }
        },
        deliveredMessages: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
        },
        failedMessages: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        },
        totalSegments: { $sum: '$numSegments' },
        totalCost: {
          $sum: {
            $toDouble: {
              $substr: [
                { $ifNull: ['$price', '$0.00'] },
                1,
                -1
              ]
            }
          }
        },
        mediaMessages: {
          $sum: { $cond: [{ $gt: [{ $size: '$media' }, 0] }, 1, 0] }
        }
      }
    }
  ]);
};

// Ensure virtual fields are serialized
messageSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Message', messageSchema);