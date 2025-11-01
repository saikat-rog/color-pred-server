import { PrismaClient, Color } from "@prisma/client";
import type { Numbers } from "@prisma/client";

const prisma = new PrismaClient();

export class GameService {
  private currentPeriod: any = null;
  private periodTimer: NodeJS.Timeout | null = null;

  /**
   * Initialize the game service and start the period cycle
   */
  async initialize() {
    console.log("🎮 Initializing Game Service...");

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
          referralCommissionPercentage1: 1.0, // Level 1: 1%
          referralCommissionPercentage2: 0.5, // Level 2: 0.5%
          referralCommissionPercentage3: 0.25, // Level 3: 0.25%
          referralSignupBonusInRs: 1.0, // 1 Rs bonus
          minRechargeForBonus: 500.0, // Minimum 500 Rs recharge
        },
      });
      console.log("✅ Game settings initialized");
    }
  }

  /**
   * Generate period ID in format YYYYMMDD001
   */
  private generatePeriodId(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    // Calculate period number for the day (1-480)
    const minutesFromMidnight = date.getHours() * 60 + date.getMinutes();
    const periodNumber = Math.floor(minutesFromMidnight / 3) + 1;

    return `${year}${month}${day}${String(periodNumber).padStart(3, "0")}`;
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
    // Find the last period (any status)
    const lastPeriod = await prisma.gamePeriod.findFirst({
      orderBy: { endTime: "desc" }
    });

    let periodStartTime;
    if (lastPeriod) {
      // Start next period exactly at the end of the last period
      periodStartTime = new Date(lastPeriod.endTime);
    } else {
      // No previous period, use current time rounded to slot
      periodStartTime = this.calculatePeriodStartTime(new Date());
    }
    const periodId = this.generatePeriodId(periodStartTime);

    // Strictly check for any existing period with this periodId
    let period = await prisma.gamePeriod.findFirst({
      where: { periodId },
      orderBy: { id: "asc" }
    });

    if (!period) {
      // Create new period
      const endTime = new Date(periodStartTime.getTime() + 3 * 60 * 1000); // +3 minutes
      const bettingEndTime = new Date(
        periodStartTime.getTime() + 2.5 * 60 * 1000
      ); // +2:30 minutes

      period = await prisma.gamePeriod.create({
        data: {
          periodId,
          startTime: periodStartTime,
          endTime,
          bettingEndTime,
          status: "active",
        },
      });
      console.log(`🆕 Created new period: ${periodId}`);
    } else {
      console.log(`♻️  Resumed existing period: ${periodId}`);
    }

    this.currentPeriod = period;

    // Schedule period end
    const now = new Date();
    const timeUntilEnd = period.endTime.getTime() - now.getTime();
    if (timeUntilEnd > 0) {
      this.schedulePeriodEnd(timeUntilEnd);

      // Schedule betting lock (30 seconds before end)
      const timeUntilBettingEnd =
        period.bettingEndTime.getTime() - now.getTime();
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
      data: { status: "betting_closed" },
    });

    console.log(`🔒 Betting locked for period: ${this.currentPeriod.periodId}`);
  }

  /**
   * Complete the current period and determine winner
   */
  private async completePeriod() {
    if (!this.currentPeriod) return;

    console.log(`🏁 Completing period: ${this.currentPeriod.periodId}`);

    // Get period with latest color totals from DB
    const period = await prisma.gamePeriod.findUnique({
      where: { id: this.currentPeriod.id },
    });

    if (!period) return;

    // Use color totals directly from DB
    const greenTotal = period.totalGreenBets ?? 0;
    const purpleTotal = period.totalPurpleBets ?? 0;
    const redTotal = period.totalRedBets ?? 0;

    // Determine winning color (lowest bet amount)
    const colorTotals = [
      { color: "green" as Color, total: greenTotal },
      { color: "purple" as Color, total: purpleTotal },
      { color: "red" as Color, total: redTotal },
    ];

    const redNumberTotals = [
      { number: "zero" as Numbers, total: period.totalZeroBets ?? 0 },
      // { number: "one" as Numbers, total: period.totalOneBets ?? 0 },
      { number: "two" as Numbers, total: period.totalTwoBets ?? 0 },
      // { number: "three" as Numbers, total: period.totalThreeBets ?? 0 },
      { number: "four" as Numbers, total: period.totalFourBets ?? 0 },
      // { number: "five" as Numbers, total: period.totalFiveBets ?? 0 },
      { number: "six" as Numbers, total: period.totalSixBets ?? 0 },
      // { number: "seven" as Numbers, total: period.totalSevenBets ?? 0 },
      { number: "eight" as Numbers, total: period.totalEightBets ?? 0 },
      // { number: "nine" as Numbers, total: period.totalNineBets ?? 0 },
    ];

    const greenNumberTotals = [
      // { number: "zero" as Numbers, total: period.totalZeroBets ?? 0 },
      { number: "one" as Numbers, total: period.totalOneBets ?? 0 },
      // { number: "two" as Numbers, total: period.totalTwoBets ?? 0 },
      { number: "three" as Numbers, total: period.totalThreeBets ?? 0 },
      // { number: "four" as Numbers, total: period.totalFourBets ?? 0 },
      { number: "five" as Numbers, total: period.totalFiveBets ?? 0 },
      // { number: "six" as Numbers, total: period.totalSixBets ?? 0 },
      { number: "seven" as Numbers, total: period.totalSevenBets ?? 0 },
      // { number: "eight" as Numbers, total: period.totalEightBets ?? 0 },
      { number: "nine" as Numbers, total: period.totalNineBets ?? 0 },
    ];

    // Find the color with the lowest total, but never allow purple to win
    let sortedColorTotals = [...colorTotals].sort((a, b) => a.total - b.total);

    // If all color totals are zero, randomly pick green or red
    const allZero = sortedColorTotals.every((c) => c.total === 0);
    let winningColorObj;
    if (allZero) {
      const candidates = sortedColorTotals.filter(
        (c) => c.color === "green" || c.color === "red"
      );
      winningColorObj = candidates[Math.floor(Math.random() * 2)];
    } else {
      // Find the lowest non-purple color
      winningColorObj = sortedColorTotals.find((c) => c.color !== "purple");
      if (!winningColorObj) {
        // If all are purple, randomly pick green or red
        const candidates = sortedColorTotals.filter(
          (c) => c.color === "green" || c.color === "red"
        );
        if (candidates.length > 0) {
          winningColorObj =
            candidates[Math.floor(Math.random() * candidates.length)];
        } else {
          winningColorObj = sortedColorTotals[0];
        }
      }
    }

    // Use greenNumberTotals or redNumberTotals based on winning color
    let numberTotals: { number: Numbers; total: number }[] = [];
    // Ensure winningColorObj is always defined
    const safeWinningColorObj = winningColorObj || { color: "red", total: 0 };
    if (safeWinningColorObj.color === "green") {
      numberTotals = greenNumberTotals;
    } else {
      numberTotals = redNumberTotals;
    }

    let sortedNumberTotals = [...numberTotals].sort(
      (a, b) => a.total - b.total
    );

    // If all number totals are zero, randomly pick one
    const allNumberZero = sortedNumberTotals.every((n) => n.total === 0);
    let winningNumberObj;
    if (allNumberZero) {
      winningNumberObj =
        sortedNumberTotals[
          Math.floor(Math.random() * sortedNumberTotals.length)
        ];
    } else {
      winningNumberObj = sortedNumberTotals[0];
      if (winningNumberObj) {
        // If lowest is zero or five, randomly allow or skip
        if (
          winningNumberObj.number === "zero" ||
          winningNumberObj.number === "five"
        ) {
          // 10% chance to allow zero/five to win
          const allowZeroFive = Math.random() < 0.1;
          if (!allowZeroFive) {
            // Find next lowest that is not zero/five
            const next = sortedNumberTotals.find(
              (n) => n.number !== "zero" && n.number !== "five"
            );
            if (next) {
              winningNumberObj = next;
            }
          }
          // else keep zero/five as winner
        }
      }
    }

    const winningColor = safeWinningColorObj.color;
    const winningNumber = winningNumberObj ? winningNumberObj.number : null;

    // Update period with winning color and totals
    await prisma.gamePeriod.update({
      where: { id: period.id },
      data: {
        status: "completed",
        winningColor,
        winningNumber,
        completedAt: new Date(),
      },
    });

    console.log(
      `🏆 Period ${period.periodId} completed. Winning color: ${winningColor}`
    );

    // Process all bets
    await this.settleBets(period.id, winningColor, winningNumber);

    // Start next period
    await this.startOrResumePeriod();
  }

  /**
   * Settle all bets for a completed period
   */
  private async settleBets(
    gamePeriodId: number,
    winningColor: Color,
    winningNumber: Numbers | null
  ) {
    const settings = await prisma.gameSettings.findFirst();
    if (!settings) return;

    let winMultiplier = settings.winMultiplier;
    let winMultiplierForNumberBet = settings.winMultiplierForNumberBet;

    if (winningNumber === "zero" || winningNumber === "five") {
      winMultiplierForNumberBet =
        settings.winMultiplierForNumberBetOnZeroOrFive;
    }

    // Get all bets for this period
    const bets = await prisma.bet.findMany({
      where: { gamePeriodId, status: "pending" },
      include: { user: true },
    });

    for (const bet of bets) {
      let isWinByNumberBet = false;
      let isWinner = false;
      if (!bet.number) {
        // If no number is specified, check the color
        isWinner = bet.color === winningColor;
      } else {
        isWinner = bet.number === winningNumber;
        isWinByNumberBet = true;
      }

      isWinByNumberBet
        ? (winMultiplier = winMultiplierForNumberBet)
        : (winMultiplier = settings.winMultiplier);

      const winAmount = isWinner ? bet.amount * winMultiplier : 0;

      // Update bet status
      await prisma.bet.update({
        where: { id: bet.id },
        data: {
          status: isWinner ? "won" : "lost",
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
            type: "bet_win_credit",
            amount: winAmount,
            status: "completed",
            description: `Win from bet on Period ${bet.periodId}`,
            referenceId: bet.id.toString(),
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
          },
        });

        console.log(
          `💰 User ${bet.userId} won ${winAmount} on Period ${bet.periodId}`
        );
      } else {
        console.log(`❌ User ${bet.userId} lost bet on Period ${bet.periodId}`);
      }
    }
  }

  /**
   * Place a bet for a user
   */
  async placeBet(
    userId: number,
    color: Color | null,
    number: Numbers | null,
    amount: number
  ) {
    // Accept only color or number, not both or neither
    const hasColor = !!color;
    const hasNumber = !!number;
    if (hasColor && hasNumber) {
      throw new Error("You must bet on either color or number, not both.");
    }
    if (!hasColor && !hasNumber) {
      throw new Error(
        "You must bet on either color or number. Both cannot be null."
      );
    }

    // Validate betting is open
    if (!this.currentPeriod) {
      throw new Error("No active period");
    }

    const now = new Date();
    const period = await prisma.gamePeriod.findUnique({
      where: { id: this.currentPeriod.id },
    });

    if (!period) {
      throw new Error("Period not found");
    }

    if (period.status !== "active") {
      throw new Error("Betting is closed for this period");
    }

    if (now >= period.bettingEndTime) {
      throw new Error("Betting time has ended for this period");
    }

    // Get game settings
    const settings = await prisma.gameSettings.findFirst();
    if (!settings) {
      throw new Error("Game settings not found");
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
      throw new Error("User not found");
    }

    if (user.balance < amount) {
      throw new Error("Insufficient balance");
    }

    // Debit user balance
    const newBalance = user.balance - amount;
    await prisma.user.update({
      where: { id: userId },
      data: { balance: newBalance },
    });

    let betDescription = "";
    if (!color) {
      betDescription = `Bet on color ${color} - Period ${period.periodId}`;
    }

    if (!number) {
      betDescription = `Bet on number ${number} - Period ${period.periodId}`;
    }

    // Create transaction record for debit
    await prisma.transaction.create({
      data: {
        userId,
        type: "bet_debit",
        amount,
        status: "completed",
        description: betDescription,
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
        color: hasColor ? color : (null as any),
        number: hasNumber ? number : (null as any),
        amount,
        status: "pending",
      },
    });

    // Update color totals and number totals immediately after a bet
    let colorField: string | null = null;
    let numberField: string | null = null;

    if (hasColor && color) {
      if (color === "green") colorField = "totalGreenBets";
      else if (color === "purple") colorField = "totalPurpleBets";
      else if (color === "red") colorField = "totalRedBets";
    } else if (hasNumber && number) {
      if (number === "zero") {
        colorField = "totalRedBets";
        numberField = "totalZeroBets";
      } else if (number === "one") {
        colorField = "totalGreenBets";
        numberField = "totalOneBets";
      } else if (number === "two") {
        colorField = "totalRedBets";
        numberField = "totalTwoBets";
      } else if (number === "three") {
        colorField = "totalGreenBets";
        numberField = "totalThreeBets";
      } else if (number === "four") {
        colorField = "totalRedBets";
        numberField = "totalFourBets";
      } else if (number === "five") {
        colorField = "totalGreenBets";
        numberField = "totalFiveBets";
      } else if (number === "six") {
        colorField = "totalRedBets";
        numberField = "totalSixBets";
      } else if (number === "seven") {
        colorField = "totalGreenBets";
        numberField = "totalSevenBets";
      } else if (number === "eight") {
        colorField = "totalRedBets";
        numberField = "totalEightBets";
      } else if (number === "nine") {
        colorField = "totalGreenBets";
        numberField = "totalNineBets";
      }
    }

    if (colorField) {
      await prisma.gamePeriod.update({
        where: { id: period.id },
        data: {
          [colorField]: { increment: amount },
        },
      });
      console.log(`Updated ${colorField} and ${numberField} by ${amount}`);
    }

    if (numberField) {
      await prisma.gamePeriod.update({
        where: { id: period.id },
        data: {
          [numberField]: { increment: amount },
        },
      });
    }

    console.log(`🎲 User ${userId} placed ${betDescription} of ${amount}`);

    // Process referral commissions
    await this.processReferralCommissions(userId, bet.id, amount, settings);

    return bet;
  }

  /**
   * Process referral commissions for a bet
   */
  private async processReferralCommissions(
    bettorUserId: number,
    betId: number,
    betAmount: number,
    settings: any
  ) {
    try {
      // Get the bettor's referral chain (up to 3 levels)
      const bettor = await prisma.user.findUnique({
        where: { id: bettorUserId },
        select: { referredById: true },
      });

      if (!bettor || !bettor.referredById) {
        return; // No referrer, no commissions
      }

      const commissions = [
        {
          level: 1,
          percentage: settings.referralCommissionPercentage1,
          userId: bettor.referredById,
        },
      ];

      // Get Level 2 referrer
      if (bettor.referredById) {
        const level1 = await prisma.user.findUnique({
          where: { id: bettor.referredById },
          select: { referredById: true },
        });

        if (level1?.referredById) {
          commissions.push({
            level: 2,
            percentage: settings.referralCommissionPercentage2,
            userId: level1.referredById,
          });

          // Get Level 3 referrer
          const level2 = await prisma.user.findUnique({
            where: { id: level1.referredById },
            select: { referredById: true },
          });

          if (level2?.referredById) {
            commissions.push({
              level: 3,
              percentage: settings.referralCommissionPercentage3,
              userId: level2.referredById,
            });
          }
        }
      }

      // Process each commission
      for (const commission of commissions) {
        const commissionAmount = (betAmount * commission.percentage) / 100;

        if (commissionAmount > 0) {
          // Get referrer's current balance
          const referrer = await prisma.user.findUnique({
            where: { id: commission.userId },
          });

          if (referrer) {
            const newBalance = referrer.balance + commissionAmount;

            // Update referrer's balance
            await prisma.user.update({
              where: { id: commission.userId },
              data: { balance: newBalance },
            });

            // Create commission record
            await prisma.referralCommission.create({
              data: {
                userId: commission.userId,
                fromUserId: bettorUserId,
                betId,
                amount: commissionAmount,
                percentage: commission.percentage,
                level: commission.level,
              },
            });

            // Create transaction record
            await prisma.transaction.create({
              data: {
                userId: commission.userId,
                type: "referral_commission",
                amount: commissionAmount,
                status: "completed",
                description: `L${commission.level} Referral commission from bet #${betId}`,
                referenceId: betId.toString(),
                balanceBefore: referrer.balance,
                balanceAfter: newBalance,
              },
            });

            console.log(
              `💰 L${commission.level} Commission: User ${
                commission.userId
              } earned ₹${commissionAmount.toFixed(2)} (${
                commission.percentage
              }%) from User ${bettorUserId}'s bet`
            );
          }
        }
      }
    } catch (error) {
      console.error("Error processing referral commissions:", error);
      // Don't throw error - commissions are a bonus feature, shouldn't block betting
    }
  }

  /**
   * Get current period information
   */
  async getCurrentPeriod() {
    const now = new Date();

    // Prefer the in-memory currentPeriod to avoid race conditions when a period
    // is being rolled over but the database row for the next period isn't yet
    // visible to quick reads. If the in-memory period appears valid for now,
    // return it immediately.
    // if (this.currentPeriod) {
    //   try {
    //     const cp = this.currentPeriod as any;
    //     if (
    //       cp.startTime &&
    //       cp.endTime &&
    //       cp.startTime <= now &&
    //       now < cp.endTime
    //     ) {
    //       const timeRemaining = Math.max(
    //         0,
    //         cp.endTime.getTime() - now.getTime()
    //       );
    //       const bettingTimeRemaining = Math.max(
    //         0,
    //         cp.bettingEndTime.getTime() - now.getTime()
    //       );
    //       const canBet = cp.status === "active" && bettingTimeRemaining > 0;
    //       return {
    //         ...cp,
    //         timeRemaining: Math.floor(timeRemaining / 1000),
    //         bettingTimeRemaining: Math.floor(bettingTimeRemaining / 1000),
    //         canBet,
    //       };
    //     }
    //   } catch (err) {
    //     // If anything goes wrong reading in-memory period, fall back to DB lookup
    //     console.warn("Warning reading in-memory currentPeriod:", err);
    //   }
    // }

    // Try to find a period that spans 'now' (handles DB visibility during rollovers)
    let period = await prisma.gamePeriod.findFirst({
      where: {
        startTime: { lte: now },
        endTime: { gt: now },
      },
    });

    // If not found in DB (possible race between end and creation), ensure service creates/resumes period
    // if (!period) {
    //   await this.startOrResumePeriod();
    //   period = this.currentPeriod as any;
    // }

    if (!period) return null;

    const timeRemaining = Math.max(0, period.endTime.getTime() - now.getTime());
    const bettingTimeRemaining = Math.max(
      0,
      period.bettingEndTime.getTime() - now.getTime()
    );
    const canBet = period.status === "active" && bettingTimeRemaining > 0;

    // Exclude fields by destructuring
    const {
      // totalRedBets,
      // totalGreenBets,
      // totalPurpleBets,
      // totalZeroBets,
      // totalOneBets,
      // totalTwoBets,
      // totalThreeBets,
      // totalFourBets,
      // totalFiveBets,
      // totalSixBets,
      // totalSevenBets,
      // totalEightBets,
      // totalNineBets
      ...filteredPeriod
    } = period;
    return {
      ...filteredPeriod,
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
        createdAt: "desc",
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
        createdAt: "desc",
      },
      take: limit,
    });
  }

  /**
   * Get period history
   */
  async getPeriodHistory(limit: number = 50, offset: number = 0) {
    const [items, total] = await Promise.all([
      prisma.gamePeriod.findMany({
        where: {
          status: "completed",
        },
        orderBy: {
          completedAt: "desc",
        },
        skip: offset,
        take: limit,
      }),
      prisma.gamePeriod.count({ where: { status: "completed" } }),
    ]);

    return { items, total };
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
      throw new Error("Game settings not found");
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

  /**
   * Process referral bonus when a user recharges
   * Called after a successful recharge to check if referrer should get bonus
   * Bonus is only given if the FIRST recharge is >= minimum amount
   */
  async processReferralBonus(userId: number, rechargeAmount: number) {
    try {
      // Get user with referral info
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          referredById: true,
          hasClaimedReferralBonus: true,
        },
      });

      // Check if user was referred and hasn't claimed bonus yet
      if (!user || !user.referredById || user.hasClaimedReferralBonus) {
        return; // No referrer or bonus already claimed/invalidated
      }

      // Get game settings
      const settings = await prisma.gameSettings.findFirst();
      if (!settings) {
        return;
      }

      // Check if this is the first recharge by looking at recharge transaction history
      const previousRecharges = await prisma.transaction.count({
        where: {
          userId: userId,
          type: "recharge",
          status: "completed",
        },
      });

      // If this is the first recharge (count is 1, just created)
      if (previousRecharges === 1) {
        // Check if first recharge meets minimum requirement
        if (rechargeAmount < settings.minRechargeForBonus) {
          console.log(
            `❌ First recharge of ₹${rechargeAmount} is below minimum ₹${settings.minRechargeForBonus}. Referral bonus invalidated for user ${userId}.`
          );

          // Mark as claimed to prevent future bonus (invalidate)
          await prisma.user.update({
            where: { id: userId },
            data: { hasClaimedReferralBonus: true },
          });

          return; // No bonus, and user can never get it
        }

        // First recharge meets minimum - process bonus
        // Get referrer
        const referrer = await prisma.user.findUnique({
          where: { id: user.referredById },
        });

        if (!referrer) {
          return;
        }

        const bonusAmount = settings.referralSignupBonusInRs;
        const newReferrerBalance = referrer.balance + bonusAmount;

        // Credit referrer with bonus
        await prisma.user.update({
          where: { id: referrer.id },
          data: { balance: newReferrerBalance },
        });

        // Mark user as having claimed the bonus
        await prisma.user.update({
          where: { id: userId },
          data: { hasClaimedReferralBonus: true },
        });

        // Create transaction for referrer
        await prisma.transaction.create({
          data: {
            userId: referrer.id,
            type: "referral_bonus",
            amount: bonusAmount,
            status: "completed",
            description: `Referral signup bonus for referring user #${userId}`,
            referenceId: userId.toString(),
            balanceBefore: referrer.balance,
            balanceAfter: newReferrerBalance,
          },
        });

        console.log(
          `🎁 Referral bonus: User ${referrer.id} earned ₹${bonusAmount} for referring User ${userId} (first recharge: ₹${rechargeAmount})`
        );
      }
      // If not first recharge, do nothing (bonus already processed or invalidated)
    } catch (error) {
      console.error("Error processing referral bonus:", error);
      // Don't throw error - bonus is a nice-to-have feature
    }
  }

  /**
   * Get user's referral information
   */
  async getReferralInfo(userId: number) {
    // Get all level 1 referrals
    const level1Users = await prisma.user.findMany({
      where: { referredById: userId },
      select: { id: true, phoneNumber: true, createdAt: true },
    });

    // Get all level 2 referrals
    let level2Users: {
      id: number;
      phoneNumber: string;
      createdAt: Date;
      referredById: number | null;
    }[] = [];
    for (const l1 of level1Users) {
      const l2s = await prisma.user.findMany({
        where: { referredById: l1.id },
        select: {
          id: true,
          phoneNumber: true,
          createdAt: true,
          referredById: true,
        },
      });
      level2Users.push(...l2s);
    }

    // Get all level 3 referrals
    let level3Users: {
      id: number;
      phoneNumber: string;
      createdAt: Date;
      referredById: number | null;
    }[] = [];
    for (const l2 of level2Users) {
      const l3s = await prisma.user.findMany({
        where: { referredById: l2.id },
        select: {
          id: true,
          phoneNumber: true,
          createdAt: true,
          referredById: true,
        },
      });
      level3Users.push(...l3s);
    }

    // Helper to get commission earned from a specific referred user
    async function getCommissionFromRef(userId: number, fromUserId: number) {
      const result = await prisma.referralCommission.aggregate({
        where: { userId, fromUserId },
        _sum: { amount: true },
      });
      return result._sum.amount || 0;
    }

    // Map each referral to include commission earned from them
    const level1 = await Promise.all(
      level1Users.map(async (u) => ({
        id: u.id,
        phoneNumber: u.phoneNumber,
        createdAt: u.createdAt,
        level: 1,
        moneyEarned: await getCommissionFromRef(userId, u.id),
      }))
    );
    const level2 = await Promise.all(
      level2Users.map(async (u) => ({
        id: u.id,
        phoneNumber: u.phoneNumber,
        createdAt: u.createdAt,
        level: 2,
        referredById: u.referredById,
        moneyEarned: await getCommissionFromRef(userId, u.id),
      }))
    );
    const level3 = await Promise.all(
      level3Users.map(async (u) => ({
        id: u.id,
        phoneNumber: u.phoneNumber,
        createdAt: u.createdAt,
        level: 3,
        referredById: u.referredById,
        moneyEarned: await getCommissionFromRef(userId, u.id),
      }))
    );

    // Get total commission earned
    const totalCommission = await prisma.referralCommission.aggregate({
      where: { userId },
      _sum: { amount: true },
    });

    return {
      referralCode: userId.toString(),
      totalEarnings: totalCommission._sum.amount || 0,
      totalReferrals: level1.length + level2.length + level3.length,
      referrals: [...level1, ...level2, ...level3],
      referralsByLevel: {
        level1: level1.length,
        level2: level2.length,
        level3: level3.length,
      },
    };
  }

  /**
   * Get user's referral earnings history
   */
  async getReferralEarnings(userId: number, limit: number = 50) {
    return await prisma.referralCommission.findMany({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            phoneNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });
  }
}

export const gameService = new GameService();
