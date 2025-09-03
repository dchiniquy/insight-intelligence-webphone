const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
  callSid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  parentCallSid: {
    type: String,
    default: null
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
  status: {
    type: String,
    required: true,
    enum: [
      'queued', 'initiated', 'ringing', 'answered', 
      'completed', 'busy', 'failed', 'no-answer', 'canceled'
    ],
    index: true
  },
  startTime: {
    type: Date,
    default: null
  },
  endTime: {
    type: Date,
    default: null
  },
  duration: {
    type: Number, // in seconds
    default: null
  },
  price: {
    type: String,
    default: null
  },
  priceUnit: {
    type: String,
    default: 'USD'
  },
  forwardedFrom: {
    type: String,
    default: null
  },
  callerName: {
    type: String,
    default: null
  },
  recording: {
    url: {
      type: String,
      default: null
    },
    duration: {
      type: Number,
      default: null
    },
    fileSize: {
      type: Number,
      default: null
    }
  },
  transcript: {
    text: {
      type: String,
      default: null
    },
    confidence: {
      type: Number,
      default: null
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: null
    }
  },
  metadata: {
    userAgent: String,
    machineDetection: String,
    answeredBy: String,
    customParameters: mongoose.Schema.Types.Mixed
  },
  notes: {
    type: String,
    maxlength: 1000
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
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
callSchema.index({ userId: 1, createdAt: -1 });
callSchema.index({ twilioNumber: 1, createdAt: -1 });
callSchema.index({ direction: 1, status: 1 });
callSchema.index({ from: 1, createdAt: -1 });
callSchema.index({ to: 1, createdAt: -1 });

// Update the updatedAt field before saving
callSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for call duration in human-readable format
callSchema.virtual('durationFormatted').get(function() {
  if (!this.duration) return null;
  
  const minutes = Math.floor(this.duration / 60);
  const seconds = this.duration % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// Virtual for formatted phone numbers
callSchema.virtual('fromFormatted').get(function() {
  return this.formatPhoneNumber(this.from);
});

callSchema.virtual('toFormatted').get(function() {
  return this.formatPhoneNumber(this.to);
});

// Instance method to format phone numbers
callSchema.methods.formatPhoneNumber = function(phoneNumber) {
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
callSchema.methods.calculateCost = function() {
  if (!this.price) return 0;
  return parseFloat(this.price.replace('$', ''));
};

// Static method to get call statistics
callSchema.statics.getCallStats = function(userId, twilioNumber, dateRange = {}) {
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
        totalCalls: { $sum: 1 },
        inboundCalls: {
          $sum: { $cond: [{ $eq: ['$direction', 'inbound'] }, 1, 0] }
        },
        outboundCalls: {
          $sum: { $cond: [{ $eq: ['$direction', 'outbound'] }, 1, 0] }
        },
        answeredCalls: {
          $sum: { $cond: [{ $eq: ['$status', 'answered'] }, 1, 0] }
        },
        missedCalls: {
          $sum: { $cond: [{ $eq: ['$status', 'no-answer'] }, 1, 0] }
        },
        totalDuration: { $sum: '$duration' },
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
        }
      }
    }
  ]);
};

// Ensure virtual fields are serialized
callSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Call', callSchema);