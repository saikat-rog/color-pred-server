import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { PrismaClient } from '@prisma/client'
import { getIstDate } from '../utils/getIstDate';

const prisma = new PrismaClient();

export class AdminController {
  // Get users with id, phone number, and balance for a given date or range
  async getUsersByDate(req: Request, res: Response): Promise<void> {
    try {
      let { date, startDate, endDate } = req.query as { date?: string; startDate?: string; endDate?: string };
      let where: any = {};
      if (date) {
        // Single day: users created on this date
        const d = new Date(date);
        const next = new Date(d);
        next.setDate(d.getDate() + 1);
        where.createdAt = { gte: d, lt: next };
      } else if (startDate && endDate) {
        // Range: users created between startDate and endDate (inclusive)
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1);
        where.createdAt = { gte: start, lt: end };
      }
      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          phoneNumber: true,
          balance: true,
        },
        orderBy: { createdAt: 'asc' },
      });
      res.status(200).json({ success: true, data: users });
    } catch (error) {
      console.error('Admin getUsersByDate error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { username, password, secretWord } = req.body;
      if (!username || !password || !secretWord) {
        res.status(400).json({ success: false, message: 'username, password and secretWord are required' });
        return;
      }

      // Fetch admin via raw SQL to avoid client type mismatch if generate failed
      const admins = await prisma.$queryRawUnsafe<any[]>(
        'SELECT id, username, password_hash as "passwordHash", secret_word_hash as "secretWordHash" FROM admins WHERE username = $1 LIMIT 1',
        username
      );
      const admin = admins[0];
      if (!admin) {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
        return;
      }

      const passOk = await bcrypt.compare(password, admin.passwordHash);
      const secretOk = await bcrypt.compare(secretWord, admin.secretWordHash);
      if (!passOk || !secretOk) {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
        return;
      }

      const token = jwt.sign(
        { adminId: admin.id, username: admin.username },
        (process.env.ADMIN_JWT_SECRET || (config.jwt.secret as string)) as string,
        { expiresIn: (process.env.ADMIN_JWT_EXPIRES_IN || '1d') as string } as jwt.SignOptions
      );

      res.status(200).json({ success: true, message: 'Login successful', data: { token } });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async listUsers(req: Request, res: Response): Promise<void> {
    try {
      const limit = Math.min(parseInt((req.query.limit as string) || '10', 10), 100);
      const offset = Math.max(parseInt((req.query.offset as string) || '0', 10), 0);
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
          select: {
            id: true,
            phoneNumber: true,
            isVerified: true,
            isBanned: true,
            balance: true,
            createdAt: true,
          },
        }),
        prisma.user.count(),
      ]);
      res.status(200).json({ success: true, data: { users, total, limit, offset } });
    } catch (error) {
      console.error('Admin listUsers error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async getUser(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id as string, 10);

      // Limits for heavy lists
      const txLimit = Math.min(parseInt((req.query.txLimit as string) || '100', 10), 500);
      const betLimit = Math.min(parseInt((req.query.betLimit as string) || '100', 10), 500);
      const rcLimit = Math.min(parseInt((req.query.rcLimit as string) || '100', 10), 500);

      // Core user with relations
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          phoneNumber: true,
          isVerified: true,
          isBanned: true,
          balance: true,
          createdAt: true,
          updatedAt: true,
          referredById: true,
          referredBy: { select: { id: true, phoneNumber: true } },
          bankAccounts: {
            select: {
              id: true,
              accountNumber: true,
              accountName: true,
              ifscCode: true,
              upiId: true,
              isDefault: true,
              createdAt: true,
            },
          },
        },
      });

      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      const now =  getIstDate();
      const ageMs = now.getTime() - new Date(user.createdAt).getTime();
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

      // Note: transactions, bets, withdrawals moved to separate paginated endpoints

      // Referral commissions detail
      const [commEarnedTotal, commEarnedByLevel, commGeneratedTotal] = await Promise.all([
        prisma.referralCommission.aggregate({ where: { userId: id }, _sum: { amount: true }, _count: { id: true } }),
        prisma.referralCommission.groupBy({ by: ['level'], where: { userId: id }, _sum: { amount: true }, _count: { id: true } }),
        prisma.referralCommission.aggregate({ where: { fromUserId: id }, _sum: { amount: true }, _count: { id: true } }),
      ]);

      // Build full 3-level referrals with earnings from each
      const level1Users = await prisma.user.findMany({
        where: { referredById: id },
        select: { id: true, phoneNumber: true, createdAt: true },
      });

      const level2UsersRaw = await Promise.all(
        level1Users.map((l1) =>
          prisma.user.findMany({ where: { referredById: l1.id }, select: { id: true, phoneNumber: true, createdAt: true, referredById: true } })
        )
      );
      const level2Users = level2UsersRaw.flat();

      const level3UsersRaw = await Promise.all(
        level2Users.map((l2) =>
          prisma.user.findMany({ where: { referredById: l2.id }, select: { id: true, phoneNumber: true, createdAt: true, referredById: true } })
        )
      );
      const level3Users = level3UsersRaw.flat();

      const commissionFromRef = async (fromUserId: number) => {
        const ag = await prisma.referralCommission.aggregate({ where: { userId: id, fromUserId }, _sum: { amount: true } });
        return ag._sum.amount || 0;
      };

      // For each level-1 referral, check if referral bonus actually credited to CURRENT user
      const level1 = await Promise.all(
        level1Users.map(async (u) => {
          const earned = await commissionFromRef(u.id);
          const bonusTx = await prisma.transaction.findFirst({
            where: {
              userId: id,
              type: 'referral_bonus',
              referenceId: String(u.id),
              status: 'completed',
            },
            orderBy: { createdAt: 'desc' },
          });
          return {
            id: u.id,
            phoneNumber: u.phoneNumber,
            createdAt: u.createdAt,
            level: 1,
            moneyEarned: earned,
            referralBonusCredited: !!bonusTx,
            referralBonusTransactionId: bonusTx?.id ?? null,
            referralBonusAmount: bonusTx?.amount ?? null,
            referralBonusAt: bonusTx?.createdAt ?? null,
          };
        })
      );

      const level2 = await Promise.all(
        level2Users.map(async (u: any) => ({
          id: u.id,
          phoneNumber: u.phoneNumber,
          createdAt: u.createdAt,
          level: 2,
          referredById: u.referredById,
          moneyEarned: await commissionFromRef(u.id),
        }))
      );

      const level3 = await Promise.all(
        level3Users.map(async (u: any) => ({
          id: u.id,
          phoneNumber: u.phoneNumber,
          createdAt: u.createdAt,
          level: 3,
          referredById: u.referredById,
          moneyEarned: await commissionFromRef(u.id),
        }))
      );

      // Summary (same as /summary)
      const [recharge, withdraw, betDebits, betWins] = await Promise.all([
        prisma.transaction.aggregate({ where: { userId: id, type: 'recharge', status: 'completed' }, _sum: { amount: true } }),
        prisma.transaction.aggregate({ where: { userId: id, type: 'withdrawal', status: 'completed' }, _sum: { amount: true } }),
        prisma.transaction.aggregate({ where: { userId: id, type: 'bet_debit', status: 'completed' }, _sum: { amount: true } }),
        prisma.transaction.aggregate({ where: { userId: id, type: 'bet_win_credit', status: 'completed' }, _sum: { amount: true } }),
      ]);

      const totalRecharge = recharge._sum.amount || 0;
      const totalWithdrawal = withdraw._sum.amount || 0;
      const totalBetOut = betDebits._sum.amount || 0;
      const totalBetIn = betWins._sum.amount || 0;
      const netPL = totalBetIn - totalBetOut;

      res.status(200).json({
        success: true,
        data: {
          user: {
            ...user,
            ageDays,
          },
          referrer: user.referredBy,
          referrals: {
            total: level1.length + level2.length + level3.length,
            level1,
            level2,
            level3,
          },
          referral: {
            commissionsEarned: {
              totalAmount: commEarnedTotal._sum.amount || 0,
              count: commEarnedTotal._count.id || 0,
              byLevel: commEarnedByLevel.map((r) => ({ level: r.level, total: r._sum.amount || 0, count: r._count.id })),
            },
            commissionsGeneratedForOthers: {
              totalAmount: commGeneratedTotal._sum.amount || 0,
              count: commGeneratedTotal._count.id || 0,
            },
          },
          summary: {
            totalRecharge,
            totalWithdrawal,
            totalBetOut,
            totalBetIn,
            netProfitLoss: netPL,
          },
        },
      });
    } catch (error) {
      console.error('Admin getUser error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async banUser(req: Request, res: Response): Promise<void> {
    try {
  const id = parseInt(req.params.id as string, 10);
      const { ban } = req.body as { ban: boolean };
  await prisma.$executeRawUnsafe('UPDATE users SET is_banned = $1 WHERE id = $2', !!ban, id);
      // Delete refresh tokens to invalidate active sessions
      await prisma.refreshToken.deleteMany({ where: { userId: id } });
  res.status(200).json({ success: true, message: ban ? 'User banned' : 'User unbanned', data: { id, isBanned: !!ban } });
    } catch (error) {
      console.error('Admin banUser error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async userSummary(req: Request, res: Response): Promise<void> {
    try {
  const id = parseInt(req.params.id as string, 10);

      const [recharge, withdraw, betDebits, betWins] = await Promise.all([
        prisma.transaction.aggregate({ where: { userId: id, type: 'recharge', status: 'completed' }, _sum: { amount: true } }),
        prisma.transaction.aggregate({ where: { userId: id, type: 'withdrawal', status: 'completed' }, _sum: { amount: true } }),
        prisma.transaction.aggregate({ where: { userId: id, type: 'bet_debit', status: 'completed' }, _sum: { amount: true } }),
        prisma.transaction.aggregate({ where: { userId: id, type: 'bet_win_credit', status: 'completed' }, _sum: { amount: true } }),
      ]);

      const totalRecharge = recharge._sum.amount || 0;
      const totalWithdrawal = withdraw._sum.amount || 0;
      const totalBetOut = betDebits._sum.amount || 0;
      const totalBetIn = betWins._sum.amount || 0;

      const netPL = totalBetIn - totalBetOut; // positive means user profit

      res.status(200).json({
        success: true,
        data: {
          totalRecharge,
          totalWithdrawal,
          totalBetOut,
          totalBetIn,
          netProfitLoss: netPL,
        },
      });
    } catch (error) {
      console.error('Admin userSummary error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async dashboard(req: Request, res: Response): Promise<void> {
    try {
      const start = new Date(); start.setHours(0,0,0,0);
      const end = new Date(); end.setHours(23,59,59,999);

      const [betsTotal, winningsTotal] = await Promise.all([
        prisma.transaction.aggregate({ where: { type: 'bet_debit', status: 'completed', createdAt: { gte: start, lte: end } }, _sum: { amount: true } }),
        prisma.transaction.aggregate({ where: { type: 'bet_win_credit', status: 'completed', createdAt: { gte: start, lte: end } }, _sum: { amount: true } }),
      ]);

      const totalBets = betsTotal._sum.amount || 0;
      const totalCredited = winningsTotal._sum.amount || 0;
      const profit = totalBets - totalCredited;

      res.status(200).json({ success: true, data: { date: start.toISOString().slice(0,10), totalBets, totalCredited, profit } });
    } catch (error) {
      console.error('Admin dashboard error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async getSettings(req: Request, res: Response): Promise<void> {
    try {
      const settings = await prisma.gameSettings.findFirst();
      res.status(200).json({ success: true, data: settings });
    } catch (error) {
      console.error('Admin getSettings error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const settings = await prisma.gameSettings.findFirst();
      if (!settings) {
        res.status(404).json({ success: false, message: 'Settings not found' });
        return;
      }
      // Whitelist allowed fields and coerce numeric strings
      const allowedFloatKeys = [
        'winMultiplier',
        'minBetAmount',
        'maxBetAmount',
        'referralCommissionPercentage1',
        'referralCommissionPercentage2',
        'referralCommissionPercentage3',
        'referralSignupBonusInRs',
        'minRechargeForBonus',
      ] as const;
      const allowedIntKeys = [
        'periodDuration',
        'bettingDuration',
      ] as const;

      type FloatKey = typeof allowedFloatKeys[number];
      type IntKey = typeof allowedIntKeys[number];

      const body = req.body as Record<string, unknown>;
      const data: Record<string, number> = {};
      const ignored: string[] = [];

      const coerceNumber = (v: unknown): number | undefined => {
        if (typeof v === 'number' && Number.isFinite(v)) return v;
        if (typeof v === 'string' && v.trim() !== '') {
          const n = Number(v);
          if (!Number.isNaN(n) && Number.isFinite(n)) return n;
        }
        return undefined;
      };

      for (const key of allowedFloatKeys) {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
          const num = coerceNumber(body[key]);
          if (num === undefined) ignored.push(key);
          else data[key] = num;
        }
      }
      for (const key of allowedIntKeys) {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
          const num = coerceNumber(body[key]);
          if (num === undefined) ignored.push(key);
          else data[key] = Math.trunc(num);
        }
      }

      if (Object.keys(data).length === 0) {
        res.status(400).json({ success: false, message: 'No valid fields to update', ignoredFields: ignored });
        return;
      }

      const updated = await prisma.gameSettings.update({ where: { id: settings.id }, data });
      res.status(200).json({ success: true, message: 'Settings updated', data: updated, ignoredFields: ignored });
    } catch (error) {
      console.error('Admin updateSettings error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async listPeriods(req: Request, res: Response): Promise<void> {
    try {
      const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);
      const periods = await prisma.gamePeriod.findMany({
        orderBy: { startTime: 'desc' },
        take: limit,
        select: {
          id: true,
          periodId: true,
          startTime: true,
          endTime: true,
          bettingEndTime: true,
          status: true,
          winningColor: true,
          totalGreenBets: true,
          totalPurpleBets: true,
          totalRedBets: true,
          completedAt: true,
        },
      });
      res.status(200).json({ success: true, data: periods });
    } catch (error) {
      console.error('Admin listPeriods error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // New: Paginated user transactions
  async getUserTransactions(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id as string, 10);
      const limit = Math.min(parseInt((req.query.limit as string) || '10', 10), 100);
      const offset = Math.max(parseInt((req.query.offset as string) || '0', 10), 0);

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, skip: offset, take: limit }),
        prisma.transaction.count({ where: { userId: id } }),
      ]);

      res.status(200).json({ success: true, data: { transactions, total, limit, offset } });
    } catch (error) {
      console.error('Admin getUserTransactions error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // New: Paginated user withdrawals
  async getUserWithdrawals(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id as string, 10);
      const limit = Math.min(parseInt((req.query.limit as string) || '10', 10), 100);
      const offset = Math.max(parseInt((req.query.offset as string) || '0', 10), 0);

      const [withdrawals, total] = await Promise.all([
        prisma.withdrawalRequest.findMany({
          where: { userId: id },
          orderBy: { requestedAt: 'desc' },
          skip: offset,
          take: limit,
          include: {
            bankAccount: {
              select: {
                id: true,
                accountNumber: true,
                accountName: true,
                ifscCode: true,
                upiId: true,
                isDefault: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        }),
        prisma.withdrawalRequest.count({ where: { userId: id } }),
      ]);

      res.status(200).json({ success: true, data: { withdrawals, total, limit, offset } });
    } catch (error) {
      console.error('Admin getUserWithdrawals error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // New: Paginated user bets (with period snapshot)
  async getUserBets(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id as string, 10);
      const limit = Math.min(parseInt((req.query.limit as string) || '10', 10), 100);
      const offset = Math.max(parseInt((req.query.offset as string) || '0', 10), 0);

      const [bets, total] = await Promise.all([
        prisma.bet.findMany({
          where: { userId: id },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
          include: { gamePeriod: { select: { periodId: true, status: true, winningColor: true, startTime: true, endTime: true } } },
        }),
        prisma.bet.count({ where: { userId: id } }),
      ]);

      res.status(200).json({ success: true, data: { bets, total, limit, offset } });
    } catch (error) {
      console.error('Admin getUserBets error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}

export const adminController = new AdminController();
