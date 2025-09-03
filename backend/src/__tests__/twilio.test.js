describe('Twilio Service Configuration', () => {
  let twilioService;

  beforeEach(() => {
    // Set up test environment
    process.env.TWILIO_NUMBERS_CONFIG = JSON.stringify({
      don: { number: '+15551234567', label: "Don's Number" },
      demie: { number: '+15551234568', label: "Demie's Number" },
      business: { number: '+15551234569', label: 'Business Number' }
    });

    // Mock the twilio constructor to avoid real API calls
    jest.doMock('twilio', () => {
      return jest.fn(() => ({
        calls: { create: jest.fn() },
        messages: { create: jest.fn() }
      }));
    });

    // Require after mocking
    jest.resetModules();
    twilioService = require('../services/twilio');
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.TWILIO_NUMBERS_CONFIG;
  });

  describe('Number Configuration', () => {
    it('should get phone number by key', () => {
      const phoneNumber = twilioService.getPhoneNumber('don');
      expect(phoneNumber).toBe('+15551234567');
    });

    it('should return null for invalid key', () => {
      const phoneNumber = twilioService.getPhoneNumber('invalid');
      expect(phoneNumber).toBeNull();
    });

    it('should get all numbers configuration', () => {
      const allNumbers = twilioService.getAllNumbers();
      expect(Object.keys(allNumbers)).toEqual(['don', 'demie', 'business']);
    });

    it('should find number key by phone number', () => {
      const key = twilioService.findNumberKey('+15551234569');
      expect(key).toBe('business');
    });

    it('should return null when number key not found', () => {
      const key = twilioService.findNumberKey('+15559999999');
      expect(key).toBeNull();
    });

    it('should get number configuration by key', () => {
      const config = twilioService.getNumberConfig('demie');
      expect(config).toEqual({
        number: '+15551234568',
        label: "Demie's Number"
      });
    });
  });
});