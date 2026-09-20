// authRoute.js

const express = require('express');
const router = express.Router();
const User = require('../models/user');
const bcrypt = require('bcrypt');
const logger = require('../middlewares/logger'); // Ensure logger is imported correctly
const tokenService = require('../services/tokenService'); // Adjust the path as necessary
const setCookies = require('../middlewares/setCookies'); // Adjust the path as necessary
const requireAuth = require('../middlewares/requireAuth');
const { hashRefreshToken } = require('../utils/refreshTokenHash');
const sanitizeForLogging = require('../utils/sanitizeLogging');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../services/passwordResetEmailService');
const {
    sendEmailChangeVerification,
    sendEmailChangedNotice
} = require('../services/emailChangeService');
const isValidEmail = require('../utils/validateEmail');

const TRAINER_CODE_RE = /^\d{12}$/;
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,128}$/;
const RECENT_AUTH_SECONDS = 15 * 60;

const isNonEmptyString = (value, min = 1, max = 255) => {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    return trimmed.length >= min && trimmed.length <= max;
};

const normalizeOptionalString = (value, max = 255) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > max) return null;
    return trimmed;
};

const parseCoordinates = (value) => {
    if (value === undefined) return { ok: true, value: undefined };
    if (value === null) return { ok: true, value: null };
    if (typeof value !== 'object') return { ok: false, message: 'coordinates must be an object' };

    const { latitude, longitude } = value;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return { ok: false, message: 'coordinates latitude/longitude must be numbers' };
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return { ok: false, message: 'coordinates are out of range' };
    }

    return { ok: true, value: { latitude, longitude } };
};

const buildSafeUpdatePayload = (input) => {
    const updates = {};

    if (Object.prototype.hasOwnProperty.call(input, 'username')) {
        if (!isNonEmptyString(input.username, 3, 36)) return { ok: false, message: 'Invalid username' };
        updates.username = input.username.trim();
    }

    if (Object.prototype.hasOwnProperty.call(input, 'email')) {
        if (!isNonEmptyString(input.email, 6, 255)) return { ok: false, message: 'Invalid email' };
        const email = input.email.trim().toLowerCase();
        if (!isValidEmail(email)) return { ok: false, message: 'Invalid email' };
        updates.email = email;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'pokemonGoName')) {
        const pokemonGoName = normalizeOptionalString(input.pokemonGoName, 64);
        if (input.pokemonGoName !== null && input.pokemonGoName !== undefined && !pokemonGoName) {
            return { ok: false, message: 'Invalid pokemonGoName' };
        }
        updates.pokemonGoName = pokemonGoName;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'trainerCode')) {
        const trainerCode = normalizeOptionalString(input.trainerCode, 12);
        if (trainerCode && !TRAINER_CODE_RE.test(trainerCode)) {
            return { ok: false, message: 'Invalid trainerCode' };
        }
        updates.trainerCode = trainerCode;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'password')) {
        if (typeof input.password !== 'string' || !PASSWORD_RE.test(input.password)) {
            return { ok: false, message: 'Password must contain 8+ characters, uppercase, lowercase, a number, and a symbol' };
        }
        updates.password = input.password;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'allowLocation')) {
        if (typeof input.allowLocation !== 'boolean') return { ok: false, message: 'allowLocation must be boolean' };
        updates.allowLocation = input.allowLocation;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'location')) {
        const location = normalizeOptionalString(input.location, 255);
        if (input.location !== null && input.location !== undefined && !location) {
            return { ok: false, message: 'Invalid location' };
        }
        updates.location = location;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'coordinates')) {
        const coordResult = parseCoordinates(input.coordinates);
        if (!coordResult.ok) return { ok: false, message: coordResult.message };
        updates.coordinates = coordResult.value;
    }

    return { ok: true, updates };
};

const verifySensitiveAction = async (req, user) => {
    if (user.password) {
        const currentPassword = typeof req.body?.currentPassword === 'string'
            ? req.body.currentPassword
            : '';
        if (!currentPassword || !await bcrypt.compare(currentPassword, user.password)) {
            return { ok: false, status: 401, message: 'Current password is required' };
        }
        return { ok: true };
    }

    const ageSeconds = Math.floor(Date.now() / 1000) - Number(req.auth?.issuedAt || 0);
    if (ageSeconds < 0 || ageSeconds > RECENT_AUTH_SECONDS) {
        return {
            ok: false,
            status: 401,
            message: 'Please sign in again before making this security change'
        };
    }
    return { ok: true };
};

const clearAuthCookies = (res) => {
    const options = { httpOnly: true, secure: true, sameSite: 'None' };
    res.clearCookie('accessToken', options);
    res.clearCookie('refreshToken', options);
};

// Function to handle token response more dynamically
function handleTokenResponse(req, res, user, tokens) {
    req.accessToken = tokens.accessToken;
    req.refreshToken = tokens.refreshToken;
    res.locals.user = user;
    res.locals.tokens = tokens;
}

router.post('/register', async (req, res, next) => {
    try {
        const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        const password = typeof req.body?.password === 'string' ? req.body.password : '';
        const device_id = typeof req.body?.device_id === 'string' ? req.body.device_id.trim() : '';
        const pokemonGoName = normalizeOptionalString(req.body?.pokemonGoName, 64);
        const trainerCode = normalizeOptionalString(req.body?.trainerCode, 12);
        const location = normalizeOptionalString(req.body?.location, 255);
        const allowLocation = req.body?.allowLocation === true;
        const coordResult = parseCoordinates(req.body?.coordinates);

        if (!isNonEmptyString(username, 3, 36)) {
            return res.status(400).json({ message: 'Invalid username' });
        }
        if (!isNonEmptyString(email, 6, 255) || !isValidEmail(email)) {
            return res.status(400).json({ message: 'Invalid email' });
        }
        if (!isNonEmptyString(password, 6, 128)) {
            return res.status(400).json({ message: 'Invalid password' });
        }
        if (!isNonEmptyString(device_id, 3, 128)) {
            return res.status(400).json({ message: 'Invalid device_id' });
        }
        if (req.body?.pokemonGoName !== undefined && req.body?.pokemonGoName !== null && !pokemonGoName) {
            return res.status(400).json({ message: 'Invalid pokemonGoName' });
        }
        if (trainerCode && !TRAINER_CODE_RE.test(trainerCode)) {
            return res.status(400).json({ message: 'Invalid trainerCode' });
        }
        if (req.body?.allowLocation !== undefined && typeof req.body.allowLocation !== 'boolean') {
            return res.status(400).json({ message: 'allowLocation must be boolean' });
        }
        if (req.body?.location !== undefined && req.body?.location !== null && !location) {
            return res.status(400).json({ message: 'Invalid location' });
        }
        if (!coordResult.ok) {
            return res.status(400).json({ message: coordResult.message });
        }

        // Check for existing unique fields
        if (await User.findOne({ username })) {
            logger.error(`Registration failed: Username "${username}" already exists with status 409`);
            return res.status(409).json({ message: 'Username already exists' });
        }

        if (await User.findOne({ email })) {
            logger.error(`Registration failed: Email "${email}" already exists with status 409`);
            return res.status(409).json({ message: 'Email already exists' });
        }

        if (pokemonGoName && await User.findOne({ pokemonGoName })) {
            logger.error(`Registration failed: Pokémon Go Name "${pokemonGoName}" already exists with status 409`);
            return res.status(409).json({ message: 'Pokémon Go name already exists' });
        }

        if (trainerCode && await User.findOne({ trainerCode })) {
            logger.error(`Registration failed: Trainer Code "${trainerCode}" already exists with status 409`);
            return res.status(409).json({ message: 'Trainer Code already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user instance
        const newUser = new User({
            username,
            email,
            pokemonGoName,
            trainerCode,
            password: hashedPassword,
            ...(coordResult.value !== undefined && { coordinates: coordResult.value }),
            allowLocation,
            location
        });

        // Save user with writeConcern for reliability
        const savedUser = await newUser.save({ writeConcern: { w: "majority" } });

        logger.debug(`User "${username}" saved successfully, attempting to create tokens.`);

        // Create tokens
        const tokens = tokenService.createTokens(savedUser, device_id);

        // Clean up expired tokens or duplicate device_id entries
        await User.findByIdAndUpdate(savedUser._id, {
            $pull: {
                'refreshToken': {
                    $or: [
                        { expires: { $lte: new Date() } },
                        { device_id }
                    ]
                }
            }
        });

        // Add the new refresh token
        await User.findByIdAndUpdate(savedUser._id, {
            $push: {
                refreshToken: {
                    tokenHash: hashRefreshToken(tokens.refreshToken),
                    expires: tokens.refreshTokenExpiry,
                    device_id
                }
            }
        });

        // Pass user and tokens to response middleware
        res.locals.user = savedUser;
        res.locals.tokens = tokens;
        next();
    } catch (err) {
        if (err.code === 11000) {
            // Handle duplicate key error
            const field = Object.keys(err.keyPattern)[0];
            logger.error(`Registration failed: Duplicate key error on field "${field}" with status 409`);
            return res.status(409).json({ message: `${field} already exists` });
        }
        logger.error(`Registration error: ${err.message} with status 500`);
        res.status(500).json({ message: 'Internal Server Error' });
    }
}, setCookies, (req, res) => {
    const { user, tokens } = res.locals;
    res.status(201).json({
        user: {
            username: user.username,
            email: user.email,
            location: user.location // Optionally include location in the response
        },
        message: 'Account created successfully.'
    });
    logger.info(`User "${user.username}" registered successfully with status 201`);
});

router.post('/login', async (req, res, next) => {
    try {
        const loginId = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
        const password = typeof req.body?.password === 'string' ? req.body.password : '';
        const device_id = typeof req.body?.device_id === 'string' ? req.body.device_id.trim() : '';

        if (!isNonEmptyString(loginId, 3, 255) || !isNonEmptyString(password, 6, 128) || !isNonEmptyString(device_id, 3, 128)) {
            return res.status(400).json({ message: 'Invalid login payload' });
        }

        const user = await User.findOne({
            $or: [
                { username: loginId },
                { email: loginId.toLowerCase() }
            ]
        }).exec();

        if (!user) {
            logger.warn('Login failed: Invalid credentials');
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const validPassword = Boolean(user.password) && await bcrypt.compare(password, user.password);
        if (!validPassword) {
            logger.warn('Login failed: Invalid credentials');
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Clean up expired refresh tokens and tokens with the same device_id before adding a new one
        await User.findByIdAndUpdate(user._id, {
            $pull: {
                'refreshToken': {
                    $or: [
                        { expires: { $lte: new Date() } },  // Remove expired tokens
                        { device_id: device_id }            // Remove tokens with the same device_id
                    ]
                }
            }
        });

        const tokens = tokenService.createTokens(user, device_id);

        // Update user with new refresh token details by adding to the array
        await User.findByIdAndUpdate(user._id, {
            $push: {'refreshToken': {
                tokenHash: hashRefreshToken(tokens.refreshToken),
                expires: tokens.refreshTokenExpiry,
                device_id: device_id
            }}
        });

        handleTokenResponse(req, res, user, tokens);
        next();
    } catch (err) {
        logger.error(`Login error: ${err.message} with status ${500}`);
        res.status(500).json({ message: 'Internal Server Error' });
    }
}, setCookies, (req, res) => {
    const { user, tokens } = res.locals;
    res.status(200).json({
        user_id: user._id.toString(),
        username: user.username,
        email: user.email,
        pokemonGoName: user.pokemonGoName,
        trainerCode: user.trainerCode,
        allowLocation: user.allowLocation,
        location: user.location,
        coordinates: user.coordinates,
        accessTokenExpiry: tokens.accessTokenExpiry.toISOString(),
        refreshTokenExpiry: tokens.refreshTokenExpiry.toISOString(),
        message: 'Logged in successfully'
    });
    logger.info(`User ${user.username} logged in successfully with status ${200}`);
});

router.post('/refresh', async (req, res, next) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
        logger.error('Refresh failed: No refresh token provided');
        return res.status(401).json({ message: 'Refresh token required' });
    }

    try {
        const now = new Date();
        const decodedRefresh = tokenService.verifyRefreshToken(refreshToken);
        if (!decodedRefresh || !decodedRefresh.user_id) {
            logger.error('Refresh failed: Invalid refresh token signature/claims');
            return res.status(401).json({ message: 'Invalid or expired refresh token' });
        }

        const refreshTokenHash = hashRefreshToken(refreshToken);

        const user = await User.findOne({
            refreshToken: {
                $elemMatch: {
                    expires: { $gt: now },
                    tokenHash: refreshTokenHash
                }
            }
        }).exec();

        if (!user) {
            logger.error('Refresh failed: Invalid or expired refresh token');
            return res.status(401).json({ message: 'Invalid or expired refresh token' });
        }

        if (String(user._id) !== String(decodedRefresh.user_id)) {
            logger.error('Refresh failed: Token subject mismatch');
            return res.status(401).json({ message: 'Invalid or expired refresh token' });
        }

        req.tokenIndex = user.refreshToken.findIndex(rt => {
            if (!rt || rt.expires <= now) return false;
            return rt.tokenHash === refreshTokenHash;
        });
        if (req.tokenIndex === -1 || user.refreshToken[req.tokenIndex].expires <= now) {
            logger.error('Refresh failed: Token not found or expired');
            return res.status(401).json({ message: 'Invalid or expired refresh token' });
        }

        const device_id = user.refreshToken[req.tokenIndex].device_id;  // Retrieve device_id from the stored refresh token

        logger.debug(`User ${user.username} found with valid refresh token. Rotating session tokens.`);

        user.refreshToken = user.refreshToken.filter(rt => {
            if (!rt || rt.expires <= now) return false;
            return rt.tokenHash !== refreshTokenHash;
        });

        const tokens = tokenService.createTokens(user, device_id);  // Rotate both access and refresh tokens
        user.refreshToken.push({
            tokenHash: hashRefreshToken(tokens.refreshToken),
            expires: tokens.refreshTokenExpiry,
            device_id
        });
        await user.save({ validateModifiedOnly: true });

        req.tokenIndex = user.refreshToken.length - 1;
        handleTokenResponse(req, res, user, tokens);
        next();
    } catch (err) {
        logger.error(`Refresh token error: ${err.message}`);
        res.status(500).json({ message: 'Failed to refresh tokens', error: err.toString() });
    }
}, setCookies, (req, res) => {
    const { user, tokens } = res.locals;
    res.status(200).json({
        user_id: user._id.toString(),
        username: user.username,
        email: user.email,
        pokemonGoName: user.pokemonGoName,
        trainerCode: user.trainerCode,
        allowLocation: user.allowLocation,
        location: user.location,
        coordinates: user.coordinates,
        accessTokenExpiry: tokens.accessTokenExpiry.toISOString(),
        refreshTokenExpiry: user.refreshToken[req.tokenIndex].expires.toISOString() // Now using req.tokenIndex
    });
    logger.info(`User ${user.username} refreshed token successfully with status ${200}`);
});

router.get('/account/security', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.auth.userId).lean();
        if (!user) return res.status(404).json({ message: 'User not found' });

        const providers = (user.identities || []).map((identity) => ({
            provider: identity.provider,
            email: identity.email || null,
            emailVerified: identity.emailVerified === true,
            linkedAt: identity.linkedAt || null
        }));
        return res.status(200).json({
            email: user.email,
            hasPassword: Boolean(user.password),
            providers,
            activeSessions: (user.refreshToken || []).filter(
                (session) => session.expires && new Date(session.expires) > new Date()
            ).length
        });
    } catch (err) {
        logger.error(`Account security lookup failed: ${err.message}`);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

router.post('/email-change', requireAuth, async (req, res) => {
    try {
        const email = typeof req.body?.email === 'string'
            ? req.body.email.trim().toLowerCase()
            : '';
        if (!isValidEmail(email)) {
            return res.status(400).json({ message: 'Invalid email' });
        }
        const user = await User.findById(req.auth.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (email === user.email) {
            return res.status(400).json({ message: 'That is already your account email' });
        }
        const verification = await verifySensitiveAction(req, user);
        if (!verification.ok) {
            return res.status(verification.status).json({ message: verification.message });
        }
        if (await User.exists({ email, _id: { $ne: user._id } })) {
            return res.status(409).json({ message: 'Email already exists' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        user.pendingEmail = email;
        user.emailChangeToken = crypto.createHash('sha256').update(token).digest('hex');
        user.emailChangeExpires = new Date(Date.now() + 30 * 60 * 1000);
        await user.save();

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const verifyUrl = `${frontendUrl.replace(/\/$/, '')}/verify-email-change?token=${encodeURIComponent(token)}`;
        try {
            await sendEmailChangeVerification({
                email,
                username: user.username,
                verifyUrl
            });
        } catch (emailError) {
            logger.error(`Email change delivery failed: ${emailError.message}`);
            user.pendingEmail = null;
            user.emailChangeToken = null;
            user.emailChangeExpires = null;
            await user.save();
            return res.status(503).json({ message: 'Could not send verification email' });
        }
        return res.status(202).json({ message: 'Verification email sent' });
    } catch (err) {
        logger.error(`Email change request failed: ${err.message}`);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

router.post('/email-change/confirm', async (req, res) => {
    try {
        const token = typeof req.body?.token === 'string' ? req.body.token : '';
        if (!/^[a-f0-9]{64}$/.test(token)) {
            return res.status(400).json({ message: 'Invalid or expired verification link' });
        }
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const user = await User.findOne({
            emailChangeToken: tokenHash,
            emailChangeExpires: { $gt: new Date() },
            pendingEmail: { $type: 'string' }
        });
        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired verification link' });
        }
        if (await User.exists({ email: user.pendingEmail, _id: { $ne: user._id } })) {
            return res.status(409).json({ message: 'Email already exists' });
        }
        const oldEmail = user.email;
        const newEmail = user.pendingEmail;
        user.email = newEmail;
        user.pendingEmail = null;
        user.emailChangeToken = null;
        user.emailChangeExpires = null;
        user.refreshToken = [];
        await user.save();
        clearAuthCookies(res);
        try {
            await sendEmailChangedNotice({
                email: oldEmail,
                username: user.username,
                newEmail
            });
        } catch (emailError) {
            logger.error(`Email change security notice failed: ${emailError.message}`);
        }
        return res.status(200).json({
            message: 'Email updated. Please sign in again with your new email.'
        });
    } catch (err) {
        logger.error(`Email change confirmation failed: ${err.message}`);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

router.post('/sessions/revoke-all', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.auth.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });
        const verification = await verifySensitiveAction(req, user);
        if (!verification.ok) {
            return res.status(verification.status).json({ message: verification.message });
        }
        user.refreshToken = [];
        await user.save();
        clearAuthCookies(res);
        return res.status(200).json({ message: 'All sessions have been signed out' });
    } catch (err) {
        logger.error(`Session revocation failed: ${err.message}`);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

router.delete('/account/identities/:provider', requireAuth, async (req, res) => {
    try {
        const provider = req.params.provider;
        if (!['google', 'discord', 'facebook'].includes(provider)) {
            return res.status(400).json({ message: 'Unsupported provider' });
        }
        const user = await User.findById(req.auth.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });
        const verification = await verifySensitiveAction(req, user);
        if (!verification.ok) {
            return res.status(verification.status).json({ message: verification.message });
        }
        const identityCount = user.identities?.length || 0;
        if (!user.password && identityCount <= 1) {
            return res.status(409).json({
                message: 'Add another sign-in method before disconnecting this account'
            });
        }
        const before = identityCount;
        user.identities = user.identities.filter(
            (identity) => identity.provider !== provider
        );
        if (user.identities.length === before) {
            return res.status(404).json({ message: 'Provider is not connected' });
        }
        user[`${provider}Id`] = null;
        await user.save();
        return res.status(200).json({ message: `${provider} disconnected` });
    } catch (err) {
        logger.error(`Provider unlink failed: ${err.message}`);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Update user details
router.put('/update/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    if (!id) {
        logger.error('No ID provided in the request parameters');
        return res.status(400).json({ success: false, message: 'Request must include an ID' });
    }

    if (req.auth.userId !== id) {
        logger.warn(`Update forbidden: token user ${req.auth.userId} attempted to update ${id}`);
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    try {
        // Fetch the current user
        const currentUser = await User.findById(id);
        if (!currentUser) {
            logger.error(`Update failed: User not found with ID: ${id} with status 404`);
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const updateResult = buildSafeUpdatePayload(req.body || {});
        if (!updateResult.ok) {
            return res.status(400).json({ success: false, message: updateResult.message });
        }

        const updates = updateResult.updates;
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, message: 'No valid fields to update' });
        }
        if (updates.email && updates.email !== currentUser.email) {
            return res.status(400).json({
                success: false,
                message: 'Email changes must be verified using the email-change flow'
            });
        }

        const changesSensitiveIdentity =
            Boolean(updates.password);
        if (changesSensitiveIdentity) {
            const verification = await verifySensitiveAction(req, currentUser);
            if (!verification.ok) {
                return res.status(verification.status).json({
                    success: false,
                    message: verification.message
                });
            }
        }

        // Initialize password update flag
        let passwordUpdated = false;

        // Handle password update
        if (updates.password && updates.password.trim() !== "") {
            const isSamePassword = Boolean(currentUser.password) &&
                await bcrypt.compare(updates.password, currentUser.password);
            if (isSamePassword) {
                // Password is identical; do not update
                logger.info('New password is identical to the current password. Skipping password update.');
                delete updates.password;
            } else {
                // Hash the new password
                updates.password = await bcrypt.hash(updates.password, 10);
                passwordUpdated = true;
            }
        } else {
            delete updates.password;
        }

        // Validation checks for unique fields
        const uniqueFields = [
            { field: 'username', message: 'Username already exists' },
            { field: 'email', message: 'Email already exists' },
            { field: 'pokemonGoName', message: 'Pokémon Go name already exists' },
            { field: 'trainerCode', message: 'Trainer Code already exists' }
        ];

        for (let { field, message } of uniqueFields) {
            if (updates[field]) {
                const query = { [field]: updates[field], _id: { $ne: id } };
                const existingUser = await User.findOne(query);
                if (existingUser) {
                    logger.error(`Update failed: ${message} with status 409`);
                    return res.status(409).json({ success: false, message });
                }
            }
        }

        // Sanitize updates before logging
        const sanitizedUpdates = sanitizeForLogging(updates, ['password', 'confirmPassword']);
        logger.info(`Updating user details for User ID: ${id} with data: ${JSON.stringify(sanitizedUpdates)}`);

        // Perform the update
        const updatedUser = await User.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
        if (!updatedUser) {
            logger.error(`Update failed: User not found with ID: ${id} with status 404`);
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        if (passwordUpdated) {
            updatedUser.refreshToken = [];
            await updatedUser.save({ validateModifiedOnly: true });
            clearAuthCookies(res);
        }

        logger.info(`User ${updatedUser.username} updated successfully with status 200`);

        // Prepare the response payload
        const responsePayload = {
            success: true,
            data: { // Changed from 'user' to 'data'
                user_id: updatedUser._id.toString(),
                username: updatedUser.username,
                email: updatedUser.email,
                pokemonGoName: updatedUser.pokemonGoName || '',
                trainerCode: updatedUser.trainerCode || '',
                allowLocation: updatedUser.allowLocation || false,
                location: updatedUser.location || '',
                coordinates: updatedUser.coordinates || ''
            },
            passwordUpdated, // Indicates if the password was changed
            message: passwordUpdated
                ? 'Updated account details successfully'
                : 'Account details updated. Password was not changed as it is identical to the previous one.'
        };        

        res.status(200).json(responsePayload);
    } catch (err) {
        logger.error(`Unhandled exception on user update for ID: ${id}: ${err} with status 500`);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.delete('/delete/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    if (req.auth.userId !== id) {
        logger.warn(`Delete forbidden: token user ${req.auth.userId} attempted to delete ${id}`);
        return res.status(403).json({ message: 'Forbidden' });
    }

    try {
        const currentUser = await User.findById(id);
        if (!currentUser) {
            logger.error(`Delete failed: User not found with ID: ${id}`);
            return res.status(404).json({ message: 'User not found' });
        }
        const verification = await verifySensitiveAction(req, currentUser);
        if (!verification.ok) {
            return res.status(verification.status).json({ message: verification.message });
        }
        const user = await User.findByIdAndDelete(id);
        if (!user) {
            logger.error(`Delete failed: User not found with ID: ${id}`);
            return res.status(404).json({ message: 'User not found' });
        }
        clearAuthCookies(res);
        logger.info(`User ${user.username} with ID ${id} deleted successfully with status ${200}`);
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (err) {
        logger.error(`Unhandled exception on user delete for ID: ${id}: ${err} with status ${500}`);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

router.post('/logout', async (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        logger.error('Logout failed: No refresh token provided');
        return res.status(401).json({ message: 'No refresh token provided' });
    }

    try {
        const refreshTokenHash = hashRefreshToken(refreshToken);
        const user = await User.findOneAndUpdate(
            {
                refreshToken: {
                    $elemMatch: {
                        tokenHash: refreshTokenHash
                    }
                }
            },
            {
                $pull: {
                    refreshToken: {
                        tokenHash: refreshTokenHash
                    }
                }
            }
        );

        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');

        if (user) {
            logger.info(`User ${user.username} logged out successfully with status ${200}`);
        } else {
            logger.warn('Logout attempt failed: User not found');
        }

        res.status(200).json({ message: 'Logged out successfully' });
    } catch (err) {
        logger.error(`Logout error: ${err.message} with status ${500}`);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

router.post('/reset-password', async (req, res) => {
    const genericMessage = 'If an account matches that information, a password reset email has been sent.';
    const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier.trim() : '';
    if (!isNonEmptyString(identifier, 3, 255)) return res.status(202).json({ message: genericMessage });

    try {
        const user = await User.findOne({
            $or: [{ username: identifier }, { email: identifier.toLowerCase() }]
        });
        if (user?.email) {
            const token = crypto.randomBytes(32).toString('hex');
            user.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
            user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);
            await user.save({ validateModifiedOnly: true });
            const frontendOrigin = process.env.FRONTEND_URL || 'https://pokegonexus.com';
            await sendPasswordResetEmail({
                email: user.email,
                username: user.username,
                resetUrl: `${frontendOrigin}/reset-password?token=${encodeURIComponent(token)}`
            });
        }
    } catch (error) {
        logger.error(`Password reset request failed: ${error.message}`);
    }
    return res.status(202).json({ message: genericMessage });
});

router.post('/reset-password/confirm', async (req, res) => {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!/^[a-f0-9]{64}$/.test(token) ||
        password.length < 8 || password.length > 128 ||
        !/[a-z]/.test(password) || !/[A-Z]/.test(password) ||
        !/\d/.test(password) || !/[^A-Za-z\d]/.test(password)) {
        return res.status(400).json({ message: 'Invalid or expired reset link, or password does not meet requirements.' });
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
        resetPasswordToken: tokenHash,
        resetPasswordExpires: { $gt: new Date() }
    });
    if (!user) return res.status(400).json({ message: 'This password reset link is invalid or has expired.' });

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    user.refreshToken = [];
    await user.save({ validateModifiedOnly: true });
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return res.status(200).json({ message: 'Password updated. Please sign in with your new password.' });
});

module.exports = router;
