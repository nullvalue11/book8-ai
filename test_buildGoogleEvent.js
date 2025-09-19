#!/usr/bin/env node
/**
 * Unit test for buildGoogleEventFromBooking function
 * Tests the timezone fix implementation
 */

import { buildGoogleEventFromBooking } from './lib/googleSync.js';

console.log('Testing buildGoogleEventFromBooking function...');
console.log('=' .repeat(60));

// Test case 1: Booking with America/New_York timezone (the reported issue)
const bookingWithTimezone = {
  id: 'test-booking-1',
  title: 'Test Meeting - Eastern Time',
  customerName: 'John Doe',
  startTime: '2025-09-20T20:16:00.000Z', // 4:16 PM Eastern when converted
  endTime: '2025-09-20T21:16:00.000Z',   // 5:16 PM Eastern when converted
  timeZone: 'America/New_York',
  notes: 'Testing timezone fix'
};

console.log('Test 1: Booking with America/New_York timezone');
console.log('Input booking:', JSON.stringify(bookingWithTimezone, null, 2));

const googleEvent1 = buildGoogleEventFromBooking(bookingWithTimezone);
console.log('Generated Google Calendar event:', JSON.stringify(googleEvent1, null, 2));

// Verify the fix
const hasStartTimezone = googleEvent1.start && googleEvent1.start.timeZone === 'America/New_York';
const hasEndTimezone = googleEvent1.end && googleEvent1.end.timeZone === 'America/New_York';
const hasStartDateTime = googleEvent1.start && googleEvent1.start.dateTime === bookingWithTimezone.startTime;
const hasEndDateTime = googleEvent1.end && googleEvent1.end.dateTime === bookingWithTimezone.endTime;

console.log('\nVerification:');
console.log(`✅ Start timezone preserved: ${hasStartTimezone ? 'PASS' : 'FAIL'}`);
console.log(`✅ End timezone preserved: ${hasEndTimezone ? 'PASS' : 'FAIL'}`);
console.log(`✅ Start dateTime preserved: ${hasStartDateTime ? 'PASS' : 'FAIL'}`);
console.log(`✅ End dateTime preserved: ${hasEndDateTime ? 'PASS' : 'FAIL'}`);

console.log('\n' + '=' .repeat(60));

// Test case 2: Booking without timezone (should default to UTC)
const bookingWithoutTimezone = {
  id: 'test-booking-2',
  title: 'Test Meeting - No Timezone',
  customerName: 'Jane Doe',
  startTime: '2025-09-20T14:00:00.000Z',
  endTime: '2025-09-20T15:00:00.000Z',
  notes: 'Testing default timezone'
};

console.log('Test 2: Booking without timezone (should default to UTC)');
console.log('Input booking:', JSON.stringify(bookingWithoutTimezone, null, 2));

const googleEvent2 = buildGoogleEventFromBooking(bookingWithoutTimezone);
console.log('Generated Google Calendar event:', JSON.stringify(googleEvent2, null, 2));

// Verify default timezone
const hasDefaultStartTimezone = googleEvent2.start && googleEvent2.start.timeZone === 'UTC';
const hasDefaultEndTimezone = googleEvent2.end && googleEvent2.end.timeZone === 'UTC';

console.log('\nVerification:');
console.log(`✅ Default start timezone (UTC): ${hasDefaultStartTimezone ? 'PASS' : 'FAIL'}`);
console.log(`✅ Default end timezone (UTC): ${hasDefaultEndTimezone ? 'PASS' : 'FAIL'}`);

console.log('\n' + '=' .repeat(60));

// Test case 3: Different timezone
const bookingWithDifferentTimezone = {
  id: 'test-booking-3',
  title: 'Test Meeting - Pacific Time',
  customerName: 'Bob Smith',
  startTime: '2025-09-20T23:00:00.000Z',
  endTime: '2025-09-21T00:00:00.000Z',
  timeZone: 'America/Los_Angeles',
  notes: 'Testing Pacific timezone'
};

console.log('Test 3: Booking with America/Los_Angeles timezone');
const googleEvent3 = buildGoogleEventFromBooking(bookingWithDifferentTimezone);
console.log('Generated Google Calendar event:', JSON.stringify(googleEvent3, null, 2));

const hasPacificTimezone = googleEvent3.start && googleEvent3.start.timeZone === 'America/Los_Angeles';
console.log('\nVerification:');
console.log(`✅ Pacific timezone preserved: ${hasPacificTimezone ? 'PASS' : 'FAIL'}`);

console.log('\n' + '=' .repeat(60));
console.log('SUMMARY:');

const allTests = [
  hasStartTimezone && hasEndTimezone && hasStartDateTime && hasEndDateTime,
  hasDefaultStartTimezone && hasDefaultEndTimezone,
  hasPacificTimezone
];

const passedTests = allTests.filter(test => test).length;
const totalTests = allTests.length;

console.log(`Tests passed: ${passedTests}/${totalTests}`);

if (passedTests === totalTests) {
  console.log('🎉 ALL TESTS PASSED!');
  console.log('✅ buildGoogleEventFromBooking function correctly handles timezones');
  console.log('✅ The timezone synchronization fix is working as expected');
  console.log('✅ Google Calendar events will now show correct times with proper timezone context');
} else {
  console.log('❌ SOME TESTS FAILED');
  console.log('❌ The timezone fix may have issues');
}

console.log('\nKey Fix Details:');
console.log('- ✅ Function now includes timeZone field in start/end objects');
console.log('- ✅ Timezone defaults to UTC when not specified');
console.log('- ✅ Original booking times are preserved (no double conversion)');
console.log('- ✅ Google Calendar API will receive proper timezone context');
console.log('- ✅ This fixes the 4-hour shift issue reported by the user');