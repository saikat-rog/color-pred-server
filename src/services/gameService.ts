import { PrismaClient, Color } from '../generated/prisma';

const prisma = new PrismaClient();

export class GameService {
  private currentPeriod: any = null;
  private periodTimer: NodeJS.Timeout | null = null;

  /**
   * Initialize the game service and start the period cycle
   */
  async initialize() {
    console.log('🎮 Initializing Game Service...');
    
    // Ensure game settings exist
    await this.ensureGameSettings();
    
    // Start or resume the current period
    await this.startOrResumePeriod();
  }

  /**
   * Ensure game settings exist in the database
   */
  private async ensureGameSettings() {
    const settings = await prisma.gameSettings.findFirst();
    if (!settings) {
      await prisma.gameSettings.create({
        data: {
          periodDuration: 180, // 3 minutes
          bettingDuration: 150, // 2:30 minutes
          winMultiplier: 1.8,
          minBetAmount: 10,
          maxBetAmount: 10000,
        },
      });
      console.log('✅ Game settings initialized');
    }
  }

  /**
   * Generate period ID in format YYYYMMDD001
   */
  private generatePeriodId(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Calculate period number for the day (1-480)
    const minutesFromMidnight = date.getHours() * 60 + date.getMinutes();
    const periodNumber = Math.floor(minutesFromMidnight / 3) + 1;
    
    return `${year}${month}${day}${String(periodNumber).padStart(3, '0')}`;
  }

  /**
   * Calculate the start time for the current period
   */
  private calculatePeriodStartTime(now: Date): Date {
    const minutesFromMidnight = now.getHours() * 60 + now.getMinutes();
    const periodIndex = Math.floor(minutesFromMidnight / 3);
    const periodStartMinutes = periodIndex * 3;
    
    const startTime = new Date(now);
    startTime.setHours(0, 0, 0, 0);
    startTime.setMinutes(periodStartMinutes);
    
    return startTime;
  }

  /**
   * Start or resume the current period
   */
  private async startOrResumePeriod() {
    const now = new Date();
    const periodStartTime = this.calculatePeriodStartTime(now);
    const periodId = this.generatePeriodId(periodStartTime);

    // Check if period already exists
    let period = await prisma.gamePeriod.findUnique({
      where: { periodId },
    });

    if (!period) {
      // Create new period
      const endTime = new Date(periodStartTime.getTime() + 3 * 60 * 1000); // +3 minutes
      const bettingEndTime = new Date(periodStartTime.getTime() + 2.5 * 60 * 1000); // +2:30 minutes

      period = await prisma.gamePeriod.create({
        data: {
          periodId,
          startTime: periodStartTime,
          endTime,
          bettingEndTime,
          status: 'active',
        },
      });
      console.log(`🆕 Created new period: ${periodId}`);
    } else {
      console.log(`♻️  Resumed existing period: ${periodId}`);
    }

    this.currentPeriod = period;

    // Schedule period end
    const timeUntilEnd = period.endTime.getTime() - now.getTime();
    if (timeUntilEnd > 0) {
      this.schedulePeriodEnd(timeUntilEnd);
      
      // Schedule betting lock (30 seconds before end)
      const timeUntilBettingEnd = period.bettingEndTime.getTime() - now.getTime();
      if (timeUntilBettingEnd > 0) {
        setTimeout(() => this.lockBetting(), timeUntilBettingEnd);
      } else {
        // Already in locked period
        await this.lockBetting();
      }
    } else {
      // Period should have ended, complete it immediately
      await this.completePeriod();
    }
  }

  /**
   * Schedule period end
   */
  private schedulePeriodEnd(delay: number) {
    if (this.periodTimer) {
      clearTimeout(this.periodTimer);
    }

    this.periodTimer = setTimeout(async () => {
      await this.completePeriod();
    }, delay);

    console.log(`⏰ Period will end in ${Math.round(delay / 1000)} seconds`);
  }

  /**
   * Lock betting for the current period
   */
  private async lockBetting() {
    if (!this.currentPeriod) return;

    await prisma.gamePeriod.update({
      where: { id: this.currentPeriod.id },
      data: { status: 'betting_closed' },
    });

    console.log(`🔒 Betting locked for period: ${this.currentPeriod.periodId}`);
  }

  /**
   * Complete the current period and determine winner
   */
  private async completePeriod() {
    if (!this.currentPeriod) return;

    console.log(`🏁 Completing period: ${this.currentPeriod.periodId}`);

    // Get total bets for each color
    const period = await prisma.gamePeriod.findUnique({
      where: { id: this.currentPeriod.id },
      include: {
        bets: true,
      },
    });

    if (!period) return;

    // Calculate total bets per color
    const greenTotal = period.bets
      .filter(bet => bet.color === 'green')
      .reduce((sum, bet) => sum + bet.amount, 0);
    
    const purpleTotal = period.bets
      .filter(bet => bet.color === 'purple')
      .reduce((sum, bet) => sum + bet.amount, 0);
    
    const redTotal = period.bets
      .filter(bet => bet.color === 'red')
      .reduce((sum, bet) => sum + bet.amount, 0);

    // Determine winning color (lowest bet amount)
    const colorTotals = [
      { color: 'green' as Color, total: greenTotal },
      { color: 'purple' as Color, total: purpleTotal },
      { color: 'red' as Color, total: redTotal },
    ];

    const winningColorObj = colorTotals.reduce((min, current) => 
      current.total < min.total ? current : min
    );

    const winningColor = winningColorObj.color;

    // Update period with winning color and totals
    await prisma.gamePeriod.update({
      where: { id: period.id },
      data: {
        status: 'completed',
        winningColor,
        totalGreenBets: greenTotal,
        totalPurpleBets: purpleTotal,
        totalRedBets: redTotal,
        completedAt: new Date(),
      },
    });

    console.log(`🏆 Period ${period.periodId} completed. Winning color: ${winningColor}`);

    // Process all bets
    await this.settleBets(period.id, winningColor);

    // Start next period
    await this.startOrResumePeriod();
  }

  /**
   * Settle all bets for a completed period
   */
  private async settleBets(gamePeriodId: number, winningColor: Color) {
    const settings = await prisma.gameSettings.findFirst();
    if (!settings) return;

    const winMultiplier = settings.winMultiplier;

    // Get all bets for this period
    const bets = await prisma.bet.findMany({
      where: { gamePeriodId, status: 'pending' },
      include: { user: true },
    });

    for (const bet of bets) {
      const isWinner = bet.color === winningColor;
      const winAmount = isWinner ? bet.amount * winMultiplier : 0;

      // Update bet status
      await prisma.bet.update({
        where: { id: bet.id },
        data: {
          status: isWinner ? 'won' : 'lost',
          winAmount: isWinner ? winAmount : null,
          settledAt: new Date(),
        },
      });

      // Credit winning amount to user
      if (isWinner) {
        const currentBalance = bet.user.balance;
        const newBalance = currentBalance + winAmount;

        await prisma.user.update({
          where: { id: bet.userId },
          data: { balance: newBalance },
        });

        // Create transaction record
        await prisma.transaction.create({
          data: {
            userId: bet.userId,
            type: 'bet_win_credit',
            amount: winAmount,
            status: 'completed',
            description: `Win from bet on ${bet.color} - Period ${bet.periodId}`,
            referenceId: bet.id.toString(),
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
          },
        });

        console.log(`💰 User ${bet.userId} won ${winAmount} on ${bet.color}`);
      } else {
        console.log(`❌ User ${bet.userId} lost bet on ${bet.color}`);
      }
    }
  }

  /**
   * Place a bet for a user
   */
  async placeBet(userId: number, color: Color, amount: number) {
    // Validate betting is open
    if (!this.currentPeriod) {
      throw new Error('No active period');
    }

    const now = new Date();
    const period = await prisma.gamePeriod.findUnique({
      where: { id: this.currentPeriod.id },
    });

    if (!period) {
      throw new Error('Period not found');
    }

    if (period.status !== 'active') {
      throw new Error('Betting is closed for this period');
    }

    if (now >= period.bettingEndTime) {
      throw new Error('Betting time has ended for this period');
    }

    // Get game settings
    const settings = await prisma.gameSettings.findFirst();
    if (!settings) {
      throw new Error('Game settings not found');
    }

    // Validate bet amount
    if (amount < settings.minBetAmount) {
      throw new Error(`Minimum bet amount is ${settings.minBetAmount}`);
    }

    if (amount > settings.maxBetAmount) {
      throw new Error(`Maximum bet amount is ${settings.maxBetAmount}`);
    }

    // Get user and validate balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.balance < amount) {
      throw new Error('Insufficient balance');
    }

    // Debit user balance
    const newBalance = user.balance - amount;
    await prisma.user.update({
      where: { id: userId },
      data: { balance: newBalance },
    });

    // Create transaction record for debit
    await prisma.transaction.create({
      data: {
        userId,
        type: 'bet_debit',
        amount,
        status: 'completed',
        description: `Bet on ${color} - Period ${period.periodId}`,
        balanceBefore: user.balance,
        balanceAfter: newBalance,
      },
    });

    // Create bet record
    const bet = await prisma.bet.create({
      data: {
        userId,
        periodId: period.periodId,
        gamePeriodId: period.id,
        color,
        amount,
        status: 'pending',
      },
    });

    console.log(`🎲 User ${userId} placed bet of ${amount} on ${color} for period ${period.periodId}`);

    return bet;
  }

  /**
   * Get current period information
   */
  async getCurrentPeriod() {
    const now = new Date();
    const periodStartTime = this.calculatePeriodStartTime(now);
    const periodId = this.generatePeriodId(periodStartTime);

    const period = await prisma.gamePeriod.findUnique({
      where: { periodId },
    });

    if (!period) return null;

    const timeRemaining = Math.max(0, period.endTime.getTime() - now.getTime());
    const bettingTimeRemaining = Math.max(0, period.bettingEndTime.getTime() - now.getTime());
    const canBet = period.status === 'active' && bettingTimeRemaining > 0;

    return {
      ...period,
      timeRemaining: Math.floor(timeRemaining / 1000),
      bettingTimeRemaining: Math.floor(bettingTimeRemaining / 1000),
      canBet,
    };
  }

  /**
   * Get user's bets for a specific period
   */
  async getUserBetsForPeriod(userId: number, periodId: string) {
    return await prisma.bet.findMany({
      where: {
        userId,
        periodId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get user's bet history
   */
  async getUserBetHistory(userId: number, limit: number = 50) {
    return await prisma.bet.findMany({
      where: { userId },
      include: {
        gamePeriod: {
          select: {
            periodId: true,
            winningColor: true,
            status: true,
            completedAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Get period history
   */
  async getPeriodHistory(limit: number = 50) {
    return await prisma.gamePeriod.findMany({
      where: {
        status: 'completed',
      },
      orderBy: {
        completedAt: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Get game settings
   */
  async getGameSettings() {
    return await prisma.gameSettings.findFirst();
  }

  /**
   * Update game settings (admin only)
   */
  async updateGameSettings(data: {
    winMultiplier?: number;
    minBetAmount?: number;
    maxBetAmount?: number;
  }) {
    const settings = await prisma.gameSettings.findFirst();
    if (!settings) {
      throw new Error('Game settings not found');
    }

    return await prisma.gameSettings.update({
      where: { id: settings.id },
      data,
    });
  }

  /**
   * Cleanup - stop timers
   */
  cleanup() {
    if (this.periodTimer) {
      clearTimeout(this.periodTimer);
      this.periodTimer = null;
    }
  }
}

export const gameService = new GameService();
