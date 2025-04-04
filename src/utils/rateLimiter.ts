// Mock implementation of rate limiter for local frontend development

/**
 * A simple token bucket rate limiter implementation
 */
export class TokenBucket {
  private tokens: number;
  private lastRefillTimestamp: number;
  private refillRate: number;
  private capacity: number;

  /**
   * @param capacity Maximum number of tokens in the bucket
   * @param refillTimeMs Time in ms to refill the bucket
   */
  constructor(capacity: number, refillTimeMs: number) {
    this.tokens = capacity;
    this.capacity = capacity;
    this.lastRefillTimestamp = Date.now();
    this.refillRate = capacity / refillTimeMs;
  }

  refill() {
    const now = Date.now();
    const timePassed = now - this.lastRefillTimestamp;
    const tokensToAdd = timePassed * this.refillRate;
    
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefillTimestamp = now;
    }
  }

  tryRemoveTokens(count: number): boolean {
    this.refill();
    
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    
    return false;
  }
}

/**
 * Creates a rate limiter with the specified capacity and refill time
 *
 * @param capacity Number of operations allowed in the time window
 * @param refillTimeMs Time window in milliseconds
 * @returns A rate limiter instance
 */
export function getRateLimiter(capacity: number, refillTimeMs: number) {
  return new TokenBucket(capacity, refillTimeMs);
} 