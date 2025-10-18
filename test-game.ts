/**
 * Test Script for Color Prediction Game
 * Run with: npx ts-node test-game.ts
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';

interface TestUser {
  phoneNumber: string;
  password: string;
  token?: string;
  userId?: number;
}

const testUsers: TestUser[] = [
  { phoneNumber: '9999999901', password: 'Test@123' },
  { phoneNumber: '9999999902', password: 'Test@123' },
  { phoneNumber: '9999999903', password: 'Test@123' },
];

// Helper to add delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function getCurrentPeriod() {
  try {
    const response = await axios.get(`${API_BASE_URL}/game/period/current`);
    return response.data.data;
  } catch (error: any) {
    console.error('Error getting current period:', error.response?.data || error.message);
    return null;
  }
}

async function loginUser(user: TestUser) {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      phoneNumber: user.phoneNumber,
      password: user.password,
    });
    user.token = response.data.accessToken;
    user.userId = response.data.user.id;
    console.log(`✅ Logged in user: ${user.phoneNumber}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Failed to login ${user.phoneNumber}:`, error.response?.data || error.message);
    return false;
  }
}

async function placeBet(user: TestUser, color: string, amount: number) {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/game/bet`,
      { color, amount },
      { headers: { Authorization: `Bearer ${user.token}` } }
    );
    console.log(`🎲 ${user.phoneNumber} bet ${amount} on ${color}`);
    return response.data.data;
  } catch (error: any) {
    console.error(`❌ Failed to place bet for ${user.phoneNumber}:`, error.response?.data || error.message);
    return null;
  }
}

async function getUserBalance(user: TestUser) {
  try {
    const response = await axios.get(`${API_BASE_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    return response.data.user.balance;
  } catch (error: any) {
    console.error(`❌ Failed to get balance for ${user.phoneNumber}:`, error.response?.data || error.message);
    return null;
  }
}

async function getBetHistory(user: TestUser) {
  try {
    const response = await axios.get(`${API_BASE_URL}/game/bet/history?limit=5`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    return response.data.data;
  } catch (error: any) {
    console.error(`❌ Failed to get bet history:`, error.response?.data || error.message);
    return [];
  }
}

async function runTest() {
  console.log('🎮 Color Prediction Game - Test Script\n');

  // 1. Check current period
  console.log('📊 Checking current period...');
  const period = await getCurrentPeriod();
  if (!period) {
    console.error('❌ No active period found. Is the server running?');
    return;
  }

  console.log(`\n✅ Current Period: ${period.periodId}`);
  console.log(`   Status: ${period.status}`);
  console.log(`   Can Bet: ${period.canBet}`);
  console.log(`   Time Remaining: ${period.timeRemaining}s`);
  console.log(`   Betting Time Remaining: ${period.bettingTimeRemaining}s\n`);

  if (!period.canBet) {
    console.log('⚠️  Betting is currently closed. Please wait for the next period.\n');
    return;
  }

  // 2. Login test users
  console.log('🔐 Logging in test users...');
  for (const user of testUsers) {
    const success = await loginUser(user);
    if (!success) {
      console.log(`⚠️  User ${user.phoneNumber} might not exist. You may need to register this user first.\n`);
    }
    await delay(500);
  }

  const loggedInUsers = testUsers.filter(u => u.token);
  if (loggedInUsers.length === 0) {
    console.log('❌ No users logged in. Cannot proceed with betting test.\n');
    return;
  }

  // 3. Check balances
  console.log('\n💰 Checking user balances...');
  for (const user of loggedInUsers) {
    const balance = await getUserBalance(user);
    console.log(`   ${user.phoneNumber}: ₹${balance}`);
    await delay(300);
  }

  // 4. Place test bets
  console.log('\n🎲 Placing test bets...');
  const colors = ['green', 'purple', 'red'];
  for (let i = 0; i < loggedInUsers.length; i++) {
    const user = loggedInUsers[i];
    const color = colors[i % colors.length];
    const amount = (i + 1) * 50; // 50, 100, 150
    await placeBet(user, color, amount);
    await delay(500);
  }

  // 5. Show current period bets
  console.log('\n📊 Current period bet totals:');
  const updatedPeriod = await getCurrentPeriod();
  if (updatedPeriod) {
    console.log(`   Green: ₹${updatedPeriod.totalGreenBets}`);
    console.log(`   Purple: ₹${updatedPeriod.totalPurpleBets}`);
    console.log(`   Red: ₹${updatedPeriod.totalRedBets}`);
  }

  // 6. Show bet history for first user
  console.log('\n📜 Recent bet history (first user):');
  if (loggedInUsers[0]) {
    const history = await getBetHistory(loggedInUsers[0]);
    history.slice(0, 3).forEach((bet: any) => {
      console.log(`   Period ${bet.periodId}: ${bet.color} - ₹${bet.amount} - ${bet.status} ${bet.winAmount ? `(Won ₹${bet.winAmount})` : ''}`);
    });
  }

  console.log('\n✅ Test completed!');
  console.log(`⏰ Wait ${period.timeRemaining}s for period to complete and see results.\n`);
}

// Run the test
runTest().catch(console.error);
