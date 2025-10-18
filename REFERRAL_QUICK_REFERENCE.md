# Quick Reference - Referral System

## 🎯 Quick Facts

- **Referral Code**: Each user's ID number (e.g., User ID 42 has code "42")
- **Commission Levels**: 3 levels deep (1% → 0.5% → 0.25%)
- **Signup Bonus**: ₹1 when referral recharges ≥ ₹500
- **Auto-Credit**: All commissions and bonuses are instant
- **One-Time Bonus**: Signup bonus given only once per referral

---

## 📱 User Actions

### Signup with Referral Code

```json
POST /api/auth/signup/complete
{
  "phoneNumber": "9876543210",
  "otp": "123456",
  "password": "SecurePass@123",
  "referralCode": "42"  ← Optional
}
```

### Get My Referral Code

```json
GET /api/auth/profile
Response: {
  "user": {
    "id": 42,  ← This is your referral code!
    ...
  }
}
```

### Check My Referrals

```json
GET /api/game/referral/info
Response: {
  "userId": 42,
  "referralCode": "42",
  "totalReferrals": 5,
  "referrals": [...]
}
```

### Check My Earnings

```json
GET /api/game/referral/earnings?limit=50
Response: {
  "totalEarnings": 125.50,
  "commissions": [...]
}
```

---

## 💰 Commission Breakdown

### Example: ₹1000 Bet

```
User D places ₹1000 bet

Chain: D ← C ← B ← A

Commissions:
C: ₹10.00  (1.0%)  Level 1
B: ₹5.00   (0.5%)  Level 2
A: ₹2.50   (0.25%) Level 3
```

### Formula

```javascript
Level 1: betAmount × 1.0% = commission
Level 2: betAmount × 0.5% = commission
Level 3: betAmount × 0.25% = commission
```

---

## 🎁 Signup Bonus Flow

```
1. User A shares code "1" with friend
2. Friend signs up with referralCode: "1"
3. Friend recharges ₹500 or more
4. User A gets ₹1 bonus (auto-credited)
5. Status: hasClaimedReferralBonus = true
6. Future recharges = no more bonus (one-time only)
```

---

## ⚙️ Admin: Change Settings

### Via API

```bash
curl -X PUT http://localhost:3000/api/game/settings \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "referralCommissionL1": 2.0,
    "referralCommissionL2": 1.0,
    "referralCommissionL3": 0.5,
    "referralSignupBonus": 5.0,
    "minRechargeForBonus": 1000.0
  }'
```

### Via Database

```sql
UPDATE game_settings SET
  referral_commission_l1 = 2.0,
  referral_commission_l2 = 1.0,
  referral_commission_l3 = 0.5,
  referral_signup_bonus = 5.0,
  min_recharge_for_bonus = 1000.0;
```

---

## 🔍 Common Queries

### Find Top Referrers

```sql
SELECT 
  u.id,
  u.phone_number,
  COUNT(r.id) as total_referrals,
  COALESCE(SUM(rc.amount), 0) as total_earned
FROM users u
LEFT JOIN users r ON r.referred_by_id = u.id
LEFT JOIN referral_commissions rc ON rc.user_id = u.id
GROUP BY u.id
ORDER BY total_earned DESC
LIMIT 10;
```

### Check User's Referral Chain

```sql
-- Who referred User 10?
SELECT referred_by_id FROM users WHERE id = 10;

-- Who did User 10 refer?
SELECT id, phone_number FROM users WHERE referred_by_id = 10;
```

### Total Commissions Paid

```sql
SELECT SUM(amount) as total_paid
FROM referral_commissions;
```

### User's Total Earnings

```sql
SELECT 
  SUM(CASE WHEN type = 'referral_commission' THEN amount ELSE 0 END) as commissions,
  SUM(CASE WHEN type = 'referral_bonus' THEN amount ELSE 0 END) as bonuses,
  SUM(amount) as total
FROM transactions
WHERE user_id = 1 
  AND type IN ('referral_commission', 'referral_bonus');
```

---

## 🐛 Troubleshooting

### Bonus Not Credited?

**Check:**
```sql
-- Is recharge >= minimum?
SELECT min_recharge_for_bonus FROM game_settings;

-- Has bonus been claimed?
SELECT has_claimed_referral_bonus, referred_by_id 
FROM users WHERE id = ?;

-- Does referrer exist?
SELECT id FROM users WHERE id = (
  SELECT referred_by_id FROM users WHERE id = ?
);
```

### Commission Not Received?

**Check:**
```sql
-- Was bet recorded?
SELECT * FROM bets WHERE user_id = ? ORDER BY created_at DESC LIMIT 1;

-- Check referral chain
SELECT id, referred_by_id FROM users WHERE id = ?;

-- Check commission settings
SELECT 
  referral_commission_l1,
  referral_commission_l2,
  referral_commission_l3
FROM game_settings;
```

### Invalid Referral Code?

**Verify:**
```sql
-- Does user exist?
SELECT id, phone_number FROM users WHERE id = ?;
```

---

## 📊 Dashboard Metrics

### Key Metrics to Track

1. **Total Referrals**
   - Count of users with referredById set

2. **Active Referrals**
   - Referrals who made at least 1 bet

3. **Total Commissions Paid**
   - Sum of all referral_commission transactions

4. **Total Bonuses Paid**
   - Sum of all referral_bonus transactions

5. **Average Commission per Bet**
   - Total commissions / Total bets

6. **Conversion Rate**
   - (Referrals with recharge ≥ min) / Total referrals

---

## 🎮 Testing Checklist

- [ ] Signup with valid referral code works
- [ ] Signup bonus credited on qualifying recharge
- [ ] Signup bonus only given once
- [ ] Level 1 commission works
- [ ] Level 2 commission works
- [ ] Level 3 commission works
- [ ] No commission beyond Level 3
- [ ] Commissions credited instantly
- [ ] Transaction records created
- [ ] Referral info API works
- [ ] Earnings API works
- [ ] Settings update works

---

## 💡 Pro Tips

1. **Share Your Code**: Users should share their ID as referral code
2. **Track Performance**: Monitor which referrals are most active
3. **Set Competitive Rates**: Adjust commissions to incentivize referrals
4. **Promote Signup Bonus**: Highlight the bonus in marketing
5. **Monitor Costs**: Track total commissions paid vs revenue

---

## 📞 Need Help?

See full documentation:
- `REFERRAL_SYSTEM.md` - Complete system guide
- `COMPLETE_IMPLEMENTATION.md` - Full implementation details
- `GAME_README.md` - Game mechanics
- `QUICK_START.md` - Getting started guide

---

**That's it! You're ready to use the referral system! 🚀**
