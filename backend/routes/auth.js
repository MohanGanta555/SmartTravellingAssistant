const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { OAuth2Client } = require('google-auth-library');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const OTP = require('../models/OTP');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || "370403775632-ekl0knt2d7ukm2uk94qde5sqr3gho6ck.apps.googleusercontent.com");

const transporter = nodemailer.createTransport({
  service: 'gmail', // Let nodemailer handle the port and host for Gmail
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Verify transporter connection at startup
transporter.verify((error, success) => {
  if (error) {
    console.error('SMTP Transporter Error:', error);
  } else {
    console.log('SMTP Server is ready to take our messages');
  }
});

const isStrongPassword = (pwd) => {
  if (typeof pwd !== 'string') return false;
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/.test(pwd);
};

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Send OTP for Registration
// @route   POST /api/auth/send-register-otp
// @access  Public
router.post('/send-register-otp', async (req, res) => {
  const { email } = req.body;
  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Delete any existing OTP for this email
    await OTP.deleteMany({ email, type: 'registration' });

    // Store new OTP
    await OTP.create({
      email,
      code: crypto.createHash('sha256').update(otpCode).digest('hex'),
      expiry: otpExpiry,
      type: 'registration'
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your Registration OTP',
      text: `Your OTP for registration is: ${otpCode}. It will expire in 15 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #4A90E2;">Registration OTP</h2>
          <p>Welcome to Smart Travel Assistant! Please use the following OTP to complete your registration.</p>
          <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #333;">
            ${otpCode}
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 20px;">This OTP will expire in 15 minutes. If you did not request this, please ignore this email.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`OTP sent successfully to ${email}`);
    res.json({ message: 'OTP sent successfully to your email' });
  } catch (error) {
    console.error('Registration OTP Error Details:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response
    });
    res.status(500).json({ 
      message: 'Failed to send OTP', 
      error: error.message,
      code: error.code 
    });
  }
});

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
  const { firstName, lastName, mobile, address, email, password, username, dob, otpCode } = req.body;

  try {
    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message: 'Password must have at least 8 characters, 1 uppercase, 1 lowercase, 1 number, and 1 special symbol'
      });
    }

    if (!otpCode) {
      return res.status(400).json({ message: 'OTP is required' });
    }

    // Verify OTP
    const otpRecord = await OTP.findOne({ email, type: 'registration' });
    if (!otpRecord) {
      return res.status(400).json({ message: 'OTP record not found' });
    }

    if (otpRecord.expiry < new Date()) {
      return res.status(400).json({ message: 'OTP has expired' });
    }

    if (otpRecord.attempts >= 3) {
      return res.status(400).json({ message: 'Maximum attempts exceeded' });
    }

    const hashedOtp = crypto.createHash('sha256').update(otpCode).digest('hex');
    if (hashedOtp !== otpRecord.code) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // After verification, delete the OTP record
    await OTP.deleteOne({ _id: otpRecord._id });

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    const user = await User.create({
      firstName,
      lastName,
      mobile,
      address,
      email,
      password,
      username,
      dob,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        mobile: user.mobile,
        address: user.address,
        email: user.email,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      const weakPassword = !isStrongPassword(password);
      res.json({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        token: generateToken(user._id),
        weakPassword,
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Google OAuth Login/Register
// @route   POST /api/auth/google
// @access  Public
router.post('/google', async (req, res) => {
  const { credential } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID || "370403775632-ekl0knt2d7ukm2uk94qde5sqr3gho6ck.apps.googleusercontent.com",
    });

    const { sub, email, given_name, family_name, picture } = ticket.getPayload();

    let user = await User.findOne({ email });

    if (user) {
      // If user exists but doesn't have googleId, link it
      if (!user.googleId) {
        user.googleId = sub;
        user.isGoogleUser = true;
        if (!user.profilePicture) user.profilePicture = picture;
        await user.save();
      }
    } else {
      // Create new user
      const username = email.split('@')[0] + Math.floor(Math.random() * 1000);
      user = await User.create({
        firstName: given_name || 'Google',
        lastName: family_name || 'User',
        email,
        username,
        googleId: sub,
        isGoogleUser: true,
        profilePicture: picture || '',
        // These fields are not required for Google users now
        mobile: 'N/A',
        address: 'N/A',
        dob: 'N/A',
      });
    }

    res.json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
      profilePicture: user.profilePicture,
      token: generateToken(user._id),
      isGoogleUser: user.isGoogleUser,
      hasPassword: !!user.password
    });
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(400).json({ message: 'Google authentication failed' });
  }
});

// @desc    Forgot Password - Send OTP
// @route   POST /api/auth/forgot-password
// @access  Public
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.otp = {
      code: crypto.createHash('sha256').update(otpCode).digest('hex'),
      expiry: otpExpiry,
      attempts: 0
    };
    await user.save();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Password Reset OTP',
      text: `Your OTP for password reset is: ${otpCode}. It will expire in 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #4A90E2;">Password Reset OTP</h2>
          <p>You requested a password reset. Please use the following OTP to proceed.</p>
          <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #333;">
            ${otpCode}
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 20px;">This OTP will expire in 10 minutes. If you did not request this, please ignore this email.</p>
        </div>
      `
    };

    console.log(`Attempting to send OTP to ${email}...`);
    await transporter.sendMail(mailOptions);
    console.log(`OTP sent successfully to ${email}`);
    res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Forgot Password Error Details:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response
    });
    res.status(500).json({ 
      message: 'Failed to send OTP. Please check your email settings.',
      error: error.message,
      code: error.code
    });
  }
});

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !user.otp || !user.otp.code) {
      return res.status(400).json({ message: 'Invalid request' });
    }

    if (user.otp.expiry < new Date()) {
      return res.status(400).json({ message: 'OTP has expired' });
    }

    if (user.otp.attempts >= 3) {
      return res.status(400).json({ message: 'Maximum attempts exceeded. Please request a new OTP.' });
    }

    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
    if (hashedOtp !== user.otp.code) {
      user.otp.attempts += 1;
      await user.save();
      return res.status(400).json({ message: `Invalid OTP. ${3 - user.otp.attempts} attempts remaining.` });
    }

    res.json({ message: 'OTP verified successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Reset Password
// @route   POST /api/auth/reset-password
// @access  Public
router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  try {
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ message: 'Password must have at least 8 characters, 1 uppercase, 1 lowercase, 1 number, and 1 special symbol' });
    }

    const user = await User.findOne({ email });
    if (!user || !user.otp || !user.otp.code) {
      return res.status(400).json({ message: 'Invalid request' });
    }

    if (user.otp.expiry < new Date()) {
      return res.status(400).json({ message: 'OTP has expired' });
    }

    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
    if (hashedOtp !== user.otp.code) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    user.password = newPassword;
    user.otp = undefined; // Clear OTP after success
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
