import { PrismaClient } from '../generated/prisma';
import { User, OTPSession, RefreshToken } from '../generated/prisma';

class DatabaseService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  // Initialize database connection
  async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      console.log('✅ Connected to PostgreSQL database');
    } catch (error) {
      console.error('❌ Failed to connect to database:', error);
      throw error;
    }
  }

  // Disconnect from database
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  // User operations
  async createUser(data: {
    phoneNumber: string;
    password: string;
    isVerified?: boolean;
    balance?: number;
    referredById?: number;
  }): Promise<User> {
    const userData: any = {
      phoneNumber: data.phoneNumber,
      password: data.password,
      isVerified: data.isVerified ?? false,
      balance: data.balance ?? 0,
    };

    if (data.referredById !== undefined) {
      userData.referredById = data.referredById;
    }

    return await this.prisma.user.create({
      data: userData,
    });
  }

  async findUserByPhone(phoneNumber: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: {
        phoneNumber,
      },
    });
  }

  async findUserById(id: number): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: {
        id,
      },
    });
  }

  async findUserByIdWithIncludes(id: number, includeOptions: any = {}): Promise<any> {
    return await this.prisma.user.findUnique({
      where: {
        id,
      },
      include: includeOptions,
    });
  }

  async updateUser(id: number, data: Partial<User>): Promise<User> {
    return await this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async deleteUser(id: number): Promise<User> {
    return await this.prisma.user.delete({
      where: { id },
    });
  }

  // OTP Session operations
  async createOTPSession(data: {
    phoneNumber: string;
    otp: string;
    expiresAt: Date;
  }): Promise<OTPSession> {
    // First, delete any existing OTP sessions for this phone number
    await this.prisma.oTPSession.deleteMany({
      where: {
        phoneNumber: data.phoneNumber,
      },
    });

    return await this.prisma.oTPSession.create({
      data,
    });
  }

  async findActiveOTPSession(phoneNumber: string): Promise<OTPSession | null> {
    return await this.prisma.oTPSession.findFirst({
      where: {
        phoneNumber,
        expiresAt: {
          gt: new Date(),
        },
        isUsed: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateOTPSession(id: number, data: Partial<OTPSession>): Promise<OTPSession> {
    return await this.prisma.oTPSession.update({
      where: { id },
      data,
    });
  }

  async verifyOTP(phoneNumber: string, otp: string): Promise<{
    success: boolean;
    message: string;
    session?: OTPSession;
  }> {
    const session = await this.findActiveOTPSession(phoneNumber);

    if (!session) {
      return {
        success: false,
        message: 'No active OTP session found. Please request a new OTP.',
      };
    }

    if (session.isUsed) {
      return {
        success: false,
        message: 'OTP has already been used.',
      };
    }

    if (new Date() > session.expiresAt) {
      await this.prisma.oTPSession.delete({ where: { id: session.id } });
      return {
        success: false,
        message: 'OTP has expired. Please request a new one.',
      };
    }

    if (session.attempts >= 3) {
      await this.prisma.oTPSession.delete({ where: { id: session.id } });
      return {
        success: false,
        message: 'Maximum OTP attempts exceeded. Please request a new OTP.',
      };
    }

    // Increment attempts
    await this.updateOTPSession(session.id, {
      attempts: session.attempts + 1,
    });

    if (session.otp !== otp) {
      return {
        success: false,
        message: `Invalid OTP. ${3 - (session.attempts + 1)} attempts remaining.`,
      };
    }

    // Mark as used
    const updatedSession = await this.updateOTPSession(session.id, {
      isUsed: true,
    });

    return {
      success: true,
      message: 'OTP verified successfully',
      session: updatedSession,
    };
  }

  // Clean up expired OTP sessions
  async cleanupExpiredOTPSessions(): Promise<number> {
    const result = await this.prisma.oTPSession.deleteMany({
      where: {
        OR: [
          {
            expiresAt: {
              lt: new Date(),
            },
          },
          {
            isUsed: true,
          },
        ],
      },
    });

    return result.count;
  }

  // Refresh Token operations
  async createRefreshToken(data: {
    token: string;
    userId: number;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    return await this.prisma.refreshToken.create({
      data,
    });
  }

  async findRefreshToken(token: string): Promise<RefreshToken | null> {
    return await this.prisma.refreshToken.findUnique({
      where: {
        token,
      },
    });
  }

  async deleteRefreshToken(token: string): Promise<RefreshToken | null> {
    try {
      return await this.prisma.refreshToken.delete({
        where: {
          token,
        },
      });
    } catch (error) {
      return null;
    }
  }

  async deleteExpiredRefreshTokens(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }

  async deleteUserRefreshTokens(userId: number): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        userId,
      },
    });

    return result.count;
  }

  // Utility methods
  async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      return false;
    }
  }

  // Bank Account operations
  async getUserBankAccounts(userId: number): Promise<any[]> {
    return await this.prisma.bankAccount.findMany({
      where: {
        userId,
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'asc' }
      ]
    });
  }

  async createBankAccount(data: {
    userId: number;
    accountNumber: string;
    accountName: string;
    ifscCode: string;
    upiId?: string;
    isDefault?: boolean;
  }): Promise<any> {
    // If this is being set as default, unset other defaults first
    if (data.isDefault) {
      await this.prisma.bankAccount.updateMany({
        where: {
          userId: data.userId,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    return await this.prisma.bankAccount.create({
      data: {
        userId: data.userId,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
        ifscCode: data.ifscCode,
        upiId: data.upiId || null,
        isDefault: data.isDefault || false,
      },
    });
  }

  async findBankAccountByIdAndUser(bankAccountId: number, userId: number): Promise<any> {
    return await this.prisma.bankAccount.findFirst({
      where: {
        id: bankAccountId,
        userId: userId,
      },
    });
  }

  async updateBankAccount(bankAccountId: number, userId: number, data: {
    accountNumber?: string;
    accountName?: string;
    ifscCode?: string;
    upiId?: string;
    isDefault?: boolean;
  }): Promise<any> {
    // If this is being set as default, unset other defaults first
    if (data.isDefault) {
      await this.prisma.bankAccount.updateMany({
        where: {
          userId: userId,
          isDefault: true,
          id: { not: bankAccountId },
        },
        data: {
          isDefault: false,
        },
      });
    }

    return await this.prisma.bankAccount.update({
      where: {
        id: bankAccountId,
      },
      data,
    });
  }

  async deleteBankAccount(bankAccountId: number): Promise<any> {
    return await this.prisma.bankAccount.delete({
      where: {
        id: bankAccountId,
      },
    });
  }

  // Withdrawal Request operations
  async createWithdrawalRequest(data: {
    userId: number;
    bankAccountId: number;
    amount: number;
  }): Promise<any> {
    return await this.prisma.withdrawalRequest.create({
      data: {
        userId: data.userId,
        bankAccountId: data.bankAccountId,
        amount: data.amount,
        status: 'pending',
      },
      include: {
        bankAccount: {
          select: {
            accountNumber: true,
            accountName: true,
            ifscCode: true,
            upiId: true,
          },
        },
      },
    });
  }

  async getUserWithdrawalRequests(userId: number): Promise<any[]> {
    return await this.prisma.withdrawalRequest.findMany({
      where: {
        userId,
      },
      include: {
        bankAccount: {
          select: {
            accountNumber: true,
            accountName: true,
            ifscCode: true,
            upiId: true,
          },
        },
      },
      orderBy: {
        requestedAt: 'desc',
      },
    });
  }

  async findWithdrawalRequestByIdAndUser(requestId: number, userId: number): Promise<any> {
    return await this.prisma.withdrawalRequest.findFirst({
      where: {
        id: requestId,
        userId: userId,
      },
      include: {
        bankAccount: {
          select: {
            accountNumber: true,
            accountName: true,
            ifscCode: true,
            upiId: true,
          },
        },
      },
    });
  }

  async updateUserBalance(userId: number, newBalance: number): Promise<any> {
    return await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        balance: newBalance,
      },
    });
  }

  async cancelWithdrawalRequest(requestId: number): Promise<any> {
    return await this.prisma.withdrawalRequest.update({
      where: {
        id: requestId,
      },
      data: {
        status: 'cancelled',
        processedAt: new Date(),
      },
    });
  }

  // Transaction operations
  async createTransaction(data: {
    userId: number;
    type: string;
    amount: number;
    status?: string;
    description?: string;
    referenceId?: string;
    balanceBefore: number;
    balanceAfter: number;
  }): Promise<any> {
    return await this.prisma.transaction.create({
      data: {
        userId: data.userId,
        type: data.type as any,
        amount: data.amount,
        status: (data.status as any) || 'completed',
        description: data.description || null,
        referenceId: data.referenceId || null,
        balanceBefore: data.balanceBefore,
        balanceAfter: data.balanceAfter,
      },
    });
  }

  async getUserTransactions(userId: number, limit: number = 50, offset: number = 0): Promise<any[]> {
    return await this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async getTransactionById(transactionId: number): Promise<any> {
    return await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { user: true },
    });
  }

  async updateTransactionStatus(transactionId: number, status: string, description?: string): Promise<any> {
    return await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: status as any,
        description: description || null,
        updatedAt: new Date(),
      },
    });
  }

  // Updated balance update method with transaction recording
  async updateUserBalanceWithTransaction(
    userId: number, 
    amount: number, 
    type: string, 
    description?: string,
    referenceId?: string
  ): Promise<{ user: any; transaction: any }> {
    return await this.prisma.$transaction(async (prisma) => {
      // Get current user balance
      const currentUser = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!currentUser) {
        throw new Error('User not found');
      }

      const balanceBefore = currentUser.balance;
      const balanceAfter = balanceBefore + amount;

      // Update user balance
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { balance: balanceAfter }
      });

      // Create transaction record
      const transaction = await prisma.transaction.create({
        data: {
          userId,
          type: type as any,
          amount: Math.abs(amount), // Store as positive value
          status: 'completed',
          description: description || null,
          referenceId: referenceId || null,
          balanceBefore,
          balanceAfter
        }
      });

      return { user: updatedUser, transaction };
    });
  }
}

// Create a singleton instance
const databaseService = new DatabaseService();

// Setup cleanup intervals
setInterval(async () => {
  try {
    const expiredOTP = await databaseService.cleanupExpiredOTPSessions();
    const expiredTokens = await databaseService.deleteExpiredRefreshTokens();
    
    if (expiredOTP > 0 || expiredTokens > 0) {
      console.log(`🧹 Cleanup: Removed ${expiredOTP} expired OTP sessions and ${expiredTokens} expired refresh tokens`);
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}, 5 * 60 * 1000); // Run every 5 minutes

export { databaseService, DatabaseService };