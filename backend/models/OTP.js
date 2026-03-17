const mongoose = require('mongoose');

const OTPSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  code: {
    type: String,
    required: true,
  },
  expiry: {
    type: Date,
    required: true,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  type: {
    type: String,
    enum: ['registration', 'password-reset'],
    default: 'registration',
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 900 // Automatically delete after 15 minutes
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('OTP', OTPSchema);
