const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  mobile: {
    type: String,
    required: function() { return !this.isGoogleUser; },
  },
  address: {
    type: String,
    required: function() { return !this.isGoogleUser; },
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  isGoogleUser: {
    type: Boolean,
    default: false,
  },
  dob: {
    type: String,
    required: function() { return !this.isGoogleUser; },
  },
  username: {
    type: String,
    required: true,
    unique: true,
  },
  profilePicture: {
    type: String,
    default: '',
  },
  bio: {
    type: String,
    default: '',
  },
  followers: {
    type: Number,
    default: 0,
  },
  following: {
    type: Number,
    default: 0,
  },
  privacySettings: {
    profileVisibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
    },
    showEmail: {
      type: Boolean,
      default: false,
    },
  },
  password: {
    type: String,
    required: function() { return !this.isGoogleUser; },
  },
  plans: [{
    source: String,
    destination: String,
    startDate: String,
    endDate: String,
    travelers: Number,
    transportMode: String,
    chosenTransportOption: Object,
    includeReturn: Boolean,
    chosenReturnTransportOption: Object,
    selectedHotels: Array,
    finalBudget: Number,
    finalMinBudget: Number,
    selectedPlaces: Array,
    itineraryDays: Array,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  otp: {
    code: String,
    expiry: Date,
    attempts: { type: Number, default: 0 }
  },
}, {
  timestamps: true,
});

// Encrypt password using bcrypt
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
