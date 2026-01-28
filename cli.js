#!/usr/bin/env node

/**
 * CLI utility for encoding/decoding number sets
 * 
 * Usage:
 *   node cli.js encode "1,2,3,300"
 *   node cli.js decode "B1:..."
 */

import { serialize, deserialize } from './src/codec.js';

const command = process.argv[2];
const input = process.argv[3];

if (!command || !input) {
  console.error('Usage:');
  console.error('  node cli.js encode "1,2,3,300"');
  console.error('  node cli.js decode "B1:..."');
  process.exit(1);
}

try {
  if (command === 'encode') {
    // Parse input as comma-separated numbers
    const numbers = input
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(s => {
        const num = parseInt(s, 10);
        if (isNaN(num)) {
          throw new Error(`Invalid number: ${s}`);
        }
        return num;
      });
    
    const encoded = serialize(numbers);
    console.log(encoded);
    
  } else if (command === 'decode') {
    const decoded = deserialize(input);
    console.log(decoded.join(','));
    
  } else {
    console.error(`Unknown command: ${command}`);
    console.error('Use "encode" or "decode"');
    process.exit(1);
  }
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}

