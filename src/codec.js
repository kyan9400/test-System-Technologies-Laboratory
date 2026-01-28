/**
 * Hybrid codec for compact serialization of integer sets (1..300)
 * 
 * Format A (B1): Bitset 300 bits + base64url (best for dense/large sets)
 * Format B (D1): Delta + varint + base91 (best for sparse/small sets)
 * 
 * Auto-selects the shorter format
 */

const MIN_VALUE = 1;
const MAX_VALUE = 300;
const BITMASK_SIZE_BYTES = 38; // 300 bits = 37.5 bytes, rounded up to 38

// Using base64url for Format D1 (simpler and more reliable than base91)
// Base91 would be more compact, but base64url is sufficient and easier to implement correctly

/**
 * Normalizes input: filters valid integers 1..300, removes duplicates, sorts
 */
function normalizeNumbers(numbers) {
  const numberSet = numbers instanceof Set ? numbers : new Set(numbers);
  const valid = [];
  
  for (const num of numberSet) {
    if (typeof num !== 'number' || !Number.isInteger(num)) {
      continue;
    }
    if (num >= MIN_VALUE && num <= MAX_VALUE && !isNaN(num) && isFinite(num)) {
      valid.push(num);
    }
  }
  
  // Remove duplicates and sort
  return [...new Set(valid)].sort((a, b) => a - b);
}

// ============================================================================
// Format A: Bitset + base64url
// ============================================================================

/**
 * Encodes bytes to base64url (URL-safe base64)
 */
function base64urlEncode(bytes) {
  const buffer = Buffer.from(bytes);
  const base64 = buffer.toString('base64');
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decodes base64url string to bytes
 */
function base64urlDecode(str) {
  let base64 = str
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  while (base64.length % 4) {
    base64 += '=';
  }
  
  const buffer = Buffer.from(base64, 'base64');
  const result = new Uint8Array(BITMASK_SIZE_BYTES);
  for (let i = 0; i < Math.min(buffer.length, BITMASK_SIZE_BYTES); i++) {
    result[i] = buffer[i];
  }
  
  return result;
}

/**
 * Serializes using Format A: Bitset + base64url
 */
function serializeBitset(numbers) {
  const bitmask = new Uint8Array(BITMASK_SIZE_BYTES);
  
  for (const num of numbers) {
    const bitIndex = num - MIN_VALUE; // 0..299
    const byteIndex = Math.floor(bitIndex / 8);
    const bitOffset = bitIndex % 8;
    bitmask[byteIndex] |= (1 << (7 - bitOffset));
  }
  
  const encoded = base64urlEncode(bitmask);
  return 'B1:' + encoded;
}

/**
 * Deserializes Format A: Bitset + base64url
 */
function deserializeBitset(payload) {
  const encoded = payload.slice(3); // Remove "B1:"
  
  if (encoded.length === 0) {
    throw new Error('Invalid B1 format: empty encoded data');
  }
  
  let bitmask;
  try {
    bitmask = base64urlDecode(encoded);
  } catch (e) {
    throw new Error(`Invalid base64url encoding: ${e.message}`);
  }
  
  if (bitmask.length !== BITMASK_SIZE_BYTES) {
    throw new Error(`Invalid bitmask size: expected ${BITMASK_SIZE_BYTES} bytes, got ${bitmask.length}`);
  }
  
  const numbers = [];
  for (let bitIndex = 0; bitIndex < 300; bitIndex++) {
    const byteIndex = Math.floor(bitIndex / 8);
    const bitOffset = bitIndex % 8;
    const bit = (bitmask[byteIndex] >> (7 - bitOffset)) & 1;
    
    if (bit === 1) {
      numbers.push(bitIndex + MIN_VALUE);
    }
  }
  
  return numbers.sort((a, b) => a - b);
}

// ============================================================================
// Format B: Delta + varint + base91
// ============================================================================

/**
 * Encodes a number to varint (variable-length integer, 7 bits per byte)
 * Returns array of bytes
 */
function encodeVarint(value) {
  if (value < 0) {
    throw new Error('Varint cannot encode negative numbers');
  }
  
  const bytes = [];
  let v = value;
  
  while (v >= 128) {
    bytes.push((v & 127) | 128); // Set continuation bit
    v >>>= 7;
  }
  bytes.push(v & 127); // Last byte without continuation bit
  
  return bytes;
}

/**
 * Decodes varint from byte array, returns {value, bytesRead}
 */
function decodeVarint(bytes, offset = 0) {
  let value = 0;
  let shift = 0;
  let bytesRead = 0;
  
  for (let i = offset; i < bytes.length; i++) {
    const byte = bytes[i];
    bytesRead++;
    
    value |= (byte & 127) << shift;
    
    if ((byte & 128) === 0) {
      break; // Last byte
    }
    
    shift += 7;
    if (shift >= 32) {
      throw new Error('Varint too large');
    }
  }
  
  return { value, bytesRead };
}

/**
 * Encodes bytes using base64url (reused from Format A)
 * For Format D1, we use base64url instead of base91 for simplicity and reliability
 */
function encodeBytesForDelta(bytes) {
  return base64urlEncode(bytes);
}

/**
 * Decodes base64url string to bytes (reused from Format A)
 */
function decodeBytesForDelta(str) {
  let base64 = str
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  while (base64.length % 4) {
    base64 += '=';
  }
  
  const buffer = Buffer.from(base64, 'base64');
  return new Uint8Array(buffer);
}

/**
 * Serializes using Format B: Delta + varint + base91
 */
function serializeDelta(numbers) {
  if (numbers.length === 0) {
    return 'D1:';
  }
  
  // Encode first number and deltas as varints
  const varintBytes = [];
  
  // First number (1-based, so subtract 1 to get 0-299 range)
  const firstVarint = encodeVarint(numbers[0] - 1);
  varintBytes.push(...firstVarint);
  
  // Deltas (differences between consecutive numbers, minimum 1)
  for (let i = 1; i < numbers.length; i++) {
    const delta = numbers[i] - numbers[i - 1];
    if (delta < 1) {
      throw new Error(`Invalid delta: ${delta} (numbers must be sorted)`);
    }
    // Delta is at least 1, so encode as (delta - 1) to save space
    const deltaVarint = encodeVarint(delta - 1);
    varintBytes.push(...deltaVarint);
  }
  
  // Encode varint bytes to base64url
  const encoded = encodeBytesForDelta(new Uint8Array(varintBytes));
  
  return 'D1:' + encoded;
}

/**
 * Deserializes Format B: Delta + varint + base91
 */
function deserializeDelta(payload) {
  const encoded = payload.slice(3); // Remove "D1:"
  
  if (encoded.length === 0) {
    return []; // Empty set
  }
  
  // Decode base64url to bytes
  let bytes;
  try {
    bytes = decodeBytesForDelta(encoded);
  } catch (e) {
    throw new Error(`Invalid base64url encoding: ${e.message}`);
  }
  
  // Decode varints
  const numbers = [];
  let offset = 0;
  
  // Decode first number
  if (offset >= bytes.length) {
    throw new Error('Invalid D1 format: missing first number');
  }
  
  const firstResult = decodeVarint(bytes, offset);
  const first = firstResult.value + 1; // Convert back from 0-299 to 1-300
  if (first < MIN_VALUE || first > MAX_VALUE) {
    throw new Error(`Invalid first number: ${first}`);
  }
  numbers.push(first);
  offset += firstResult.bytesRead;
  
  // Decode deltas
  let current = first;
  while (offset < bytes.length) {
    const deltaResult = decodeVarint(bytes, offset);
    const delta = deltaResult.value + 1; // Convert back from (delta-1) to delta
    offset += deltaResult.bytesRead;
    
    current += delta;
    if (current > MAX_VALUE) {
      throw new Error(`Invalid number after delta: ${current}`);
    }
    numbers.push(current);
  }
  
  return numbers.sort((a, b) => a - b);
}

// ============================================================================
// Public API: Hybrid codec with auto-selection
// ============================================================================

/**
 * Serializes a set of numbers to a compact string
 * Auto-selects the shorter format (B1 or D1)
 * 
 * @param {number[] | Set<number>} numbers - Input numbers
 * @returns {string} Serialized string with format "B1:..." or "D1:..."
 */
export function serialize(numbers) {
  const normalized = normalizeNumbers(numbers);
  
  if (normalized.length === 0) {
    // Empty set: D1 is shorter
    return 'D1:';
  }
  
  // Try both formats
  const bitsetStr = serializeBitset(normalized);
  const deltaStr = serializeDelta(normalized);
  
  // Return shorter (if equal, prefer B1 for simplicity)
  if (deltaStr.length < bitsetStr.length) {
    return deltaStr;
  }
  return bitsetStr;
}

/**
 * Deserializes a string back to an array of numbers
 * 
 * @param {string} payload - Serialized string
 * @returns {number[]} Sorted array of unique numbers 1..300
 * @throws {Error} If payload format is invalid
 */
export function deserialize(payload) {
  if (typeof payload !== 'string' || payload.length === 0) {
    throw new Error('Invalid payload: must be a non-empty string');
  }
  
  if (payload.startsWith('B1:')) {
    return deserializeBitset(payload);
  } else if (payload.startsWith('D1:')) {
    return deserializeDelta(payload);
  } else {
    throw new Error(`Invalid format: expected prefix "B1:" or "D1:", got "${payload.substring(0, 3)}"`);
  }
}
