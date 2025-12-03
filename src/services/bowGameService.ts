import { PrismaClient, Color } from "@prisma/client";
import type { Number } from "@prisma/client";
import { getIstDate } from "../utils/getIstDate";

const prisma = new PrismaClient({
  log: ["error", "warn"],
});

export class BowGameService {
  private currentPeriod: any = null;
  private periodTimer: NodeJS.Timeout | null = null;
  private midnightTimer: NodeJS.Timeout | null = null;

  /**
   * Initialize the BOW game service and start the period cycle
   */
  async initialize() {
    console.log("🎡 Initializing BOW Game Service...");

    // Ensure BOW game settings exist
    await this.ensureGameSettings();

    // Generate all periods for today
    await this.generatePeriodsForToday();

    // Schedule midnight task to generate tomorrow's periods
    this.scheduleMidnightTask();

    // Start or resume the current period
    await this.startOrResumePeriod();
  }

  /**
   * Schedule a task to run before midnight IST to generate next day's periods
   */
  private scheduleMidnightTask() {
    const now = getIstDate();

    // Calculate time until 23:59:00 IST (1 minute before midnight)
    const beforeMidnight = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        23,
        59,
        0,
        0
      )
    );

    // If we're past 23:59:00 today, schedule for tomorrow's 23:59:00
    if (now.getTime() >= beforeMidnight.getTime()) {
      beforeMidnight.setUTCDate(beforeMidnight.getUTCDate() + 1);
    }

    const timeUntilGeneration = beforeMidnight.getTime() - now.getTime();

    console.log(
      `⏰ [BOW] Scheduling next day period generation in ${Math.round(
        timeUntilGeneration / 1000 / 60
      )} minutes (at 23:59:00)`
    );

    this.midnightTimer = setTimeout(async () => {
      console.log("🌙 [BOW] 23:59:00 reached - generating tomorrow's periods");
      await this.generatePeriodsForTomorrow();
      // Reschedule for next day
      this.scheduleMidnightTask();
    }, timeUntilGeneration);
  }

  /**
   * Generate all periods for tomorrow
   */
  private async generatePeriodsForTomorrow() {
    const now = getIstDate();
    const settings = await prisma.gameSettings.findFirst();
    if (!settings) {
      throw new Error("BOW Game settings not found");
    }

    const periodDurationSeconds = settings.bowPeriodDuration;
    const periodDurationMs = periodDurationSeconds * 1000;
    const bettingDurationMs = settings.bowBettingDuration * 1000;
    const periodDurationMinutes = periodDurationSeconds / 60;

    // Get start of tomorrow (00:00:00 IST)
    const tomorrowStart = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0,
        0,
        0,
        0
      )
    );

    // Get end of tomorrow (23:59:59 IST)
    const tomorrowEnd = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        23,
        59,
        59,
        999
      )
    );

    // Calculate total periods in a day
    const totalPeriodsInDay = Math.floor(
      (24 * 60 * 60) / periodDurationSeconds
    );

    // Fetch all existing periods for tomorrow in ONE query
    const existingPeriods = await prisma.bowGamePeriod.findMany({
      where: {
        startTime: {
          gte: tomorrowStart,
          lte: tomorrowEnd,
        },
      },
      select: { periodId: true },
    });

    const existingPeriodIds = new Set(existingPeriods.map((p) => p.periodId));
    const periodsToCreate = [];

    for (let i = 0; i < totalPeriodsInDay; i++) {
      const periodStart = new Date(
        tomorrowStart.getTime() + i * periodDurationMs
      );
      const periodEnd = new Date(periodStart.getTime() + periodDurationMs);
      const bettingEndTime = new Date(
        periodStart.getTime() + bettingDurationMs
      );
      const periodId = this.generatePeriodId(
        periodStart,
        periodDurationMinutes
      );

      // Check in-memory set instead of database query
      if (!existingPeriodIds.has(periodId)) {
        periodsToCreate.push({
          periodId,
          startTime: periodStart,
          endTime: periodEnd,
          bettingEndTime,
          status: "not_started",
        });
      }
    }

    if (periodsToCreate.length > 0) {
      await prisma.bowGamePeriod.createMany({
        data: periodsToCreate,
        skipDuplicates: true,
      });
      console.log(
        `📅 [BOW] Pre-generated ${periodsToCreate.length} periods for tomorrow`
      );
    } else {
      console.log("✅ [BOW] All periods for tomorrow already exist");
    }
  }

  /**
   * Generate all periods for the current day based on game settings
   */
  private async generatePeriodsForToday() {
    const now = getIstDate();
    const settings = await prisma.gameSettings.findFirst();
    if (!settings) {
      throw new Error("BOW Game settings not found");
    }

    const periodDurationSeconds = settings.bowPeriodDuration;
    const periodDurationMs = periodDurationSeconds * 1000;
    const bettingDurationMs = settings.bowBettingDuration * 1000;
    const periodDurationMinutes = periodDurationSeconds / 60;

    // Get start of today (00:00:00 IST)
    const dayStart = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
        0
      )
    );

    // Get end of today (23:59:59 IST)
    const dayEnd = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        23,
        59,
        59,
        999
      )
    );

    // Calculate total periods in a day
    const totalPeriodsInDay = Math.floor(
      (24 * 60 * 60) / periodDurationSeconds
    );

    // Fetch all existing periods for today in ONE query
    const existingPeriods = await prisma.bowGamePeriod.findMany({
      where: {
        startTime: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      select: { periodId: true },
    });

    const existingPeriodIds = new Set(existingPeriods.map((p) => p.periodId));
    const periodsToCreate = [];

    for (let i = 0; i < totalPeriodsInDay; i++) {
      const periodStart = new Date(dayStart.getTime() + i * periodDurationMs);
      const periodEnd = new Date(periodStart.getTime() + periodDurationMs);
      const bettingEndTime = new Date(
        periodStart.getTime() + bettingDurationMs
      );
      const periodId = this.generatePeriodId(
        periodStart,
        periodDurationMinutes
      );

      // Check in-memory set instead of database query
      if (!existingPeriodIds.has(periodId)) {
        periodsToCreate.push({
          periodId,
          startTime: periodStart,
          endTime: periodEnd,
          bettingEndTime,
          status: "not_started",
        });
      }
    }

    if (periodsToCreate.length > 0) {
      await prisma.bowGamePeriod.createMany({
        data: periodsToCreate,
        skipDuplicates: true,
      });
      console.log(
        `📅 [BOW] Pre-generated ${periodsToCreate.length} periods for today`
      );
    } else {
      console.log("✅ [BOW] All periods for today already exist");
    }
  }

  /**
   * Ensure BOW game settings exist in the database
   */
  private async ensureGameSettings() {
    const settings = await prisma.gameSettings.findFirst();
    if (!settings) {
      await prisma.gameSettings.create({
        data: {
          bowPeriodDuration: 60, // 1 minute for BOW game
          bowBettingDuration: 55, // 55 seconds
          winMultiplier: 1.8,
          minBetAmount: 10,
          maxBetAmount: 10000,
          referralCommissionPercentage1: 1.0,
          referralCommissionPercentage2: 0.5,
          referralCommissionPercentage3: 0.25,
          referralSignupBonusInRs: 1.0,
          minRechargeForBonus: 500.0,
          minRechargeAmount: 200.0,
          maxRechargeAmount: 50000.0,
        },
      });
      console.log("✅ [BOW] Game settings initialized");
    }
  }

  /**
   * Generate period ID in format YYYYMMDD001
   */
  private generatePeriodId(date: Date, periodDurationMinutes: number): string {
    // Use UTC methods since date is already shifted by IST offset
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");

    // Calculate period number for the day based on dynamic period duration
    const minutesFromMidnight = date.getUTCHours() * 60 + date.getUTCMinutes();
    const periodNumber =
      Math.floor(minutesFromMidnight / periodDurationMinutes) + 1;

    return `${year}${month}${day}${String(periodNumber).padStart(3, "0")}`;
  }

  /**
   * Generate period start time and index from fixed slots
   */
  private getPeriodStartFromFixedSlots(
    date: Date,
    periodDurationSeconds: number
  ) {
    // date is already IST-shifted, so use UTC methods to get the correct day start
    const dayStart = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        0,
        0,
        0,
        0
      )
    );

    const secondsFromStart = Math.floor(
      (date.getTime() - dayStart.getTime()) / 1000
    );

    const periodIndex = Math.floor(secondsFromStart / periodDurationSeconds);
    const periodStart = new Date(
      dayStart.getTime() + periodIndex * periodDurationSeconds * 1000
    );

    return { periodIndex, periodStart };
  }

  /**
   * Start or resume the current period
   */
  private async startOrResumePeriod() {
    const now = getIstDate();

    // Fetch game settings for dynamic durations
    const settings = await prisma.gameSettings.findFirst();
    if (!settings) {
      throw new Error("BOW Game settings not found");
    }

    const periodDurationMinutes = settings.bowPeriodDuration / 60;

    // 1️⃣ get today's period slot based on dynamic duration
    const { periodIndex, periodStart } = this.getPeriodStartFromFixedSlots(
      now,
      settings.bowPeriodDuration
    );

    // 2️⃣ generate correct periodId
    const periodId = this.generatePeriodId(periodStart, periodDurationMinutes);

    // 3️⃣ Find the pre-generated period and activate it if not started
    let period = await prisma.bowGamePeriod.findUnique({
      where: { periodId },
    });

    // Fallback: If period doesn't exist, create it
    if (!period) {
      console.warn(
        `⚠️ [BOW] Period ${periodId} not pre-generated. Creating on-demand...`
      );
      const periodDurationMs = settings.bowPeriodDuration * 1000;
      const bettingDurationMs = settings.bowBettingDuration * 1000;
      const endTime = new Date(periodStart.getTime() + periodDurationMs);
      const bettingEndTime = new Date(
        periodStart.getTime() + bettingDurationMs
      );

      period = await prisma.bowGamePeriod.create({
        data: {
          periodId,
          startTime: periodStart,
          endTime,
          bettingEndTime,
          status: "active",
        },
      });
      console.log("🆘 [BOW] Created period on-demand:", periodId);
    }

    // If period is not_started, activate it
    if (period.status === "not_started") {
      period = await prisma.bowGamePeriod.update({
        where: { periodId },
        data: { status: "active" },
      });
      console.log("🆕 [BOW] Activated period:", periodId);
    } else if (period.status === "active") {
      console.log("♻️ [BOW] Resumed active period:", periodId);
    } else if (period.status === "betting_closed") {
      console.log("🔒 [BOW] Resumed betting-closed period:", periodId);
    } else {
      console.log("✅ [BOW] Period already completed:", periodId);
    }

    this.currentPeriod = period;

    // 4️⃣ schedule tasks
    const timeUntilEnd = period.endTime.getTime() - now.getTime();
    if (timeUntilEnd > 0) {
      this.schedulePeriodEnd(timeUntilEnd);

      const timeUntilBetting = period.bettingEndTime.getTime() - now.getTime();
      if (timeUntilBetting > 0) {
        setTimeout(() => this.lockBetting(), timeUntilBetting);
      } else {
        await this.lockBetting();
      }
    } else {
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

    console.log(
      `⏰ [BOW] Period will end in ${Math.round(delay / 1000)} seconds`
    );
  }

  /**
   * Lock betting for the current period
   */
  private async lockBetting() {
    if (!this.currentPeriod) return;

    await prisma.bowGamePeriod.update({
      where: { id: this.currentPeriod.id },
      data: { status: "betting_closed" },
    });

    console.log(
      `🔒 [BOW] Betting locked for period: ${this.currentPeriod.periodId}`
    );
  }

  /**
   * Complete the current period and determine winner
   */
  private async completePeriod() {
    if (!this.currentPeriod) return;

    console.log(`🏁 [BOW] Completing period: ${this.currentPeriod.periodId}`);

    // Get period with latest color totals from DB
    const period = await prisma.bowGamePeriod.findUnique({
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
      { number: "zero" as Number, total: period.totalZeroBets ?? 0 },
      { number: "two" as Number, total: period.totalTwoBets ?? 0 },
      { number: "four" as Number, total: period.totalFourBets ?? 0 },
      { number: "six" as Number, total: period.totalSixBets ?? 0 },
      { number: "eight" as Number, total: period.totalEightBets ?? 0 },
    ];

    const greenNumberTotals = [
      { number: "one" as Number, total: period.totalOneBets ?? 0 },
      { number: "three" as Number, total: period.totalThreeBets ?? 0 },
      { number: "five" as Number, total: period.totalFiveBets ?? 0 },
      { number: "seven" as Number, total: period.totalSevenBets ?? 0 },
      { number: "nine" as Number, total: period.totalNineBets ?? 0 },
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
    let numberTotals: { number: Number; total: number }[] = [];
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
            const next = sortedNumberTotals.find(
              (n) => n.number !== "zero" && n.number !== "five"
            );
            if (next) {
              winningNumberObj = next;
            }
          }
        }
      }
    }

    const winningColor = safeWinningColorObj.color;
    const winningNumber = winningNumberObj ? winningNumberObj.number : null;

    // Update period with winning color
    await prisma.bowGamePeriod.update({
      where: { id: period.id },
      data: {
        status: "completed",
        winningColor,
        winningNumber,
        completedAt: getIstDate(),
      },
    });

    console.log(
      `🏆 [BOW] Period ${period.periodId} completed. Winning color: ${winningColor}, Number: ${winningNumber}`
    );

    // Start next period FIRST
    await this.startOrResumePeriod();

    // Process all bets AFTER starting next period
    await this.settleBets(period.id, winningColor, winningNumber);
  }

  /**
   * Settle all bets for a completed period
   */
  private async settleBets(
    gamePeriodId: number,
    winningColor: Color,
    winningNumber: Number | null
  ) {
    const settings = await prisma.gameSettings.findFirst();
    if (!settings) return;

    let winMultiplierColor = settings.winMultiplier;
    let winMultiplierNumber = settings.winMultiplierForNumberBet;

    if (winningNumber === "zero" || winningNumber === "five") {
      winMultiplierNumber = settings.winMultiplierForNumberBetOnZeroOrFive;
    }

    // Use ONE transaction for everything
    await prisma.$transaction(async (tx) => {
      // 1. Update COLOR bets (bulk)
      await tx.$executeRawUnsafe(`
      UPDATE bow_bets
      SET 
        status = CASE WHEN color = '${winningColor}' AND number IS NULL THEN 'won' ELSE 'lost' END,
        win_amount = CASE WHEN color = '${winningColor}' AND number IS NULL THEN amount * ${winMultiplierColor} ELSE 0 END,
        settled_at = NOW()
      WHERE game_period_id = ${gamePeriodId} AND status = 'pending';
    `);

      // 2. Update NUMBER bets (bulk)
      if (winningNumber !== null) {
        await tx.$executeRawUnsafe(`
        UPDATE bow_bets
        SET 
          status = CASE WHEN number = '${winningNumber}' THEN 'won' ELSE status END,
          win_amount = CASE WHEN number = '${winningNumber}' THEN amount * ${winMultiplierNumber} ELSE win_amount END
        WHERE game_period_id = ${gamePeriodId} AND status = 'lost'; 
      `);
      }

      // 3. Update all user balances (bulk)
      await tx.$executeRawUnsafe(`
      UPDATE users u
      SET balance = u.balance + t.total_win
      FROM (
        SELECT user_id, SUM(win_amount) AS total_win
        FROM bow_bets
        WHERE game_period_id = ${gamePeriodId} AND status = 'won'
        GROUP BY user_id
      ) t
      WHERE u.id = t.user_id;
    `);

      // 4. Insert transactions (bulk)
      await tx.$executeRawUnsafe(`
      INSERT INTO transactions (transaction_id, user_id, amount, type, status, balance_before, balance_after, created_at, updated_at)
      SELECT 
        gen_random_uuid(),
        b.user_id,
        b.win_amount,
        'bet_win_credit',
        'completed',
        u.balance - b.win_amount,
        u.balance,
        NOW(),
        NOW()
      FROM bow_bets b
      JOIN users u ON b.user_id = u.id
      WHERE b.game_period_id = ${gamePeriodId} AND b.status = 'won';
    `);
    });
  }

  /**
   * Place a bet for a user
   */
  async placeBet(
    userId: number,
    color: Color | null,
    number: Number | null,
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

    const now = getIstDate();
    const period = await prisma.bowGamePeriod.findUnique({
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
      throw new Error("BOW Game settings not found");
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
    if (color) {
      betDescription = `BOW Bet on color ${color} - Period ${period.periodId}`;
    }

    if (number) {
      betDescription = `BOW Bet on number ${number} - Period ${period.periodId}`;
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
    const bet = await prisma.bowBet.create({
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

    // Update color totals and number totals
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
      await prisma.bowGamePeriod.update({
        where: { id: period.id },
        data: {
          [colorField]: { increment: amount },
        },
      });
    }

    if (numberField) {
      await prisma.bowGamePeriod.update({
        where: { id: period.id },
        data: {
          [numberField]: { increment: amount },
        },
      });
    }

    console.log(
      `🎲 [BOW] User ${userId} placed ${betDescription} of ${amount}`
    );

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
      const bettor = await prisma.user.findUnique({
        where: { id: bettorUserId },
        select: { referredById: true },
      });

      if (!bettor || !bettor.referredById) {
        return;
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
          const referrer = await prisma.user.findUnique({
            where: { id: commission.userId },
          });

          if (referrer) {
            const newBalance = referrer.balance + commissionAmount;

            await prisma.user.update({
              where: { id: commission.userId },
              data: { balance: newBalance },
            });

            await prisma.referralCommission.create({
              data: {
                userId: commission.userId,
                fromUserId: bettorUserId,
                betId,
                gameType: "bow",
                amount: commissionAmount,
                percentage: commission.percentage,
                level: commission.level,
              },
            });

            await prisma.transaction.create({
              data: {
                userId: commission.userId,
                type: "referral_commission",
                amount: commissionAmount,
                status: "completed",
                description: `L${commission.level} BOW Referral commission from bet #${betId}`,
                referenceId: betId.toString(),
                balanceBefore: referrer.balance,
                balanceAfter: newBalance,
              },
            });

            console.log(
              `💰 [BOW] L${commission.level} Commission: User ${
                commission.userId
              } earned ₹${commissionAmount.toFixed(
                2
              )} from User ${bettorUserId}'s bet`
            );
          }
        }
      }
    } catch (error) {
      console.error("[BOW] Error processing referral commissions:", error);
    }
  }

  /**
   * Get current period information
   */
  async getCurrentPeriod() {
    const now = getIstDate();

    if (this.currentPeriod) {
      try {
        const cp = this.currentPeriod as any;
        if (
          cp.startTime &&
          cp.endTime &&
          cp.startTime <= now &&
          now < cp.endTime
        ) {
          const timeRemaining = Math.max(
            0,
            cp.endTime.getTime() - now.getTime()
          );
          const bettingTimeRemaining = Math.max(
            0,
            cp.bettingEndTime.getTime() - now.getTime()
          );
          const canBet = cp.status === "active" && bettingTimeRemaining > 0;

          const {
            totalRedBets,
            totalGreenBets,
            totalPurpleBets,
            totalZeroBets,
            totalOneBets,
            totalTwoBets,
            totalThreeBets,
            totalFourBets,
            totalFiveBets,
            totalSixBets,
            totalSevenBets,
            totalEightBets,
            totalNineBets,
            ...filteredCp
          } = cp;

          return {
            ...filteredCp,
            timeRemaining: Math.floor(timeRemaining / 1000),
            bettingTimeRemaining: Math.floor(bettingTimeRemaining / 1000),
            canBet,
          };
        }
      } catch (err) {
        console.warn("[BOW] Warning reading in-memory currentPeriod:", err);
      }
    }

    let period = await prisma.bowGamePeriod.findFirst({
      where: {
        startTime: { lte: now },
        endTime: { gt: now },
      },
    });

    if (!period) {
      await this.startOrResumePeriod();
      period = this.currentPeriod as any;
    }

    if (!period) return null;

    const timeRemaining = Math.max(0, period.endTime.getTime() - now.getTime());
    const bettingTimeRemaining = Math.max(
      0,
      period.bettingEndTime.getTime() - now.getTime()
    );
    const canBet = period.status === "active" && bettingTimeRemaining > 0;

    const {
      totalRedBets,
      totalGreenBets,
      totalPurpleBets,
      totalZeroBets,
      totalOneBets,
      totalTwoBets,
      totalThreeBets,
      totalFourBets,
      totalFiveBets,
      totalSixBets,
      totalSevenBets,
      totalEightBets,
      totalNineBets,
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
    return await prisma.bowBet.findMany({
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
  async getUserBetHistory(
    userId: number,
    limit: number = 50,
    offset: number = 0
  ) {
    const [items, total] = await Promise.all([
      prisma.bowBet.findMany({
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
        skip: offset,
        take: limit,
      }),
      prisma.bowBet.count({ where: { userId } }),
    ]);

    return { items, total };
  }

  /**
   * Get period history
   */
  async getPeriodHistory(limit: number = 50, offset: number = 0) {
    const [items, total] = await Promise.all([
      prisma.bowGamePeriod.findMany({
        where: {
          status: "completed",
        },
        orderBy: {
          completedAt: "desc",
        },
        skip: offset,
        take: limit,
      }),
      prisma.bowGamePeriod.count({ where: { status: "completed" } }),
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
   * Cleanup - stop timers
   */
  cleanup() {
    if (this.periodTimer) {
      clearTimeout(this.periodTimer);
      this.periodTimer = null;
    }
    if (this.midnightTimer) {
      clearTimeout(this.midnightTimer);
      this.midnightTimer = null;
    }
  }
}

export const bowGameService = new BowGameService();
