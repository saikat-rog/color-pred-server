import axios from 'axios';
import { config } from '../config';
import { OTPResponse } from '../types';
import { databaseService } from './databaseService';

class OTPService {
  /**
   * Send OTP using 2factor.in API
   */
  async sendOTP(phoneNumber: string, method: 'SMS' | 'VOICE' = 'SMS'): Promise<{ success: boolean; message: string; otp?: string }> {
    try {
      // Clean phone number (remove +91 if present, ensure 10 digits)
      const cleanPhoneNumber = this.cleanPhoneNumber(phoneNumber);
      
      if (!this.isValidPhoneNumber(cleanPhoneNumber)) {
        return {
          success: false,
          message: 'Invalid phone number format'
        };
      }

      // Check if recent OTP exists and is still valid
      const existingSession = await databaseService.findActiveOTPSession(cleanPhoneNumber);
      if (existingSession) {
        return {
          success: false,
          message: 'OTP already sent. Please wait before requesting a new one.'
        };
      }

      // Generate OTP
      const otp = this.generateOTP();
      
      // Send OTP via 2factor.in
      const response = await axios.get(
        `https://2factor.in/API/V1/${config.twoFactor.apiKey}/${method}/${cleanPhoneNumber}/${otp}/ColorPrediction`
      );

      const otpResponse: OTPResponse = response.data;

      if (otpResponse.Status === 'Success') {
        // Store OTP session in database
        await databaseService.createOTPSession({
          phoneNumber: cleanPhoneNumber,
          otp: otp,
          expiresAt: new Date(Date.now() + config.otp.expiryMinutes * 60 * 1000)
        });

        const result: { success: boolean; message: string; otp?: string } = {
          success: true,
          message: 'OTP sent successfully'
        };

        // Only include OTP in development
        if (config.nodeEnv === 'development') {
          result.otp = otp;
        }

        return result;
      } else {
        return {
          success: false,
          message: 'Failed to send OTP. Please try again.'
        };
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      return {
        success: false,
        message: 'Failed to send OTP. Please try again.'
      };
    }
  }

  /**
   * Verify OTP - now delegated to database service
   */
  async verifyOTP(phoneNumber: string, otp: string): Promise<{ success: boolean; message: string }> {
    const cleanPhoneNumber = this.cleanPhoneNumber(phoneNumber);
    return await databaseService.verifyOTP(cleanPhoneNumber, otp);
  }

  /**
   * Generate 6-digit OTP
   */
  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Clean phone number format
   */
  private cleanPhoneNumber(phoneNumber: string): string {
    // Remove all non-digits
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Remove country code if present
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      cleaned = cleaned.substring(2);
    }
    
    return cleaned;
  }

  /**
   * Validate phone number format (Indian mobile numbers)
   */
  private isValidPhoneNumber(phoneNumber: string): boolean {
    // Indian mobile number: 10 digits starting with 6, 7, 8, or 9
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phoneNumber);
  }
}

// Create service instance
const otpService = new OTPService();

export { otpService };