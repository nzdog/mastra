/**
 * Manual verification test for stone matching fix
 * Run with: tsx test/stone-matching-manual-test.ts
 */

import { stonesMatch, normalizeStone, stoneToString } from '../src/protocol/validation/utils';

console.log('=== Stone Matching Fix Verification ===\n');

// Simulate YAML-parsed stones (as objects)
const yamlStones = [
  { 'Stone 4': 'Clarity Over Cleverness' },
  { 'Stone 7': 'Built for Wholeness' },
  { 'Stone 6': 'Nothing Forced, Nothing Withheld' },
  { 'Stone 8': 'Integrity Is the Growth Strategy' },
  { 'Stone 10': 'Stewardship, Not Ownership' },
  { 'Stone 1': 'Light Before Form' },
];

// Theme references from markdown
const themeReferences = [
  'Stone 4: Clarity Over Cleverness',
  'Stone 7: Built for Wholeness',
  'Stone 6: Nothing Forced, Nothing Withheld',
  'Stone 8: Integrity Is the Growth Strategy',
  'Stone 10: Stewardship, Not Ownership',
  'Stone 1: Light Before Form',
];

console.log('Test 1: YAML Object Stones → String Conversion');
console.log('------------------------------------------------');
yamlStones.forEach((stone, idx) => {
  const stringForm = stoneToString(stone);
  const normalized = normalizeStone(stone);
  console.log(`Stone ${idx}:`);
  console.log(`  Original: ${JSON.stringify(stone)}`);
  console.log(`  String:   ${stringForm}`);
  console.log(`  Normalized: ${normalized}`);
  console.log();
});

console.log('\nTest 2: Stone Matching (YAML Objects vs Theme References)');
console.log('----------------------------------------------------------');
let matchCount = 0;
let totalTests = 0;

themeReferences.forEach((ref, idx) => {
  const yamlStone = yamlStones[idx];
  const matches = stonesMatch(yamlStone, ref);
  totalTests++;
  if (matches) {
    matchCount++;
  }

  console.log(`Match ${idx + 1}: ${matches ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  YAML:  ${JSON.stringify(yamlStone)}`);
  console.log(`  Theme: ${ref}`);
  console.log();
});

console.log('\nTest 3: Cross-matching (Any stone in YAML matches theme reference)');
console.log('--------------------------------------------------------------------');
themeReferences.forEach((ref) => {
  const hasMatch = yamlStones.some((stone) => stonesMatch(stone, ref));
  totalTests++;
  if (hasMatch) {
    matchCount++;
  }

  console.log(`"${ref}": ${hasMatch ? '✓ FOUND' : '✗ NOT FOUND'}`);
});

console.log('\n=== Summary ===');
console.log(`Total Tests: ${totalTests}`);
console.log(`Passed: ${matchCount}`);
console.log(`Failed: ${totalTests - matchCount}`);
console.log(matchCount === totalTests ? '\n✓ ALL TESTS PASSED' : '\n✗ SOME TESTS FAILED');
