import { Request, Response } from 'express';
import { databaseService } from '../services/databaseService';

class UserController {
  /**
   * Update user profile
   */
  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const { phoneNumber, ...updateData } = req.body;
      
      // Don't allow updating phone number through this endpoint
      if (phoneNumber) {
        res.status(400).json({
          success: false,
          message: 'Phone number cannot be updated through this endpoint'
        });
        return;
      }

      const updatedUser = await databaseService.updateUser(userId, updateData);
      const sanitizedUser = this.sanitizeUser(updatedUser);

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: sanitizedUser
      });

    } catch (error) {
      console.error('Error in updateProfile:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Bank Account Management Methods

  /**
   * Get user's bank accounts
   */
  async getBankAccounts(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const bankAccounts = await databaseService.getUserBankAccounts(userId);

      res.status(200).json({
        success: true,
        message: 'Bank accounts retrieved successfully',
        data: bankAccounts
      });

    } catch (error) {
      console.error('Error in getBankAccounts:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Add new bank account
   */
  async addBankAccount(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const { accountNumber, accountName, ifscCode, upiId, isDefault } = req.body;

      // Validation
      if (!accountNumber || !accountName || !ifscCode) {
        res.status(400).json({
          success: false,
          message: 'Account number, account name, and IFSC code are required'
        });
        return;
      }

      // Validate account number (basic validation)
      if (!/^\d{9,18}$/.test(accountNumber)) {
        res.status(400).json({
          success: false,
          message: 'Invalid account number format'
        });
        return;
      }

      // Validate IFSC code
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
        res.status(400).json({
          success: false,
          message: 'Invalid IFSC code format'
        });
        return;
      }

      const bankAccount = await databaseService.createBankAccount({
        userId,
        accountNumber,
        accountName,
        ifscCode,
        upiId,
        isDefault: isDefault || false
      });

      res.status(201).json({
        success: true,
        message: 'Bank account added successfully',
        data: bankAccount
      });

    } catch (error) {
      console.error('Error in addBankAccount:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Update bank account
   */
  async updateBankAccount(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const bankAccountId = parseInt(req.params.id || '0');

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      if (isNaN(bankAccountId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid bank account ID'
        });
        return;
      }

      // Check if bank account exists and belongs to user
      const existingAccount = await databaseService.findBankAccountByIdAndUser(bankAccountId, userId);
      if (!existingAccount) {
        res.status(404).json({
          success: false,
          message: 'Bank account not found or does not belong to you'
        });
        return;
      }

      const { accountNumber, accountName, ifscCode, upiId, isDefault } = req.body;
      const updateData: any = {};

      // Build update object with only provided fields
      if (accountNumber !== undefined) {
        if (!/^\d{9,18}$/.test(accountNumber)) {
          res.status(400).json({
            success: false,
            message: 'Invalid account number format'
          });
          return;
        }
        updateData.accountNumber = accountNumber;
      }

      if (accountName !== undefined) updateData.accountName = accountName;
      
      if (ifscCode !== undefined) {
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
          res.status(400).json({
            success: false,
            message: 'Invalid IFSC code format'
          });
          return;
        }
        updateData.ifscCode = ifscCode;
      }

      if (upiId !== undefined) updateData.upiId = upiId;
      if (isDefault !== undefined) updateData.isDefault = isDefault;

      const updatedAccount = await databaseService.updateBankAccount(bankAccountId, userId, updateData);

      res.status(200).json({
        success: true,
        message: 'Bank account updated successfully',
        data: updatedAccount
      });

    } catch (error) {
      console.error('Error in updateBankAccount:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Delete bank account
   */
  async deleteBankAccount(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const bankAccountId = parseInt(req.params.id || '0');

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      if (isNaN(bankAccountId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid bank account ID'
        });
        return;
      }

      // Check if bank account exists and belongs to user
      const bankAccount = await databaseService.findBankAccountByIdAndUser(bankAccountId, userId);
      if (!bankAccount) {
        res.status(404).json({
          success: false,
          message: 'Bank account not found or does not belong to you'
        });
        return;
      }

      await databaseService.deleteBankAccount(bankAccountId);

      res.status(200).json({
        success: true,
        message: 'Bank account deleted successfully'
      });

    } catch (error) {
      console.error('Error in deleteBankAccount:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  private sanitizeUser(user: any): Omit<any, 'password'> {
    const { password, ...sanitizedUser } = user;
    return sanitizedUser;
  }
}

export const userController = new UserController();