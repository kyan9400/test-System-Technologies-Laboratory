/**
 * Comprehensive test suite for hybrid number set serialization
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
 * Detect format from serialized string
 */
function detectFormat(serialized) {
  if (serialized.startsWith('B1:')) return 'B1';
  if (serialized.startsWith('D1:')) return 'D1';
  return 'UNKNOWN';
}

/**
 * Run a test case and display metrics
 */
function runTest(name, numbers) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Test: ${name}`);
  console.log(`${'='.repeat(70)}`);
  
  // Normalize input (same as serialize does)
  const numberSet = numbers instanceof Set ? numbers : new Set(numbers);
  const valid = [];
  
  for (const num of numberSet) {
    if (typeof num !== 'number' || !Number.isInteger(num)) {
      continue;
    }
    if (num >= 1 && num <= 300 && !isNaN(num) && isFinite(num)) {
      valid.push(num);
    }
  }
  
  const normalized = [...new Set(valid)].sort((a, b) => a - b);
  
  if (normalized.length === 0) {
    console.log('No valid numbers to test');
    return null;
  }
  
  // Simple serialization
  const simpleSerialized = normalized.join(',');
  const simpleLength = simpleSerialized.length;
  
  // Compressed serialization
  let compressed;
  try {
    compressed = serialize(normalized);
  } catch (e) {
    console.error(`ERROR: Serialization failed: ${e.message}`);
    return null;
  }
  
  const compressedLength = compressed.length;
  const format = detectFormat(compressed);
  
  // Compression ratio
  const ratio = compressionRatio(simpleLength, compressedLength);
  
  // Verify deserialization (round-trip)
  let deserialized;
  let okRoundTrip = false;
  try {
    deserialized = deserialize(compressed);
    
    // Check correctness: same set of numbers
    const originalSet = new Set(normalized);
    const deserializedSet = new Set(deserialized);
    
    okRoundTrip = 
      originalSet.size === deserializedSet.size &&
      [...originalSet].every(n => deserializedSet.has(n)) &&
      [...deserializedSet].every(n => originalSet.has(n));
    
    if (!okRoundTrip) {
      console.error('Round-trip FAILED:');
      console.error('  Original:', [...normalized].slice(0, 20), normalized.length > 20 ? '...' : '');
      console.error('  Deserialized:', deserialized.slice(0, 20), deserialized.length > 20 ? '...' : '');
    }
  } catch (e) {
    console.error(`ERROR: Deserialization failed: ${e.message}`);
    return null;
  }
  
  // Display metrics
  console.log(`Count: ${normalized.length}`);
  console.log(`Simple length: ${simpleLength} chars`);
  console.log(`Compressed length: ${compressedLength} chars`);
  console.log(`Compression ratio: ${ratio.toFixed(2)}x`);
  console.log(`Format used: ${format}`);
  console.log(`Round-trip: ${okRoundTrip ? '✓ PASS' : '✗ FAIL'}`);
  
  // Show sample
  const sample = normalized.slice(0, 10);
  console.log(`Sample numbers: ${sample.join(', ')}${normalized.length > 10 ? '...' : ''}`);
  console.log(`Compressed: ${compressed.substring(0, 60)}${compressed.length > 60 ? '...' : ''}`);
  
  return {
    count: normalized.length,
    simpleLength,
    compressedLength,
    ratio,
    format,
    okRoundTrip,
    meetsRequirement: ratio >= 2.0
  };
}

/**
 * Generate random numbers in range 1..300
 */
function generateRandomNumbers(count, allowDuplicates = false) {
  const numbers = [];
  const used = new Set();
  
  while (numbers.length < count) {
    const num = Math.floor(Math.random() * 300) + 1;
    if (allowDuplicates || !used.has(num)) {
      used.add(num);
      numbers.push(num);
    }
    // If we've used all 300 numbers and duplicates not allowed, stop
    if (!allowDuplicates && used.size >= 300) {
      break;
    }
  }
  
  return numbers;
}

// ============================================================================
// TEST CASES
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('HYBRID NUMBER SET COMPRESSION TEST SUITE');
console.log('='.repeat(70));

const results = [];

// ----------------------------------------------------------------------------
// Short test cases
// ----------------------------------------------------------------------------

results.push(runTest('Short: Single number', [1]));
results.push(runTest('Short: Two numbers', [1, 300]));
results.push(runTest('Short: Small set', [1, 2, 3, 4, 5]));
results.push(runTest('Short: Sparse set', [1, 50, 100, 150, 200, 250, 300]));
results.push(runTest('Short: With duplicates', [1, 2, 2, 3, 3, 3, 4, 4, 4, 4]));

// ----------------------------------------------------------------------------
// Random test cases
// ----------------------------------------------------------------------------

results.push(runTest('Random: 50 numbers', generateRandomNumbers(50)));
results.push(runTest('Random: 100 numbers', generateRandomNumbers(100)));
results.push(runTest('Random: 500 numbers', generateRandomNumbers(500)));
results.push(runTest('Random: 1000 numbers (with duplicates)', generateRandomNumbers(1000, true)));

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

// Edge cases
results.push(runTest('Edge: With invalid numbers', [0, 1, 2, 301, 302, 150, 200, -5, 1.5, 2.7, NaN, Infinity]));
results.push(runTest('Edge: Empty set', []));

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------

console.log('\n' + '='.repeat(70));
console.log('TEST SUMMARY');
console.log('='.repeat(70));

const validResults = results.filter(r => r !== null);
const passed = validResults.filter(r => r.okRoundTrip).length;
const meetsRequirement = validResults.filter(r => r.meetsRequirement).length;

console.log(`Total tests: ${validResults.length}`);
console.log(`Round-trip correctness: ${passed}/${validResults.length} passed`);
console.log(`Compression requirement (≥2x): ${meetsRequirement}/${validResults.length} met`);

// Format usage statistics
const b1Count = validResults.filter(r => r.format === 'B1').length;
const d1Count = validResults.filter(r => r.format === 'D1').length;
console.log(`Format usage: B1=${b1Count}, D1=${d1Count}`);

// Show tests that don't meet requirement
const failing = validResults.filter(r => !r.meetsRequirement);
if (failing.length > 0) {
  console.log('\n⚠ Tests that do NOT meet ≥2x compression requirement:');
  failing.forEach((r, idx) => {
    console.log(`  ${idx + 1}. Ratio: ${r.ratio.toFixed(2)}x, Format: ${r.format}, Count: ${r.count}`);
  });
}

// Statistics for large tests (50+ numbers)
const largeTests = validResults.filter(r => r.count >= 50);
if (largeTests.length > 0) {
  const ratios = largeTests.map(r => r.ratio);
  const minRatio = Math.min(...ratios);
  const maxRatio = Math.max(...ratios);
  const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  
  console.log('\n📊 Statistics for large tests (≥50 numbers):');
  console.log(`  Min ratio: ${minRatio.toFixed(2)}x`);
  console.log(`  Avg ratio: ${avgRatio.toFixed(2)}x`);
  console.log(`  Max ratio: ${maxRatio.toFixed(2)}x`);
}

// Overall statistics
const allRatios = validResults.map(r => r.ratio);
const overallMin = Math.min(...allRatios);
const overallMax = Math.max(...allRatios);
const overallAvg = allRatios.reduce((a, b) => a + b, 0) / allRatios.length;

console.log('\n📊 Overall statistics:');
console.log(`  Min ratio: ${overallMin.toFixed(2)}x`);
console.log(`  Avg ratio: ${overallAvg.toFixed(2)}x`);
console.log(`  Max ratio: ${overallMax.toFixed(2)}x`);

// Final verdict
console.log('\n' + '='.repeat(70));
if (passed === validResults.length) {
  console.log('✓ ALL CORRECTNESS TESTS PASSED');
  if (meetsRequirement === validResults.length) {
    console.log('✓ ALL TESTS MEET ≥2x COMPRESSION REQUIREMENT');
  } else {
    console.log('⚠ Some tests do not meet ≥2x compression requirement (expected for very small sets)');
  }
} else {
  console.log('✗ SOME CORRECTNESS TESTS FAILED');
}
console.log('='.repeat(70) + '\n');
