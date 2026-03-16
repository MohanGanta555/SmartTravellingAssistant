const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename(req, file, cb) {
    cb(null, `${req.user._id}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
});

function checkFileType(file, cb) {
  const filetypes = /jpg|jpeg|png/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb('Images only!');
  }
}

const isStrongPassword = (pwd) => {
  if (typeof pwd !== 'string') return false;
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/.test(pwd);
};

// @desc    Change password with old password verification
// @route   POST /api/users/change-password
// @access  Private
router.post('/change-password', protect, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Old password and new password are required' });
    }
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        message: 'Password must have at least 8 characters, 1 uppercase, 1 lowercase, 1 number, and 1 special symbol'
      });
    }
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const ok = await user.matchPassword(oldPassword);
    if (!ok) {
      return res.status(400).json({ message: 'Incorrect previous password' });
    }
    user.password = newPassword;
    await user.save();
    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to change password' });
  }
});

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
router.get('/profile', protect, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized, user missing' });
  }
  res.json({
    _id: req.user._id,
    firstName: req.user.firstName,
    lastName: req.user.lastName,
    username: req.user.username,
    email: req.user.email,
    mobile: req.user.mobile,
    address: req.user.address,
    profilePicture: req.user.profilePicture,
    bio: req.user.bio,
    followers: req.user.followers,
    following: req.user.following,
    privacySettings: req.user.privacySettings,
    createdAt: req.user.createdAt,
    plans: req.user.plans || [],
  });
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
router.put('/profile', protect, upload.single('image'), async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    user.firstName = req.body.firstName || user.firstName;
    user.lastName = req.body.lastName || user.lastName;
    user.username = req.body.username || user.username;
    user.email = req.body.email || user.email;
    user.mobile = req.body.mobile || user.mobile;
    user.address = req.body.address || user.address;
    user.bio = req.body.bio || user.bio;
    
    if (req.file) {
      user.profilePicture = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    } else if (req.body.profilePicture) {
      // Allow manual URL update if provided and no file
       user.profilePicture = req.body.profilePicture;
    }

    if (req.body.privacySettings) {
        // If it comes as a string (from FormData), parse it
        let settings = req.body.privacySettings;
        if (typeof settings === 'string') {
            try {
                settings = JSON.parse(settings);
            } catch (e) {
                // ignore
            }
        }
        user.privacySettings = { ...user.privacySettings, ...settings };
    }

    if (req.body.password) {
      if (!isStrongPassword(req.body.password)) {
        return res.status(400).json({
          message: 'Password must have at least 8 characters, 1 uppercase, 1 lowercase, 1 number, and 1 special symbol'
        });
      }
      user.password = req.body.password;
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      username: updatedUser.username,
      email: updatedUser.email,
      mobile: updatedUser.mobile,
      address: updatedUser.address,
      profilePicture: updatedUser.profilePicture,
      bio: updatedUser.bio,
      followers: updatedUser.followers,
      following: updatedUser.following,
      privacySettings: updatedUser.privacySettings,
      createdAt: updatedUser.createdAt,
      token: req.headers.authorization.split(' ')[1],
    });
  } else {
    res.status(404).json({ message: 'User not found' });
  }
});

// @desc    Verify current password (no changes, just check)
// @route   POST /api/users/verify-password
// @access  Private
router.post('/verify-password', protect, async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ ok: false, message: 'Password required' });
    }
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }
    const ok = await user.matchPassword(password);
    return res.json({ ok });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message || 'Verification failed' });
  }
});

// @desc    Get user's planned trips
// @route   GET /api/users/plans
// @access  Private
router.get('/plans', protect, async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  res.json({ plans: user.plans || [] });
});

// @desc    Add a planned trip to user history
// @route   POST /api/users/plans
// @access  Private
router.post('/plans', protect, async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  const plan = req.body || {};
  user.plans = user.plans || [];
  user.plans.push(plan);
  await user.save();
  res.status(201).json({ message: 'Plan saved', plan });
});

// @desc    Delete a planned trip by index
// @route   DELETE /api/users/plans/:index
// @access  Private
router.delete('/plans/:index', protect, async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  const idx = parseInt(req.params.index, 10);
  if (isNaN(idx) || idx < 0 || idx >= (user.plans?.length || 0)) {
    return res.status(400).json({ message: 'Invalid plan index' });
  }
  user.plans.splice(idx, 1);
  await user.save();
  res.json({ message: 'Plan deleted', plans: user.plans });
});

module.exports = router;
