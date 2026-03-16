const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { OAuth2Client } = require('google-auth-library');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || "370403775632-ekl0knt2d7ukm2uk94qde5sqr3gho6ck.apps.googleusercontent.com");

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false
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

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
  const { firstName, lastName, mobile, address, email, password, username, dob } = req.body;

  try {
    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message: 'Password must have at least 8 characters, 1 uppercase, 1 lowercase, 1 number, and 1 special symbol'
      });
    }
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
      return res.status(404).json({ message: 'User with this email does not exist' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    user.otp = {
      code: crypto.createHash('sha256').update(otp).digest('hex'),
      expiry: otpExpiry,
      attempts: 0
    };
    await user.save();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your Password Reset OTP',
      text: `Your OTP for password reset is: ${otp}. It will expire in 15 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #4A90E2;">Password Reset OTP</h2>
          <p>You requested a password reset for your Smart Travel Assistant account.</p>
          <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #333;">
            ${otp}
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 20px;">This OTP will expire in 15 minutes. If you did not request this, please ignore this email.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'OTP sent to your email' });
  } catch (error) {
    console.error('Forgot Password Error:', error);
    res.status(500).json({ message: 'Failed to send OTP' });
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
