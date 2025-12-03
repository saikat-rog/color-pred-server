import { Request, Response } from "express";
import { oneMinuteGameService } from "../services/oneMinuteGameService";
import type { Color, Number, BigOrSmall } from "@prisma/client";

/**
 * Get current 1-minute game period information
 */
export const getCurrentPeriod = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const period = await oneMinuteGameService.getCurrentPeriod();

    if (!period) {
      return res.status(404).json({
        success: false,
        message: "No active period found",
      });
    }

    res.json({
      success: true,
      data: period,
    });
  } catch (error: any) {
    console.error("[1m] Error fetching current period:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch current period",
      error: error.message,
    });
  }
};

/**
 * Place a bet in 1-minute game
 */
export const placeBet = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.user?.userId;
    const { color, amount, number, big_or_small } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    // Validate input - must have exactly one of color, number, or big_or_small
    const hasColor = color && ["green", "purple", "red"].includes(color.toLowerCase());
    const hasNumber = number && [
      "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"
    ].includes(number.toLowerCase());
    const hasBigOrSmall = big_or_small && ["big", "small"].includes(big_or_small.toLowerCase());

    if (!hasColor && !hasNumber && !hasBigOrSmall) {
      return res.status(400).json({
        success: false,
        message: "Invalid bet. Must bet on color (green/purple/red), number (zero-nine), or big/small",
      });
    }

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount. Must be a positive number",
      });
    }

    let numbersEnum: Number | null = null;
    if (number && typeof number === "string") {
      const normalized = number.trim().toLowerCase();
      if ([
        "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"
      ].includes(normalized)) {
        numbersEnum = normalized as Number;
      }
    }

    let bigOrSmallEnum: BigOrSmall | null = null;
    if (big_or_small && typeof big_or_small === "string") {
      const normalized = big_or_small.trim().toLowerCase();
      if (["big", "small"].includes(normalized)) {
        bigOrSmallEnum = normalized as BigOrSmall;
      }
    }

    const bet = await oneMinuteGameService.placeBet(
      userId,
      hasColor ? (color.toLowerCase() as Color) : null,
      numbersEnum,
      bigOrSmallEnum,
      amount
    );

    res.json({
      success: true,
      message: "Bet placed successfully",
      data: bet,
    });
  } catch (error: any) {
    console.error("[1m] Error placing bet:", error);

    // Handle specific errors
    if (
      error.message.includes("Betting is closed") ||
      error.message.includes("Betting time has ended") ||
      error.message.includes("Insufficient balance") ||
      error.message.includes("Minimum bet") ||
      error.message.includes("Maximum bet") ||
      error.message.includes("must bet on")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to place bet",
      error: error.message,
    });
  }
};

/**
 * Get user's bets for current period
 */
export const getUserBetsForCurrentPeriod = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const currentPeriod = await oneMinuteGameService.getCurrentPeriod();
    if (!currentPeriod) {
      return res.status(404).json({
        success: false,
        message: "No active period found",
      });
    }

    const bets = await oneMinuteGameService.getUserBetsForPeriod(
      userId,
      currentPeriod.periodId
    );

    res.json({
      success: true,
      data: bets,
    });
  } catch (error: any) {
    console.error("[1m] Error fetching user bets:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user bets",
      error: error.message,
    });
  }
};

/**
 * Get user's bet history
 */
export const getUserBetHistory = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const userId = req.user?.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const { items: bets, total } = await oneMinuteGameService.getUserBetHistory(
      userId,
      limit,
      offset
    );

    res.json({
      success: true,
      data: { bets, total, limit, offset },
    });
  } catch (error: any) {
    console.error("[1m] Error fetching bet history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bet history",
      error: error.message,
    });
  }
};

/**
 * Get period history
 */
export const getPeriodHistory = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    const { items: periods, total } = await oneMinuteGameService.getPeriodHistory(
      limit,
      offset
    );

    res.json({
      success: true,
      data: { periods, total, limit, offset },
    });
  } catch (error: any) {
    console.error("[1m] Error fetching period history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch period history",
      error: error.message,
    });
  }
};

/**
 * Get game settings (shared)
 */
export const getGameSettings = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const settings = await oneMinuteGameService.getGameSettings();

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "Game settings not found",
      });
    }

    res.json({
      success: true,
      data: settings,
    });
  } catch (error: any) {
    console.error("[1m] Error fetching game settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch game settings",
      error: error.message,
    });
  }
};
