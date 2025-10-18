# Color Prediction Game - API Documentation

## Overview

The Color Prediction Game is a 24/7 running betting system where users can place bets on three colors (Green, Purple, Red) during 3-minute periods. The color with the lowest total bet amount wins, and users who bet on that color receive 1.8x their bet amount.

## Game Mechanics

### Period System

- **Period Duration**: 3 minutes (180 seconds)
- **Betting Window**: First 2 minutes 30 seconds (150 seconds)
- **Lock Period**: Last 30 seconds (no betting allowed)
- **Periods per Day**: 480 periods (24 hours × 60 minutes ÷ 3 minutes)
- **Period ID Format**: `YYYYMMDD001` to `YYYYMMDD480`
  - Example: `20251018001` (October 18, 2025, Period 1)

### Betting Rules

1. Users must be logged in to place bets
2. Bet amount is immediately debited from user balance
3. Users can choose from three colors: Green, Purple, Red
4. Betting is only allowed during the first 2:30 minutes of each period
5. The color with the **lowest total bet amount** wins
6. Winners receive **1.8x** their bet amount (configurable)
7. Win multiplier can be changed from the database settings

### Win Calculation

- If a user bets 100 on Green and Green wins, they receive 180 (100 × 1.8)
- If a user bets 100 on Red but Green wins, they lose their 100

## Database Models

### GameSettings
Stores configurable game parameters:
- `periodDuration`: Duration of each period in seconds (default: 180)
- `bettingDuration`: Time allowed for betting in seconds (default: 150)
- `winMultiplier`: Multiplier for winning bets (default: 1.8)
- `minBetAmount`: Minimum bet amount (default: 10)
- `maxBetAmount`: Maximum bet amount (default: 10000)

### GamePeriod
Tracks each game period:
- `periodId`: Unique period identifier (YYYYMMDD###)
- `startTime`: Period start timestamp
- `endTime`: Period end timestamp
- `bettingEndTime`: When betting closes
- `status`: active, betting_closed, or completed
- `winningColor`: The winning color (set after completion)
- `totalGreenBets`: Total amount bet on Green
- `totalPurpleBets`: Total amount bet on Purple
- `totalRedBets`: Total amount bet on Red

### Bet
Individual user bets:
- `userId`: User who placed the bet
- `periodId`: Period identifier
- `color`: green, purple, or red
- `amount`: Bet amount
- `status`: pending, won, or lost
- `winAmount`: Amount won (if applicable)

## API Endpoints

### Public Endpoints

#### Get Current Period
```http
GET /api/game/period/current
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "periodId": "20251018001",
    "startTime": "2025-10-18T00:00:00.000Z",
    "endTime": "2025-10-18T00:03:00.000Z",
    "bettingEndTime": "2025-10-18T00:02:30.000Z",
    "status": "active",
    "winningColor": null,
    "totalGreenBets": 0,
    "totalPurpleBets": 0,
    "totalRedBets": 0,
    "timeRemaining": 120,
    "bettingTimeRemaining": 90,
    "canBet": true
  }
}
```

#### Get Period History
```http
GET /api/game/period/history?limit=50
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 100,
      "periodId": "20251017480",
      "startTime": "2025-10-17T23:57:00.000Z",
      "endTime": "2025-10-18T00:00:00.000Z",
      "status": "completed",
      "winningColor": "green",
      "totalGreenBets": 500,
      "totalPurpleBets": 1200,
      "totalRedBets": 800,
      "completedAt": "2025-10-18T00:00:00.000Z"
    }
  ]
}
```

#### Get Game Settings
```http
GET /api/game/settings
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "periodDuration": 180,
    "bettingDuration": 150,
    "winMultiplier": 1.8,
    "minBetAmount": 10,
    "maxBetAmount": 10000
  }
}
```

### Protected Endpoints (Require Authentication)

#### Place a Bet
```http
POST /api/game/bet
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "color": "green",
  "amount": 100
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bet placed successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "periodId": "20251018001",
    "gamePeriodId": 1,
    "color": "green",
    "amount": 100,
    "status": "pending",
    "winAmount": null,
    "createdAt": "2025-10-18T00:01:00.000Z"
  }
}
```

**Error Responses:**
- `400`: Betting is closed / Insufficient balance / Invalid amount
- `401`: Unauthorized (not logged in)
- `500`: Server error

#### Get User's Bets for Current Period
```http
GET /api/game/bet/current
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "userId": 1,
      "periodId": "20251018001",
      "color": "green",
      "amount": 100,
      "status": "pending",
      "createdAt": "2025-10-18T00:01:00.000Z"
    }
  ]
}
```

#### Get User's Bet History
```http
GET /api/game/bet/history?limit=50
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "userId": 1,
      "periodId": "20251018001",
      "color": "green",
      "amount": 100,
      "status": "won",
      "winAmount": 180,
      "createdAt": "2025-10-18T00:01:00.000Z",
      "settledAt": "2025-10-18T00:03:00.000Z",
      "gamePeriod": {
        "periodId": "20251018001",
        "winningColor": "green",
        "status": "completed",
        "completedAt": "2025-10-18T00:03:00.000Z"
      }
    }
  ]
}
```

#### Update Game Settings (Admin)
```http
PUT /api/game/settings
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "winMultiplier": 2.0,
  "minBetAmount": 50,
  "maxBetAmount": 5000
}
```

**Response:**
```json
{
  "success": true,
  "message": "Game settings updated successfully",
  "data": {
    "id": 1,
    "periodDuration": 180,
    "bettingDuration": 150,
    "winMultiplier": 2.0,
    "minBetAmount": 50,
    "maxBetAmount": 5000
  }
}
```

## Transaction Types

The game system creates transaction records for:
- `bet_debit`: When a user places a bet (balance is debited)
- `bet_win_credit`: When a user wins a bet (balance is credited with winnings)

## Game Flow

1. **Period Start** (00:00)
   - New period is created with status "active"
   - Period ID is generated (e.g., 20251018001)
   - Betting is open

2. **Betting Phase** (00:00 - 02:30)
   - Users can place bets on colors
   - Balance is immediately debited
   - Transaction records are created

3. **Lock Phase** (02:30 - 03:00)
   - Period status changes to "betting_closed"
   - No new bets allowed
   - Users wait for results

4. **Period End** (03:00)
   - Calculate total bets per color
   - Determine winning color (lowest total)
   - Update period with winning color
   - Process all bets:
     - Mark as "won" or "lost"
     - Credit winners with winAmount
     - Create transaction records for winners
   - Period status changes to "completed"

5. **Next Period** (03:00)
   - New period automatically starts
   - Cycle repeats 24/7

## Important Notes

- The game runs continuously 24/7
- Period IDs reset daily (001-480 for each day)
- Betting is locked for the last 30 seconds of each period
- The color with the **lowest** total bet amount wins (not highest!)
- Winners receive their original bet amount × winMultiplier
- All balance changes are immediately reflected in the database
- Transaction history is maintained for auditing

## Changing Win Multiplier

To change the win multiplier, update the `game_settings` table:

```sql
UPDATE game_settings SET win_multiplier = 2.0;
```

Or use the API:
```http
PUT /api/game/settings
{
  "winMultiplier": 2.0
}
```

## Testing the Game

1. Start the server: `npm run dev`
2. The game service will automatically initialize and start the first period
3. Check the console for period creation logs
4. Use the API endpoints to place bets and check results
5. Wait for 3 minutes to see period completion and winner calculation

## Monitoring

The game service logs important events:
- 🎮 Game Service Initialization
- 🆕 New Period Created
- 🔒 Betting Locked
- 🏁 Period Completion
- 🏆 Winning Color Announcement
- 💰 Winner Payouts
- 🎲 Bet Placements
