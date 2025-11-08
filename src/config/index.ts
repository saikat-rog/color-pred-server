import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-key',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  twoFactor: {
    apiKey: process.env.TWOFACTOR_API_KEY || '',
  },
  
  otp: {
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10),
    maxAttempts: parseInt(process.env.MAX_OTP_ATTEMPTS || '3', 10),
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || '5', 10),
  },
  
  security: {
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  },

  bondpay: {
    merchantId: process.env.GATEWAY_BONDPAY_MERCHANT_ID || '',
    apiUrl: process.env.GATEWAY_BONDPAY_API_URL || '',
    apiKey: process.env.GATEWAY_BONDPAY_API_KEY || '',
    callbackUrl: process.env.GATEWAY_BONDPAY_CALLBACK_URL || '',
  },
};