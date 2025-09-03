const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');
const logger = require('../config/logger');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

// Get user profile
router.get('/profile', async (req, res) => {
  try {
    res.json({
      success: true,
      data: { user: req.user }
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error getting profile'
    });
  }
});

// Update user profile
router.put('/profile', [
  body('firstName').optional().isLength({ min: 1, max: 50 }).trim(),
  body('lastName').optional().isLength({ min: 1, max: 50 }).trim(),
  body('phone').optional().isMobilePhone(),
  body('preferences.theme').optional().isIn(['light', 'dark', 'auto']),
  body('preferences.defaultTwilioNumber').optional().isIn(['don', 'demie', 'business']),
  body('preferences.notifications.email').optional().isBoolean(),
  body('preferences.notifications.push').optional().isBoolean(),
  body('preferences.notifications.sms').optional().isBoolean()
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

    const allowedUpdates = [
      'firstName', 'lastName', 'phone', 'preferences'
    ];
    
    const updates = {};
    
    // Handle top-level updates
    allowedUpdates.forEach(update => {
      if (req.body[update] !== undefined) {
        updates[update] = req.body[update];
      }
    });

    // Handle nested preferences updates
    if (req.body.preferences) {
      updates.preferences = { ...req.user.preferences, ...req.body.preferences };
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );

    logger.info(`User profile updated: ${user.email}`);

    res.json({
      success: true,
      data: { user }
    });

  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error updating profile'
    });
  }
});

// Change password
router.put('/password', [
  body('currentPassword').isLength({ min: 6 }),
  body('newPassword').isLength({ min: 6 }),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Password confirmation does not match password');
    }
    return true;
  })
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

    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const isCurrentPasswordCorrect = await req.user.comparePassword(currentPassword);
    if (!isCurrentPasswordCorrect) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Update password
    req.user.password = newPassword;
    await req.user.save();

    logger.info(`Password changed for user: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error changing password'
    });
  }
});

// Delete account
router.delete('/account', [
  body('password').isLength({ min: 6 }),
  body('confirmDelete').equals('DELETE').withMessage('Must confirm deletion by typing DELETE')
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

    const { password } = req.body;

    // Verify password
    const isPasswordCorrect = await req.user.comparePassword(password);
    if (!isPasswordCorrect) {
      return res.status(400).json({
        success: false,
        error: 'Password is incorrect'
      });
    }

    // Soft delete - deactivate account
    await User.findByIdAndUpdate(req.user._id, { isActive: false });

    logger.info(`Account deleted for user: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });

  } catch (error) {
    logger.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error deleting account'
    });
  }
});

module.exports = router;