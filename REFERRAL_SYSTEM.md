# Referral System Documentation

## Overview

The referral system allows users to earn commissions and bonuses by referring new users to the platform. The system includes:

1. **3-Level Referral Commission** - Earn commissions on bets placed by referred users up to 3 levels deep
2. **Signup Bonus** - Get a one-time bonus when your referral makes their first qualifying recharge

---

## Features

### 1. Referral Code System

- **Referral Code**: Each user's ID is their unique referral code
- **How to Use**: New users can enter a referral code during signup
- **Validation**: System validates that the referral code exists before allowing signup

### 2. 3-Level Commission Hierarchy

```
A refers B → A gets 1% commission on every bet by B

B refers C → A gets 0.5% + B gets 1% commission on every bet by C

C refers D → A gets 0.25% + B gets 0.5% + C gets 1% commission on every bet by D
```

**Commission Rates (Configurable):**
- Level 1 (Direct Referral): 1.0% (default)
- Level 2 (Sub-Referral): 0.5% (default)
- Level 3 (Sub-Sub-Referral): 0.25% (default)

### 3. Signup Bonus

- **Bonus Amount**: ₹1 (default, configurable)
- **Trigger**: When referred user makes their first recharge
- **Minimum Recharge**: ₹500 (default, configurable)
- **One-Time Only**: Bonus is only given once per referral
- **Auto-Credited**: Balance is automatically updated when conditions are met

---

## Database Schema

### User Table Updates

```prisma
model User {
  referredById            Int?     // ID of user who referred this user
  hasClaimedReferralBonus Boolean  // Track if referral bonus was given
  referredBy              User?    // Relation to referrer
  referrals               User[]   // Relation to referred users
}
```

### ReferralCommission Table

```prisma
model ReferralCommission {
  userId      Int      // User who earned commission
  fromUserId  Int      // User whose bet generated commission
  betId       Int      // The bet that generated commission
  amount      Float    // Commission amount
  percentage  Float    // Percentage used
  level       Int      // Referral level (1, 2, or 3)
}
```

### GameSettings Updates

```prisma
model GameSettings {
  referralCommissionL1  Float  // Level 1 commission %
  referralCommissionL2  Float  // Level 2 commission %
  referralCommissionL3  Float  // Level 3 commission %
  referralSignupBonus   Float  // Signup bonus amount
  minRechargeForBonus   Float  // Minimum recharge for bonus
}
```

### Transaction Types

New transaction types added:
- `referral_commission` - Commission earned from referral bets
- `referral_bonus` - One-time signup bonus for referrer

---

## How It Works

### Signup Flow with Referral

1. **New User Signs Up**
   ```json
   POST /api/auth/signup/complete
   {
     "phoneNumber": "9876543210",
     "otp": "123456",
     "password": "SecurePass@123",
     "referralCode": "42"  // Optional: User ID of referrer
   }
   ```

2. **System Validates**
   - Checks if referral code (user ID) exists
   - Creates user with `referredById` set to referrer's ID
   - Sets `hasClaimedReferralBonus` to `false`

3. **User Makes First Recharge**
   ```json
   POST /api/user/recharge
   {
     "amount": 500
   }
   ```

4. **System Processes Bonus**
   - Checks if `amount >= minRechargeForBonus` (₹500)
   - Checks if `hasClaimedReferralBonus` is `false`
   - Credits referrer with `referralSignupBonus` (₹1)
   - Marks `hasClaimedReferralBonus` as `true`
   - Creates transaction record

### Betting Flow with Commissions

1. **User Places Bet**
   ```json
   POST /api/game/bet
   {
     "color": "green",
     "amount": 100
   }
   ```

2. **System Processes Commissions**
   - Gets user's referral chain (up to 3 levels)
   - Calculates commission for each level:
     - Level 1: 100 × 1.0% = ₹1.00
     - Level 2: 100 × 0.5% = ₹0.50
     - Level 3: 100 × 0.25% = ₹0.25
   - Credits each referrer's balance
   - Creates commission records
   - Creates transaction records

3. **Example Scenario**

```
User D places bet of ₹1000

Referral Chain:
D ← C ← B ← A

Commissions:
- C gets ₹10.00 (1.0% of ₹1000) [Level 1]
- B gets ₹5.00 (0.5% of ₹1000) [Level 2]
- A gets ₹2.50 (0.25% of ₹1000) [Level 3]

Total Commission Paid: ₹17.50
Platform Keeps: ₹1000 - ₹17.50 = ₹982.50
```

---

## API Endpoints

### Get Referral Information

```http
GET /api/game/referral/info
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": 1,
    "referralCode": "1",
    "referredBy": 42,
    "totalReferrals": 5,
    "referrals": [
      {
        "id": 10,
        "phoneNumber": "98765xxxxx",
        "createdAt": "2025-10-18T10:00:00.000Z"
      }
    ]
  }
}
```

### Get Referral Earnings

```http
GET /api/game/referral/earnings?limit=50
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalEarnings": 125.50,
    "commissions": [
      {
        "id": 1,
        "fromUserId": 10,
        "betId": 523,
        "amount": 1.50,
        "percentage": 1.0,
        "level": 1,
        "createdAt": "2025-10-18T10:30:00.000Z"
      }
    ]
  }
}
```

### Update Game Settings (Admin)

```http
PUT /api/game/settings
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "referralCommissionL1": 2.0,
  "referralCommissionL2": 1.0,
  "referralCommissionL3": 0.5,
  "referralSignupBonus": 5.0,
  "minRechargeForBonus": 1000.0
}
```

---

## Configuration

### Default Settings

```javascript
{
  referralCommissionL1: 1.0,    // 1%
  referralCommissionL2: 0.5,    // 0.5%
  referralCommissionL3: 0.25,   // 0.25%
  referralSignupBonus: 1.0,     // ₹1
  minRechargeForBonus: 500.0    // ₹500
}
```

### Changing Settings via Database

```sql
-- Update commission rates
UPDATE game_settings 
SET referral_commission_l1 = 2.0,
    referral_commission_l2 = 1.0,
    referral_commission_l3 = 0.5;

-- Update signup bonus
UPDATE game_settings 
SET referral_signup_bonus = 5.0,
    min_recharge_for_bonus = 1000.0;
```

### Changing Settings via API

```bash
curl -X PUT http://localhost:3000/api/game/settings \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "referralCommissionL1": 2.0,
    "referralCommissionL2": 1.0,
    "referralCommissionL3": 0.5,
    "referralSignupBonus": 5.0,
    "minRechargeForBonus": 1000.0
  }'
```

---

## Example Scenarios

### Scenario 1: Simple Referral

```
1. User A (ID: 1) refers User B
2. User B signs up with referralCode: "1"
3. User B recharges ₹500
   → User A receives ₹1 signup bonus
4. User B places bet of ₹100
   → User A receives ₹1 commission (1%)
```

### Scenario 2: 3-Level Chain

```
1. A refers B (B.referredById = A.id)
2. B refers C (C.referredById = B.id)
3. C refers D (D.referredById = C.id)

When D places bet of ₹1000:
- C receives ₹10.00 (Level 1: 1.0%)
- B receives ₹5.00 (Level 2: 0.5%)
- A receives ₹2.50 (Level 3: 0.25%)

When C places bet of ₹1000:
- B receives ₹10.00 (Level 1: 1.0%)
- A receives ₹5.00 (Level 2: 0.5%)

When B places bet of ₹1000:
- A receives ₹10.00 (Level 1: 1.0%)
```

### Scenario 3: Signup Bonus

```
1. User A refers User B
2. User B signs up with referralCode: "A's ID"
3. User B recharges ₹200
   → No bonus (below ₹500 minimum)
4. User B recharges ₹400 more (total ₹600)
   → User A receives ₹1 bonus (first qualifying recharge)
5. User B recharges ₹1000 later
   → No bonus (already claimed once)
```

---

## Analytics & Tracking

### Check User's Referral Stats

```sql
-- Get total referrals
SELECT COUNT(*) as total_referrals
FROM users
WHERE referred_by_id = 1;

-- Get total commission earned
SELECT SUM(amount) as total_commission
FROM referral_commissions
WHERE user_id = 1;

-- Get commission by level
SELECT level, COUNT(*) as count, SUM(amount) as total
FROM referral_commissions
WHERE user_id = 1
GROUP BY level;

-- Get active referrals (made at least one bet)
SELECT DISTINCT u.id, u.phone_number, COUNT(b.id) as total_bets
FROM users u
JOIN bets b ON u.id = b.user_id
WHERE u.referred_by_id = 1
GROUP BY u.id;
```

### Platform Analytics

```sql
-- Total commissions paid
SELECT SUM(amount) as total_paid
FROM referral_commissions;

-- Commissions by level
SELECT level, SUM(amount) as total
FROM referral_commissions
GROUP BY level;

-- Most successful referrers
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

---

## Business Logic

### Commission Calculation

```typescript
// For each bet placed
const betAmount = 100;
const commissions = {
  level1: betAmount * (referralCommissionL1 / 100),  // 1.00
  level2: betAmount * (referralCommissionL2 / 100),  // 0.50
  level3: betAmount * (referralCommissionL3 / 100),  // 0.25
};
```

### Why Only 3 Levels?

- **Simplicity**: Easy to understand and manage
- **Fair Distribution**: Prevents excessive platform costs
- **Performance**: Reduces database queries
- **Industry Standard**: Common in referral programs

---

## Important Notes

1. **Commission Source**: Commissions are paid from the platform's revenue, not from the bettor's amount
2. **Instant Credit**: Commissions and bonuses are credited immediately
3. **No Double Bonus**: Signup bonus is only given once per referral
4. **Minimum Recharge**: Bonus requires minimum qualifying recharge
5. **All Bets Count**: Every bet triggers commissions, win or lose
6. **Configurable Rates**: All percentages and amounts can be changed
7. **Transaction History**: All commissions and bonuses are logged

---

## Testing

### Test Referral Flow

```bash
# 1. Create User A
curl -X POST http://localhost:3000/api/auth/signup/complete \
  -d '{"phoneNumber":"9999999991","otp":"123456","password":"Test@123"}'

# Note User A's ID (e.g., 1)

# 2. Create User B with referral
curl -X POST http://localhost:3000/api/auth/signup/complete \
  -d '{"phoneNumber":"9999999992","otp":"123456","password":"Test@123","referralCode":"1"}'

# 3. Recharge User B account
curl -X POST http://localhost:3000/api/user/recharge \
  -H "Authorization: Bearer USER_B_TOKEN" \
  -d '{"amount":500}'

# Check User A's balance - should show +₹1 bonus

# 4. Place bet as User B
curl -X POST http://localhost:3000/api/game/bet \
  -H "Authorization: Bearer USER_B_TOKEN" \
  -d '{"color":"green","amount":100}'

# Check User A's balance - should show +₹1 commission

# 5. Check User A's referral earnings
curl http://localhost:3000/api/game/referral/earnings \
  -H "Authorization: Bearer USER_A_TOKEN"
```

---

## Future Enhancements

1. **Referral Analytics Dashboard**
   - Visual charts of earnings
   - Referral tree visualization
   - Performance metrics

2. **Promotional Bonuses**
   - Limited-time commission boosts
   - Bonus multipliers for active referrers
   - Milestone rewards

3. **Referral Leaderboard**
   - Top referrers rankings
   - Monthly competitions
   - Special rewards

4. **Advanced Tracking**
   - Conversion rates
   - Referral quality metrics
   - Lifetime value analysis

---

## Troubleshooting

### Bonus Not Credited

**Check:**
1. Recharge amount >= minRechargeForBonus?
2. User has referredById set?
3. hasClaimedReferralBonus is false?
4. Referrer user exists?

### Commission Not Credited

**Check:**
1. Bet was successfully placed?
2. Referral chain exists?
3. Commission settings are configured?
4. Check server logs for errors

### Invalid Referral Code

**Check:**
1. Referral code is a valid user ID?
2. User ID exists in database?
3. Not trying to refer yourself?

---

This referral system provides a powerful way to grow your user base while rewarding existing users for their loyalty and advocacy!
