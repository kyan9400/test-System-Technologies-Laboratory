/**
 * Test suite for number set serialization/deserialization
 */

import { serialize, deserialize } from './codec.js';

/**
 * Calculate simple serialization length (e.g., "1,300,237,188")
 */
function simpleSerializeLength(numbers) {
  if (numbers.length === 0) return 0;
  return numbers.join(',').length;
}

/**
 * Calculate compression ratio
 */
function compressionRatio(simpleLength, compressedLength) {
  if (compressedLength === 0) return Infinity;
  return simpleLength / compressedLength;
}

/**
 * Run a test case and display metrics
 */
function runTest(name, numbers) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Test: ${name}`);
  console.log(`${'='.repeat(60)}`);
  
  // Remove duplicates and sort
  const uniqueNumbers = [...new Set(numbers)].filter(
    n => Number.isInteger(n) && n >= 1 && n <= 300
  ).sort((a, b) => a - b);
  
  if (uniqueNumbers.length === 0) {
    console.log('No valid numbers to test');
    return;
  }
  
  // Simple serialization
  const simpleSerialized = uniqueNumbers.join(',');
  const simpleLength = simpleSerialized.length;
  
  // Compressed serialization
  const compressed = serialize(uniqueNumbers);
  const compressedLength = compressed.length;
  
  // Compression ratio
  const ratio = compressionRatio(simpleLength, compressedLength);
  
  // Verify deserialization
  let deserialized;
  try {
    deserialized = deserialize(compressed);
  } catch (e) {
    console.error(`ERROR: Deserialization failed: ${e.message}`);
    return;
  }
  
  // Verify correctness
  const originalSet = new Set(uniqueNumbers);
  const deserializedSet = new Set(deserialized);
  const isCorrect = 
    originalSet.size === deserializedSet.size &&
    [...originalSet].every(n => deserializedSet.has(n));
  
  // Display metrics
  console.log(`Numbers count: ${uniqueNumbers.length}`);
  console.log(`Simple serialization length: ${simpleLength} chars`);
  console.log(`Compressed length: ${compressedLength} chars`);
  console.log(`Compression ratio: ${ratio.toFixed(2)}x`);
  console.log(`Meets requirement (≥2x): ${ratio >= 2.0 ? '✓ YES' : '✗ NO'}`);
  console.log(`Correctness: ${isCorrect ? '✓ PASS' : '✗ FAIL'}`);
  
  if (!isCorrect) {
    console.error('Original:', [...originalSet].slice(0, 20), '...');
    console.error('Deserialized:', deserialized.slice(0, 20), '...');
  }
  
  // Show sample (first 10 numbers)
  const sample = uniqueNumbers.slice(0, 10);
  console.log(`Sample numbers: ${sample.join(', ')}${uniqueNumbers.length > 10 ? '...' : ''}`);
  console.log(`Compressed string: ${compressed}`);
  
  return {
    count: uniqueNumbers.length,
    simpleLength,
    compressedLength,
    ratio,
    meetsRequirement: ratio >= 2.0,
    isCorrect
  };
}

/**
 * Generate random numbers in range 1..300
 */
function generateRandomNumbers(count) {
  const numbers = [];
  const used = new Set();
  
  while (numbers.length < count && used.size < 300) {
    const num = Math.floor(Math.random() * 300) + 1;
    if (!used.has(num)) {
      used.add(num);
      numbers.push(num);
    }
  }
  
  return numbers;
}

// ============================================================================
// TEST CASES
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('NUMBER SET COMPRESSION TEST SUITE');
console.log('='.repeat(60));

const results = [];

// ----------------------------------------------------------------------------
// Simple short test cases
// ----------------------------------------------------------------------------

results.push(runTest('Simple: Single number', [1]));
results.push(runTest('Simple: Two numbers', [1, 300]));
results.push(runTest('Simple: Small set', [1, 2, 3, 4, 5]));
results.push(runTest('Simple: Sparse set', [1, 50, 100, 150, 200, 250, 300]));
results.push(runTest('Simple: With duplicates', [1, 2, 2, 3, 3, 3, 4, 4, 4, 4]));

// ----------------------------------------------------------------------------
// Random test cases
// ----------------------------------------------------------------------------

results.push(runTest('Random: 50 numbers', generateRandomNumbers(50)));
results.push(runTest('Random: 100 numbers', generateRandomNumbers(100)));
results.push(runTest('Random: 500 numbers', generateRandomNumbers(500)));
results.push(runTest('Random: 1000 numbers', generateRandomNumbers(1000)));

// ----------------------------------------------------------------------------
// Boundary cases
// ----------------------------------------------------------------------------

// All single-digit numbers (1-9)
results.push(runTest('Boundary: All single-digit (1-9)', Array.from({ length: 9 }, (_, i) => i + 1)));

// All two-digit numbers (10-99)
results.push(runTest('Boundary: All two-digit (10-99)', Array.from({ length: 90 }, (_, i) => i + 10)));

// All three-digit numbers (100-300)
results.push(runTest('Boundary: All three-digit (100-300)', Array.from({ length: 201 }, (_, i) => i + 100)));

// Every third number (1, 4, 7, 10, ...)
results.push(runTest('Boundary: Every third number (step 3)', Array.from({ length: 100 }, (_, i) => i * 3 + 1).filter(n => n <= 300)));

// Full set 1..300
results.push(runTest('Boundary: Full set (1-300)', Array.from({ length: 300 }, (_, i) => i + 1)));

// Edge cases with invalid numbers
results.push(runTest('Edge: With invalid numbers', [0, 1, 2, 301, 302, 150, 200, -5, 1.5, 2.7]));

// Empty set (should handle gracefully)
results.push(runTest('Edge: Empty set', []));

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('TEST SUMMARY');
console.log('='.repeat(60));

const validResults = results.filter(r => r !== undefined);
const passed = validResults.filter(r => r.isCorrect).length;
const meetsRequirement = validResults.filter(r => r.meetsRequirement).length;

console.log(`Total tests: ${validResults.length}`);
console.log(`Correctness: ${passed}/${validResults.length} passed`);
console.log(`Compression requirement (≥2x): ${meetsRequirement}/${validResults.length} met`);

// Show tests that don't meet requirement
const failing = validResults.filter(r => !r.meetsRequirement);
if (failing.length > 0) {
  console.log('\n⚠ Tests that do NOT meet ≥2x compression requirement:');
  failing.forEach((r, idx) => {
    console.log(`  ${idx + 1}. Ratio: ${r.ratio.toFixed(2)}x`);
  });
}

// Show average compression ratio
const avgRatio = validResults.reduce((sum, r) => sum + r.ratio, 0) / validResults.length;
console.log(`\nAverage compression ratio: ${avgRatio.toFixed(2)}x`);

// Final verdict
console.log('\n' + '='.repeat(60));
if (passed === validResults.length && meetsRequirement === validResults.length) {
  console.log('✓ ALL TESTS PASSED');
} else if (passed === validResults.length) {
  console.log('✓ All correctness tests passed');
  console.log('⚠ Some tests do not meet ≥2x compression requirement');
} else {
  console.log('✗ SOME TESTS FAILED');
}
console.log('='.repeat(60) + '\n');

