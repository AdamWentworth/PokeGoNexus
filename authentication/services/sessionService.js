const tokenService = require('./tokenService');
const { hashRefreshToken } = require('../utils/refreshTokenHash');

class SessionError extends Error {
    constructor(message, status = 401) {
        super(message);
        this.name = 'SessionError';
        this.status = status;
    }
}

async function createSession(User, user, deviceId) {
    const now = new Date();
    const tokens = tokenService.createTokens(user, deviceId);

    await User.findByIdAndUpdate(user._id, {
        $pull: {
            refreshToken: {
                $or: [
                    { expires: { $lte: now } },
                    { device_id: deviceId }
                ]
            }
        }
    });
    await User.findByIdAndUpdate(user._id, {
        $push: {
            refreshToken: {
                tokenHash: hashRefreshToken(tokens.refreshToken),
                expires: tokens.refreshTokenExpiry,
                device_id: deviceId
            }
        }
    });

    return tokens;
}

async function rotateSession(User, refreshToken) {
    const decodedRefresh = tokenService.verifyRefreshToken(refreshToken);
    if (!decodedRefresh?.user_id) {
        throw new SessionError('Invalid or expired refresh token');
    }

    const now = new Date();
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const user = await User.findOne({
        _id: decodedRefresh.user_id,
        refreshToken: {
            $elemMatch: {
                expires: { $gt: now },
                tokenHash: refreshTokenHash
            }
        }
    }).exec();

    if (!user) {
        throw new SessionError('Invalid or expired refresh token');
    }

    const session = user.refreshToken.find((candidate) => (
        candidate
        && candidate.expires > now
        && candidate.tokenHash === refreshTokenHash
    ));
    if (!session?.device_id) {
        throw new SessionError('Invalid or expired refresh token');
    }

    const tokens = tokenService.createTokens(user, session.device_id);
    user.refreshToken = user.refreshToken.filter((candidate) => (
        candidate
        && candidate.expires > now
        && candidate.tokenHash !== refreshTokenHash
    ));
    user.refreshToken.push({
        tokenHash: hashRefreshToken(tokens.refreshToken),
        expires: tokens.refreshTokenExpiry,
        device_id: session.device_id
    });
    await user.save({ validateModifiedOnly: true });

    return { user, tokens };
}

async function revokeSession(User, refreshToken) {
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const user = await User.findOneAndUpdate(
        {
            refreshToken: {
                $elemMatch: { tokenHash: refreshTokenHash }
            }
        },
        {
            $pull: {
                refreshToken: { tokenHash: refreshTokenHash }
            }
        }
    );

    return Boolean(user);
}

module.exports = {
    SessionError,
    createSession,
    rotateSession,
    revokeSession
};
