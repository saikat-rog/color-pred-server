import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { otpService } from '../services/otpService';
import { databaseService } from '../services/databaseService';
import { 
  User, 
  UserRegistration, 
  UserLogin, 
  OTPVerification, 
  AuthResponse, 
  SignupResponse,
  JWTPayload 
} from '../types';

class AuthController {
  /**
   * Step 1: Initiate signup process by sending OTP
   */
  async initiateSignup(req: Request, res: Response): Promise<void> {
    try {
      const { phoneNumber }: { phoneNumber: string } = req.body;

      if (!phoneNumber) {
        res.status(400).json({
          success: false,
          message: 'Phone number is required'
        });
        return;
      }

      // Clean and validate phone number
      const cleanPhone = this.cleanPhoneNumber(phoneNumber);
      if (!this.isValidPhoneNumber(cleanPhone)) {
        res.status(400).json({
          success: false,
          message: 'Please enter a valid 10-digit Indian mobile number'
        });
        return;
      }

      // Check if user already exists in database
      const existingUser = await databaseService.findUserByPhone(cleanPhone);
      if (existingUser) {
        res.status(409).json({
          success: false,
          message: 'Account already exists with this phone number. Please login instead.',
          data: {
            canLogin: true
          }
        });
        return;
      }

      // Send OTP using cleaned phone number
      const otpResult = await otpService.sendOTP(cleanPhone);
      
      if (!otpResult.success) {
        res.status(400).json({
          success: false,
          message: otpResult.message
        });
        return;
      }

      const response: SignupResponse = {
        success: true,
        message: 'OTP sent successfully',
        data: {
          phoneNumber: cleanPhone,
          otpSent: true
        }
      };

      // Include OTP in development mode
      if (config.nodeEnv === 'development' && otpResult.otp) {
        (response.data as any).otp = otpResult.otp;
      }

      res.status(200).json(response);
    } catch (error) {
      console.error('Error in initiateSignup:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Step 2: Complete signup by verifying OTP and setting password
   */
  async completeSignup(req: Request, res: Response): Promise<void> {
    try {
      const { phoneNumber, otp, password }: UserRegistration & { otp: string } = req.body;

      if (!phoneNumber || !otp || !password) {
        res.status(400).json({
          success: false,
          message: 'Phone number, OTP, and password are required'
        });
        return;
      }

      // Clean and validate phone number
      const cleanPhone = this.cleanPhoneNumber(phoneNumber);
      if (!this.isValidPhoneNumber(cleanPhone)) {
        res.status(400).json({
          success: false,
          message: 'Please enter a valid 10-digit Indian mobile number'
        });
        return;
      }

      // Validate password strength
      if (!this.isValidPassword(password)) {
        res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long and contain at least one number'
        });
        return;
      }

      // Verify OTP using database service
      const otpVerification = await databaseService.verifyOTP(cleanPhone, otp);
      if (!otpVerification.success) {
        res.status(400).json({
          success: false,
          message: otpVerification.message
        });
        return;
      }

      // Double-check if user already exists (prevent race condition)
      const existingUser = await databaseService.findUserByPhone(cleanPhone);
      if (existingUser) {
        res.status(409).json({
          success: false,
          message: 'Account already exists with this phone number. Please login instead.',
          data: {
            canLogin: true
          }
        });
        return;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, config.security.bcryptSaltRounds);

      // Create user in database
      const user = await databaseService.createUser({
        phoneNumber: cleanPhone,
        password: hashedPassword,
        isVerified: true,
        balance: 0
      });

      // Generate tokens
      const { accessToken, refreshToken } = this.generateTokens(user);
      
      // Store refresh token in database
      await databaseService.createRefreshToken({
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });

      const response: AuthResponse = {
        success: true,
        message: 'Registration completed successfully',
        data: {
          user: this.sanitizeUser(user),
          token: accessToken,
          refreshToken: refreshToken
        }
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error in completeSignup:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Login user
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { phoneNumber, password }: UserLogin = req.body;

      if (!phoneNumber || !password) {
        res.status(400).json({
          success: false,
          message: 'Phone number and password are required'
        });
        return;
      }

      // Clean phone number and find user in database
      const cleanPhone = this.cleanPhoneNumber(phoneNumber);
      const user = await databaseService.findUserByPhone(cleanPhone);
      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Invalid phone number or password'
        });
        return;
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          message: 'Invalid phone number or password'
        });
        return;
      }

      if (!user.isVerified) {
        res.status(401).json({
          success: false,
          message: 'Account not verified. Please complete registration.'
        });
        return;
      }

      // Generate tokens
      const { accessToken, refreshToken } = this.generateTokens(user);
      
      // Store refresh token in database
      await databaseService.createRefreshToken({
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });

      const response: AuthResponse = {
        success: true,
        message: 'Login successful',
        data: {
          user: this.sanitizeUser(user),
          token: accessToken,
          refreshToken: refreshToken
        }
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error in login:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken }: { refreshToken: string } = req.body;

      if (!refreshToken) {
        res.status(401).json({
          success: false,
          message: 'Refresh token is required'
        });
        return;
      }

      // Check if refresh token exists in database
      const tokenRecord = await databaseService.findRefreshToken(refreshToken);
      if (!tokenRecord) {
        res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
        return;
      }

      try {
        const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret as string) as JWTPayload;
        const user = await databaseService.findUserById(tokenRecord.userId);

        if (!user) {
          await databaseService.deleteRefreshToken(refreshToken);
          res.status(401).json({
            success: false,
            message: 'User not found'
          });
          return;
        }

        // Generate new tokens
        const { accessToken, refreshToken: newRefreshToken } = this.generateTokens(user);
        
        // Remove old refresh token and add new one
        await databaseService.deleteRefreshToken(refreshToken);
        await databaseService.createRefreshToken({
          token: newRefreshToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        });

        res.status(200).json({
          success: true,
          message: 'Token refreshed successfully',
          data: {
            token: accessToken,
            refreshToken: newRefreshToken
          }
        });
      } catch (jwtError) {
        await databaseService.deleteRefreshToken(refreshToken);
        res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }
    } catch (error) {
      console.error('Error in refreshToken:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Logout user
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken }: { refreshToken: string } = req.body;

      if (refreshToken) {
        await databaseService.deleteRefreshToken(refreshToken);
      }

      res.status(200).json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      console.error('Error in logout:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const user = await databaseService.findUserByPhone(req.user!.phoneNumber);
      
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          user: this.sanitizeUser(user)
        }
      });
    } catch (error) {
      console.error('Error in getProfile:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Helper methods
  private cleanPhoneNumber(phoneNumber: string): string {
    let cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      cleaned = cleaned.substring(2);
    }
    return cleaned;
  }

  private isValidPhoneNumber(phoneNumber: string): boolean {
    // Indian mobile number: 10 digits starting with 6, 7, 8, or 9
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phoneNumber);
  }

  private generateTokens(user: any): { accessToken: string; refreshToken: string } {
    const payload: JWTPayload = {
      userId: user.id,
      phoneNumber: user.phoneNumber
    };

    const accessToken = jwt.sign(
      payload, 
      config.jwt.secret as string, 
      { expiresIn: config.jwt.expiresIn as string } as jwt.SignOptions
    );

    const refreshToken = jwt.sign(
      payload, 
      config.jwt.refreshSecret as string, 
      { expiresIn: config.jwt.refreshExpiresIn as string } as jwt.SignOptions
    );

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: any): Omit<any, 'password'> {
    const { password, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  private isValidPassword(password: string): boolean {
    // At least 8 characters, at least one number
    const passwordRegex = /^(?=.*\d).{8,}$/;
    return passwordRegex.test(password);
  }
}

export const authController = new AuthController();