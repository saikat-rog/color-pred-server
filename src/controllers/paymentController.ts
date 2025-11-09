import { Request, response, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { PaymentService } from "../services/paymentService";
import { databaseService } from "../services/databaseService";
import { gameService } from "../services/gameService";
import { config } from "../config";
import crypto from "crypto";
import { log } from "console";

const prisma = new PrismaClient();

export class PaymentController {
  async paymentCallback(req: Request, res: Response) {
    const payload = req.body || {};

    // Persist full request (headers, query, body) and capture log id so we can save response later
    let requestLogId: number | null = null;
    try {
      const ipValEarly =
        (req.ip as string) ||
        (req.headers["x-forwarded-for"] as string) ||
        undefined;
      const logDataEarly: any = {
        path: req.path,
        method: req.method,
        headers: req.headers as any,
        query: req.query as any,
        body: payload as any,
      };
      if (ipValEarly) logDataEarly.ip = ipValEarly;

      const createdLog = await databaseService
        .createRequestLogOfCallbackUrl(logDataEarly)
        .catch((err) => {
          console.error("Failed to persist incoming request log (early):", err);
          return null;
        });
      requestLogId = createdLog?.id ?? null;
    } catch (e) {
      console.error("Failed to create initial request log:", e);
    }

    // Attach response interceptors so we can persist the outgoing response later
    try {
      const originalJson = (res as any).json?.bind(res);
      const originalSend = (res as any).send?.bind(res);
      const originalEnd = (res as any).end?.bind(res);

      const persistResponse = (body: any) => {
        try {
          if (requestLogId) {
            databaseService
              .updateRequestLogResponseOfCallbackUrl(requestLogId, body)
              .catch((err) => {
                console.error(
                  "Failed to update request log with response:",
                  err
                );
              });
          }
        } catch (err) {
          console.error("Error persisting response to request log:", err);
        }
      };

      if (originalJson) {
        (res as any).json = function (body: any) {
          persistResponse(body);
          return originalJson(body);
        };
      }

      if (originalSend) {
        (res as any).send = function (body: any) {
          let toStore: any = body;
          try {
            if (typeof body === "string") {
              try {
                toStore = JSON.parse(body);
              } catch (_) {
                toStore = { text: body };
              }
            }
            if (Buffer.isBuffer(body)) {
              toStore = { buffer: body.toString("utf8") };
            }
          } catch (_) {
            toStore = { raw: String(body) };
          }
          persistResponse(toStore);
          return originalSend(body);
        };
      }

      if (originalEnd) {
        (res as any).end = function (chunk: any, encoding?: any) {
          if (chunk) {
            let chunkToStore: any = chunk;
            try {
              if (Buffer.isBuffer(chunk))
                chunkToStore = chunk.toString(encoding || "utf8");
              if (typeof chunkToStore === "string") {
                try {
                  chunkToStore = JSON.parse(chunkToStore);
                } catch (_) {
                  chunkToStore = { text: chunkToStore };
                }
              }
            } catch (_) {
              chunkToStore = { raw: String(chunk) };
            }
            persistResponse(chunkToStore);
          }
          return originalEnd(chunk, encoding);
        };
      }
    } catch (err) {
      console.error("Failed to attach response interceptors:", err);
    }

    const { merchantOrder, status, amount } = payload;

    // Basic validation
    if (!merchantOrder || !status) {
      return res.status(400).json({
        message: "Invalid payload: merchantOrder and status are required",
      });
    }

    const numericAmount = Number(amount || 0);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      // We allow zero only if provider uses different flow; treat as invalid for safety
      return res.status(400).json({ message: "Invalid amount" });
    }

    const amountStr = Number(amount).toFixed(2);

    const str =
      config.bondpay.merchantId +
      amountStr +
      merchantOrder +
      config.bondpay.apiKey +
      config.bondpay.callbackUrl;

    const signature = crypto.createHash("md5").update(str).digest("hex");

    const ipVal =
      (req.ip as string) ||
      (req.headers["x-forwarded-for"] as string) ||
      undefined;
    const logData: any = {
      path: req.path,
      method: req.method,
      headers: req.headers as any,
      query: req.query as any,
      body: payload as any,
    };
    if (ipVal) logData.ip = ipVal;

    try {
      // Find the transaction initiated earlier using merchant_order (saved as referenceId)
      const existingTx = await prisma.transaction.findFirst({
        where: { transactionId: merchantOrder },
      });

      if (existingTx?.referenceId !== signature) {
        // If signatures don't match, log and return 403
        console.error(
          `Payment callback: signature mismatch for merchantOrder ${merchantOrder}`
        );
        return res.status(403).json({
          message: "Signature mismatch",
        });
      }

      // If provider reports failure, mark pending tx as failed (if exists)
      if (status !== "success") {
        if (existingTx && existingTx.status === "pending") {
          await prisma.transaction.update({
            where: { id: existingTx.id },
            data: {
              status: "pending",
              updatedAt: new Date(),
            },
          });
        } else if (existingTx && existingTx.status === "failed") {
          await prisma.transaction.update({
            where: { id: existingTx.id },
            data: {
              status: "failed",
              updatedAt: new Date(),
            },
          });
        }

        return res.status(200).json({
          status: "ok",
          message: "Callback received successfully",
        });
      }

      // Idempotency: if already completed, return success
      if (existingTx.status === "completed") {
        return res.status(200).json({
          status: "ok",
          message: "Callback received successfully",
        });
      }

      // Atomically update user balance and mark the existing transaction as completed
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: existingTx.userId },
        });
        if (!user) throw new Error("User not found for transaction");

        const balanceBefore = user.balance;
        const balanceAfter = balanceBefore + numericAmount;

        await tx.user.update({
          where: { id: user.id },
          data: { balance: balanceAfter },
        });

        await tx.transaction.update({
          where: { id: existingTx.id },
          data: {
            status: "completed",
            // ensure stored amount matches provider's settled amount
            amount: numericAmount,
            balanceBefore,
            balanceAfter,
            updatedAt: new Date(),
          },
        });
        // Trigger referral bonus processing.
        await gameService.processReferralBonus(user.id, amount);
      });

      const response = {
        status: "ok",
        message: "Callback received successfully",
      };

      return res.status(200).json(response);
    } catch (err: any) {
      console.error("Error processing payment callback:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  async initiateRecharge(req: Request, res: Response): Promise<void> {
    const paymentService = new PaymentService();

    try {
      const userId = (req as any).user?.userId;
      const { amount, description, paymentMethod } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      // Load game service and settings to get minimum recharge amount
      const gameServiceModule = await import("../services/gameService");
      const gameService = gameServiceModule.gameService;
      const settings = await gameService.getGameSettings();
      const minRecharge = (settings as any)?.minRechargeAmount ?? 200;
      const maxRecharge = (settings as any)?.maxRechargeAmount ?? 50000;

      // Validate the recharge amount
      if (!amount || amount < minRecharge || amount > maxRecharge) {
        res.status(400).json({
          success: false,
          message: `Minimum recharge amount is ₹${minRecharge} and maximum is ₹${maxRecharge}`,
        });
        return;
      }

      // Route to correct payment method handler
      let result: any;
      switch (paymentMethod) {
        case "bondpay":
          result = await paymentService.initiatePaymentWithBondPay(
            userId,
            amount,
            description
          );
          break;

        case "onepay":
          result = {
            success: false,
            statusCode: 501,
            message: "OnePay integration is not yet implemented",
          };
          break;

        // Handle default case where payment method is not recognized
        default:
          result = await paymentService.initiatePaymentWithBondPay(
            userId,
            amount,
            description
          );
          break;
      }

      // Capture the result and respond accordingly
      if (!result || result.success === false) {
        const code = result?.statusCode || 502;
        res.status(code).json(result);
        return;
      }

      res.status(200).json(result);
      return;
    } catch (error) {
      console.error("Error in initiateRecharge:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}
