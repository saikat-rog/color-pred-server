// User related types
export interface User {
  id: number;
  phoneNumber: string;
  password: string;
  isVerified: boolean;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRegistration {
  phoneNumber: string;
  password: string;
}

export interface UserLogin {
  phoneNumber: string;
  password: string;
}

// OTP related types
export interface OTPSession {
  id: number;
  phoneNumber: string;
  otp: string;
  expiresAt: Date;
  attempts: number;
  isUsed: boolean;
  createdAt: Date;
}

export interface OTPVerification {
  phoneNumber: string;
  otp: string;
}

export interface OTPResponse {
  Status: string;
  Details: string;
  OTP?: string;
}

// Auth response types
export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user?: Omit<User, 'password'>;
    token?: string;
    refreshToken?: string;
  };
}

export interface SignupResponse {
  success: boolean;
  message: string;
  data?: {
    phoneNumber: string;
    otpSent: boolean;
  };
}

// JWT payload
export interface JWTPayload {
  userId: number;
  phoneNumber: string;
  iat?: number;
  exp?: number;
}

// Request extensions
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}