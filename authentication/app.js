// app.js

const dotenv = require('dotenv');
dotenv.config({ quiet: true });

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const logger = require('./middlewares/logger');
const csrfOriginGuard = require('./middlewares/csrfOriginGuard');
const { httpMetricsMiddleware, metricsHandler } = require('./metrics/http');
const cron = require('node-cron');
const createBackup = require('./tasks/backup');
const isTest = process.env.NODE_ENV === 'test';

const appConfigPath = path.join(__dirname, 'config', 'app_conf.yml');
const appConfigContent = fs.readFileSync(appConfigPath, 'utf8');
const appConfig = yaml.load(appConfigContent) || {};

const openAPIPath = path.join(__dirname, 'config', 'openapi.yml');
const openAPIContent = fs.readFileSync(openAPIPath, 'utf8');
const swaggerDocument = yaml.load(openAPIContent);

const app = express();

const requiredEnv = ['DATABASE_URL', 'JWT_SECRET'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

// Schedule daily DB backup.
if (!isTest) {
  cron.schedule('0 0 * * *', () => {
    logger.info('Running daily database backup...');
    createBackup();
  });
}

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// JSON, cookies, proxy.
app.use(express.json());
app.use(cookieParser());
app.set('trust proxy', 'loopback, linklocal, uniquelocal');

const configuredFrontendOrigin = process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [];
const allowedOrigins = Array.from(
  new Set([
    ...configuredFrontendOrigin,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://pokegonexus.com',
    'https://www.pokegonexus.com'
  ])
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        const err = new Error('CORS not allowed for this origin');
        err.status = 403;
        callback(err);
      }
    },
    credentials: true,
    optionsSuccessStatus: 200
  })
);

app.use(helmet());

const quietRequestLogPaths = new Set(['/metrics', '/healthz', '/readyz']);
app.use((req, res, next) => {
  if (!quietRequestLogPaths.has(req.path)) {
    logger.info(`${req.method} ${req.url}`);
  }
  next();
});
app.use(httpMetricsMiddleware);

const mongoConnectionPromise = mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => logger.info('Connected to Database'))
  .catch(error => {
    logger.error(`Connection error: ${error.message}`);
    throw error;
  });

app.get('/healthz', (req, res) => {
  res.status(200).json({ ok: true });
});

app.get('/readyz', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ ok: false, message: 'db not connected' });
  }

  try {
    await mongoose.connection.db.admin().ping();
    return res.status(200).json({ ok: true });
  } catch (err) {
    logger.error(`Readiness check failed: ${err.message}`);
    return res.status(503).json({ ok: false, message: 'db not ready' });
  }
});

app.get('/metrics', metricsHandler);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 100,
  standardHeaders: true,
  legacyHeaders: false
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false
});
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false
});
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 5,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/auth', limiter);
app.use('/auth/login', loginLimiter);
app.use('/auth/mobile/login', loginLimiter);
app.use('/auth/register', registerLimiter);
app.use('/auth/google/complete-registration', registerLimiter);
app.use('/auth/discord/complete-registration', registerLimiter);
app.use('/auth/facebook/complete-registration', registerLimiter);
app.use('/auth/reset-password', passwordResetLimiter);
app.use('/auth', csrfOriginGuard(allowedOrigins));

app.use('/auth', require('./routes/authRoute'));
app.use('/auth', require('./routes/mobileSessionRoutes'));
app.use('/auth', require('./routes/nativeOAuthLinkRoutes'));
app.use('/auth', require('./routes/passportRoutes'));

function startServer() {
  const port = appConfig.app?.port || 3002;
  return app.listen(port, () => logger.info(`Auth-service listening on ${port}`));
}

if (require.main === module) {
  startServer();
}

app.use((err, req, res, next) => {
  logger.error(`Unhandled Error: ${err.message || err}`);
  const status = err.status || 500;
  res.status(status).send({ message: status === 500 ? 'Internal Server Error' : err.message });
});

module.exports = {
  app,
  startServer,
  mongoConnectionPromise
};
