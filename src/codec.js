/**
 * Compact serialization for sets of integers in range 1..300
 * 
 * Approach: Bitmask (300 bits = 38 bytes) + base64url encoding
 * Format: "B1:" + base64url(bitmask)
 */

const VERSION_PREFIX = 'B1:';
const MIN_VALUE = 1;
const MAX_VALUE = 300;
const BITMASK_SIZE_BYTES = 38; // 300 bits = 37.5 bytes, rounded up to 38

/**
 * Converts bytes to base64url encoding (URL-safe base64)
 * @param {Uint8Array} bytes - Input bytes
 * @returns {string} Base64url encoded string
 */
function base64urlEncode(bytes) {
  // Use Node.js Buffer for base64 encoding
  const buffer = Buffer.from(bytes);
  const base64 = buffer.toString('base64');
  
  // Convert to base64url: replace + with -, / with _, remove padding
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Converts base64url string back to bytes
 * @param {string} str - Base64url encoded string
 * @returns {Uint8Array} Decoded bytes
 */
function base64urlDecode(str) {
  // Convert base64url back to base64
  let base64 = str
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  // Add padding if needed (base64 requires length to be multiple of 4)
  while (base64.length % 4) {
    base64 += '=';
  }
  
  // Decode using Node.js Buffer
  const buffer = Buffer.from(base64, 'base64');
  
  // Ensure exactly 38 bytes
  const result = new Uint8Array(BITMASK_SIZE_BYTES);
  for (let i = 0; i < Math.min(buffer.length, BITMASK_SIZE_BYTES); i++) {
    result[i] = buffer[i];
  }
  
  return result;
}

/**
 * Serializes a set of numbers to a compact string
 * @param {number[] | Set<number>} numbers - Input numbers (duplicates ignored, invalid numbers filtered)
 * @returns {string} Serialized string with format "B1:base64url"
 */
export function serialize(numbers) {
  // Convert to Set to remove duplicates
  const numberSet = numbers instanceof Set ? numbers : new Set(numbers);
  
  // Create bitmask (38 bytes = 304 bits, we use 300 bits)
  const bitmask = new Uint8Array(BITMASK_SIZE_BYTES);
  
  // Set bits for valid numbers
  for (const num of numberSet) {
    if (typeof num !== 'number' || !Number.isInteger(num)) {
      continue; // Skip non-integers
    }
    
    if (num >= MIN_VALUE && num <= MAX_VALUE) {
      const bitIndex = num - MIN_VALUE; // 0..299
      const byteIndex = Math.floor(bitIndex / 8);
      const bitOffset = bitIndex % 8;
      
      bitmask[byteIndex] |= (1 << (7 - bitOffset));
    }
  }
  
  // Encode to base64url
  const encoded = base64urlEncode(bitmask);
  
  // Add version prefix
  return VERSION_PREFIX + encoded;
}

/**
 * Deserializes a string back to an array of numbers
 * @param {string} payload - Serialized string
 * @returns {number[]} Sorted array of numbers
 * @throws {Error} If payload format is invalid
 */
export function deserialize(payload) {
  // Validate prefix
  if (!payload.startsWith(VERSION_PREFIX)) {
    throw new Error(`Invalid format: expected prefix "${VERSION_PREFIX}"`);
  }
  
  // Extract encoded part
  const encoded = payload.slice(VERSION_PREFIX.length);
  
  if (encoded.length === 0) {
    throw new Error('Invalid format: empty encoded data');
  }
  
  // Decode base64url
  let bitmask;
  try {
    bitmask = base64urlDecode(encoded);
  } catch (e) {
    throw new Error(`Invalid base64url encoding: ${e.message}`);
  }
  
  // Validate size
  if (bitmask.length !== BITMASK_SIZE_BYTES) {
    throw new Error(
      `Invalid bitmask size: expected ${BITMASK_SIZE_BYTES} bytes, got ${bitmask.length}`
    );
  }
  
  // Extract numbers from bitmask
  const numbers = [];
  for (let bitIndex = 0; bitIndex < 300; bitIndex++) {
    const byteIndex = Math.floor(bitIndex / 8);
    const bitOffset = bitIndex % 8;
    const bit = (bitmask[byteIndex] >> (7 - bitOffset)) & 1;
    
    if (bit === 1) {
      numbers.push(bitIndex + MIN_VALUE);
    }
  }
  
  // Return sorted array
  return numbers.sort((a, b) => a - b);
}

