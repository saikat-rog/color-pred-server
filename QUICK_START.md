# Quick Start Guide - Color Prediction Game

## What Was Implemented

### ✅ Database Models
- **GameSettings**: Configurable game parameters (win multiplier, bet limits)
- **GamePeriod**: Tracks each 3-minute game period
- **Bet**: Records user bets
- **Color Enum**: green, purple, red
- **Updated TransactionType**: Added `bet_debit` and `bet_win_credit`

### ✅ Core Game Service (`gameService.ts`)
- 24/7 automatic period management
- Period ID generation (YYYYMMDD001-480)
- 3-minute periods with 2:30 betting window
- Automatic winner calculation (lowest bet amount wins)
- Balance management (debit on bet, credit on win)
- Transaction logging
- Configurable win multiplier (default 1.8x)

### ✅ API Endpoints
**Public:**
- `GET /api/game/period/current` - Get current period info
- `GET /api/game/period/history` - View past periods
- `GET /api/game/settings` - View game settings

**Protected (Requires Login):**
- `POST /api/game/bet` - Place a bet
- `GET /api/game/bet/current` - User's bets for current period
- `GET /api/game/bet/history` - User's betting history
- `PUT /api/game/settings` - Update game settings (admin)

## How to Test

### 1. Start the Server
```bash
npm run dev
```

You should see:
```
🎮 Initializing Game Service...
✅ Game settings initialized
🆕 Created new period: 20251018XXX
⏰ Period will end in XXX seconds
```

### 2. Test Current Period (Public)
```bash
curl http://localhost:3000/api/game/period/current
```

### 3. Login First
```bash
# Register/login to get a token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"1234567890","password":"yourpassword"}'
```

Save the `accessToken` from the response.

### 4. Place a Bet
```bash
curl -X POST http://localhost:3000/api/game/bet \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "color": "green",
    "amount": 100
  }'
```

### 5. Check Your Bets
```bash
curl http://localhost:3000/api/game/bet/current \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 6. Wait for Period to Complete
- After 3 minutes, the period will automatically complete
- Check the console logs for winner announcement
- Check your balance and bet history

## Testing Multiple Bets

To properly test the winner calculation:

1. Create multiple test accounts
2. Have each account place bets on different colors
3. Make sure different amounts are bet on each color
4. The color with the LOWEST total bet wins
5. Wait for the period to complete (3 minutes)
6. Check that winners received 1.8x their bet amount

## Example Test Scenario

```bash
# User 1 bets 100 on Green (Total Green: 100)
# User 2 bets 200 on Purple (Total Purple: 200)  
# User 3 bets 50 on Red (Total Red: 50)
# User 4 bets 50 on Red (Total Red: 100)

# Result: Green wins (lowest total: 100)
# User 1 receives: 100 × 1.8 = 180
```

## Changing Win Multiplier

### Via API:
```bash
curl -X PUT http://localhost:3000/api/game/settings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "winMultiplier": 2.0
  }'
```

### Directly in Database:
```sql
UPDATE game_settings SET win_multiplier = 2.5;
```

## Important Notes

1. **Betting Window**: You can only bet during the first 2:30 minutes
2. **Lock Period**: Last 30 seconds are locked (no betting)
3. **Balance Check**: Insufficient balance will reject the bet
4. **Bet Limits**: Min 10, Max 10000 (configurable)
5. **Winning Color**: The color with the LOWEST total bet amount wins
6. **Payout**: Winners get original amount × win multiplier
7. **Automatic**: Periods run 24/7 without manual intervention

## Monitoring Logs

The game service provides detailed logging:
- 🎮 Service initialization
- 🆕 New period creation  
- 🎲 Bet placements
- 🔒 Betting lock
- 🏁 Period completion
- 🏆 Winner announcement
- 💰 Winner payouts
- ❌ Lost bets

## Database Queries for Testing

```sql
-- View current period
SELECT * FROM game_periods ORDER BY start_time DESC LIMIT 1;

-- View all bets for current period
SELECT b.*, u.phone_number, gp.winning_color 
FROM bets b
JOIN users u ON b.user_id = u.id
JOIN game_periods gp ON b.game_period_id = gp.id
WHERE gp.status = 'active';

-- View completed periods with winners
SELECT * FROM game_periods 
WHERE status = 'completed' 
ORDER BY completed_at DESC 
LIMIT 10;

-- View user's bet history
SELECT * FROM bets 
WHERE user_id = 1 
ORDER BY created_at DESC;

-- Check game settings
SELECT * FROM game_settings;
```

## Troubleshooting

### Period not starting?
- Check server logs for errors
- Ensure database connection is working
- Verify `game_settings` table exists

### Can't place bet?
- Ensure you're logged in (valid token)
- Check you have sufficient balance
- Verify betting window is open (not in last 30 seconds)
- Check bet amount is within min/max limits

### Winner not calculated?
- Wait for full 3 minutes
- Check server is still running
- Look for errors in console logs

## Next Steps

1. **Add Admin Role**: Create admin middleware for settings updates
2. **WebSocket Integration**: Real-time period updates
3. **Bet History UI**: Better visualization of wins/losses
4. **Statistics**: Track user win rates, popular colors
5. **Anti-Fraud**: Rate limiting, bet pattern analysis
6. **Commission System**: Platform takes a small percentage
7. **Leaderboard**: Top winners, biggest bets
