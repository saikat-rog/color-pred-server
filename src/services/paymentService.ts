import { PrismaClient } from "@prisma/client";
import axios from "axios";
import crypto from "crypto";
import { config } from "../config";
import { databaseService } from "./databaseService";

const prisma = new PrismaClient();

export class PaymentService {

  async initiatePaymentWithBondPay(
    userId: number,
    amount: string,
    description: string
  ): Promise<any> {
    // Build merchant_order_no using crypto.randomUUID() to avoid ESM-only uuid issues
    const merchant_order_no = `TRX_${crypto.randomUUID()}`;

    // Format amount as string with two decimals
    const amountStr = Number(amount).toFixed(2);

    // Generate md5 hash signature for bondpay
    const str =
      config.bondpay.merchantId +
      amountStr +
      merchant_order_no +
      config.bondpay.apiKey +
      config.bondpay.callbackUrl;

    const signature = crypto.createHash("md5").update(str).digest("hex");

    // Prepare payload
    const payloadForPaymentUrl: any = {
      merchant_id: config.bondpay.merchantId,
      api_key: config.bondpay.apiKey,
      amount: amountStr,
      merchant_order_no: merchant_order_no,
      callback_url: config.bondpay.callbackUrl,
      extra: 0,
      signature: signature,
    };

    // Make POST request using axios
    let providerResponse: any = null;
    try {
      const response = await axios.post(
        config.bondpay.apiUrl,
        payloadForPaymentUrl,
        {
          headers: { "Content-Type": "application/json" },
        }
      );
      providerResponse = response.data;
    } catch (err: any) {
      // Handle axios error with response (non-2xx) or network error
      if (axios.isAxiosError(err) && err.response) {
        providerResponse = err.response.data;
        console.error(
          "BondPay provider error",
          err.response.status,
          providerResponse
        );
        return {
          success: false,
          statusCode: 502,
          message: "Bondpay returned an error",
          provider: providerResponse,
        };
      }

      console.error("Error calling BondPay provider:", err);
      return {
        success: false,
        statusCode: 502,
        message: "Failed to connect BondPay",
        error: String(err),
      };
    }

    // At this point provider responded with success (2xx). Proceed to add recharge.
    let transactionData: any = {
      userId,
      type: "recharge",
      amount: Number(amount),
      description: description || `Recharge via BondPay (ORDER NUM: ${providerResponse?.order_no || 'N/A'})`,
      referenceId: merchant_order_no,
    };

    // Use the dedicated helper which creates a transaction for wallet recharge
    const transaction =
      await databaseService.createTransactionForWalletRecharge(transactionData);

    // Process referral bonus if applicable (use already-imported gameService)
    // await gameService.processReferralBonus(userId, amount);

    // Extract payment URL from provider response (handle common variants)
    const paymentUrl = providerResponse?.payment_url || null;

    return {
      success: true,
      statusCode: 200,
      message: "Recharge initiated successfully",
      data: {
        amount: amount,
        paymentUrl,
        merchantOrderNo: merchant_order_no,
        providerOrderNo: providerResponse?.order_no,
      },
    };
  }
}
