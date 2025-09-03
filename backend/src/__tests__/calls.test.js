const request = require('supertest');
const express = require('express');

// Mock auth middleware before importing routes
let mockUserId = 'mock-user-id';
jest.mock('../middleware/auth', () => (req, res, next) => {
  req.user = { _id: mockUserId };
  next();
});

const callsRoutes = require('../routes/calls');
const User = require('../models/User');
const Call = require('../models/Call');

// Mock Twilio service
jest.mock('../services/twilio', () => ({
  getPhoneNumber: jest.fn(),
  makeCall: jest.fn()
}));

const twilioService = require('../services/twilio');

const app = express();
app.use(express.json());
app.use('/calls', callsRoutes);

describe('Calls Routes', () => {
  let authToken;
  let testUser;

  beforeEach(async () => {
    // Create and login a test user
    testUser = new User({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User'
    });
    await testUser.save();

    // Update mock user ID
    mockUserId = testUser._id;

    // Mock JWT for auth middleware
    const jwt = require('jsonwebtoken');
    authToken = jwt.sign({ userId: testUser._id }, process.env.JWT_SECRET);

    // Reset Twilio mocks
    jest.clearAllMocks();
    twilioService.getPhoneNumber.mockReturnValue('+15551234567');
    twilioService.makeCall.mockResolvedValue({
      sid: 'mock-call-sid-123',
      to: '+15555555555',
      from: '+15551234567',
      status: 'queued'
    });
  });

  describe('GET /calls', () => {
    beforeEach(async () => {
      // Create some test calls
      await Call.create([
        {
          callSid: 'call-1',
          userId: testUser._id,
          twilioNumber: 'don',
          from: '+15551234567',
          to: '+15555555555',
          direction: 'outbound',
          status: 'completed',
          duration: 120
        },
        {
          callSid: 'call-2',
          userId: testUser._id,
          twilioNumber: 'demie',
          from: '+15551234568',
          to: '+15555555556',
          direction: 'outbound',
          status: 'failed'
        }
      ]);
    });

    it('should get all calls for authenticated user', async () => {
      const response = await request(app)
        .get('/calls')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.calls).toHaveLength(2);
      expect(response.body.data.pagination).toHaveProperty('total', 2);
      expect(response.body.data.calls[0].callSid).toBe('call-2'); // Most recent first
      expect(response.body.data.calls[1].callSid).toBe('call-1');
    });

    it('should filter calls by Twilio number', async () => {
      const response = await request(app)
        .get('/calls?twilioNumber=don')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.calls).toHaveLength(1);
      expect(response.body.data.calls[0].twilioNumber).toBe('don');
    });

    it('should filter calls by status', async () => {
      const response = await request(app)
        .get('/calls?status=completed')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.calls).toHaveLength(1);
      expect(response.body.data.calls[0].status).toBe('completed');
    });

    it('should search calls by phone number', async () => {
      const response = await request(app)
        .get('/calls?search=5555555555')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.calls).toHaveLength(1);
      expect(response.body.data.calls[0].to).toBe('+15555555555');
    });

    it('should paginate calls', async () => {
      const response = await request(app)
        .get('/calls?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.calls).toHaveLength(1);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(1);
      expect(response.body.data.pagination.total).toBe(2);
      expect(response.body.data.pagination.pages).toBe(2);
    });

    it('should not get calls without authentication', async () => {
      const response = await request(app)
        .get('/calls')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /calls', () => {
    it('should make a call successfully', async () => {
      const callData = {
        to: '+15555555555',
        twilioNumber: 'don',
        message: 'Test call'
      };

      const response = await request(app)
        .post('/calls')
        .set('Authorization', `Bearer ${authToken}`)
        .send(callData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.call.to).toBe(callData.to);
      expect(response.body.data.call.twilioNumber).toBe(callData.twilioNumber);
      expect(response.body.data.call.callSid).toBe('mock-call-sid-123');

      // Verify Twilio service was called
      expect(twilioService.getPhoneNumber).toHaveBeenCalledWith('don');
      expect(twilioService.makeCall).toHaveBeenCalledWith({
        to: '+15555555555',
        from: '+15551234567',
        url: expect.stringContaining('/webhooks/voice/don'),
        statusCallback: expect.stringContaining('/webhooks/status/don')
      });
    });

    it('should not make call with invalid phone number', async () => {
      const callData = {
        to: 'invalid-phone',
        twilioNumber: 'don',
        message: 'Test call'
      };

      const response = await request(app)
        .post('/calls')
        .set('Authorization', `Bearer ${authToken}`)
        .send(callData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should not make call with invalid Twilio number', async () => {
      const callData = {
        to: '+15555555555',
        twilioNumber: 'invalid',
        message: 'Test call'
      };

      const response = await request(app)
        .post('/calls')
        .set('Authorization', `Bearer ${authToken}`)
        .send(callData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should handle Twilio service error', async () => {
      twilioService.makeCall.mockRejectedValue(new Error('Twilio API error'));

      const callData = {
        to: '+15555555555',
        twilioNumber: 'don',
        message: 'Test call'
      };

      const response = await request(app)
        .post('/calls')
        .set('Authorization', `Bearer ${authToken}`)
        .send(callData)
        .expect(500);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toBe('Server error making call');
    });
  });

  describe('GET /calls/:id', () => {
    let testCall;

    beforeEach(async () => {
      testCall = await Call.create({
        callSid: 'test-call-sid',
        userId: testUser._id,
        twilioNumber: 'don',
        from: '+15551234567',
        to: '+15555555555',
        direction: 'outbound',
        status: 'completed'
      });
    });

    it('should get specific call for authenticated user', async () => {
      const response = await request(app)
        .get(`/calls/${testCall._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.call.callSid).toBe('test-call-sid');
      expect(response.body.data.call.to).toBe('+15555555555');
    });

    it('should not get call that does not belong to user', async () => {
      // Create another user
      const otherUser = await User.create({
        username: 'otheruser',
        email: 'other@example.com',
        password: 'password123',
        firstName: 'Other',
        lastName: 'User'
      });

      // Create call for other user
      const otherCall = await Call.create({
        callSid: 'other-call-sid',
        userId: otherUser._id,
        twilioNumber: 'don',
        from: '+15551234567',
        to: '+15555555555',
        direction: 'outbound',
        status: 'completed'
      });

      const response = await request(app)
        .get(`/calls/${otherCall._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toBe('Call not found');
    });
  });

  describe('PUT /calls/:id', () => {
    let testCall;

    beforeEach(async () => {
      testCall = await Call.create({
        callSid: 'test-call-sid',
        userId: testUser._id,
        twilioNumber: 'don',
        from: '+15551234567',
        to: '+15555555555',
        direction: 'outbound',
        status: 'completed'
      });
    });

    it('should update call notes', async () => {
      const updateData = {
        notes: 'Updated call notes'
      };

      const response = await request(app)
        .put(`/calls/${testCall._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.call.notes).toBe('Updated call notes');
    });

    it('should update call tags', async () => {
      const updateData = {
        tags: ['important', 'follow-up']
      };

      const response = await request(app)
        .put(`/calls/${testCall._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.call.tags).toEqual(['important', 'follow-up']);
    });
  });

  describe('DELETE /calls/:id', () => {
    let testCall;

    beforeEach(async () => {
      testCall = await Call.create({
        callSid: 'test-call-sid',
        userId: testUser._id,
        twilioNumber: 'don',
        from: '+15551234567',
        to: '+15555555555',
        direction: 'outbound',
        status: 'completed'
      });
    });

    it('should delete call', async () => {
      const response = await request(app)
        .delete(`/calls/${testCall._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toBe('Call deleted successfully');

      // Verify call was deleted
      const deletedCall = await Call.findById(testCall._id);
      expect(deletedCall).toBeNull();
    });
  });
});