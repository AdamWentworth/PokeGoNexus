const mongoose = require('../middlewares/mongoose');

const oauthLinkTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true
  },
  intent: {
    type: String,
    enum: ['link', 'login', 'register'],
    default: 'link',
    required: true
  },
  provider: {
    type: String,
    enum: ['google', 'discord', 'facebook'],
    required: true
  },
  deviceId: { type: String, required: true, maxlength: 128 },
  stateHash: { type: String, required: true, unique: true },
  nonce: { type: String, default: null },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed'],
    default: 'pending',
    required: true
  },
  resultHash: { type: String, default: undefined },
  resultStatus: {
    type: String,
    enum: [
      'linked',
      'link-conflict',
      'authenticated',
      'registration-required',
      'account-exists',
      'account-not-found',
      'failed'
    ],
    default: null
  },
  resultUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  identitySubject: { type: String, default: null, maxlength: 512 },
  identityEmail: { type: String, default: null, maxlength: 320 },
  identityEmailVerified: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true },
  exchangedAt: { type: Date, default: null },
  consumedAt: { type: Date, default: null }
}, {
  timestamps: true
});

oauthLinkTransactionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
oauthLinkTransactionSchema.index({ resultHash: 1 }, {
  unique: true,
  partialFilterExpression: { resultHash: { $type: 'string' } }
});

module.exports = mongoose.model('OAuthLinkTransaction', oauthLinkTransactionSchema);
