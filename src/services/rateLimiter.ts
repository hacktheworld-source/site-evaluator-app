class RateLimiter {
  private tokens: number;
  private lastRefilled: number;
  private refillRate: number;
  private capacity: number;

  constructor(tokensPerInterval: number, interval: number) {
    this.tokens = tokensPerInterval;
    this.lastRefilled = Date.now();
    this.refillRate = tokensPerInterval / interval;
    this.capacity = tokensPerInterval;
  }

  tryRemoveTokens(count: number): boolean {
    this.refill();
    if (this.tokens < count) {
      return false;
    }
    this.tokens -= count;
    return true;
  }

  private refill() {
    const now = Date.now();
    const timePassed = now - this.lastRefilled;
    const refill = timePassed * this.refillRate;
    this.tokens = Math.min(this.capacity, this.tokens + refill);
    this.lastRefilled = now;
  }
}

export function getRateLimiter(tokensPerInterval: number, interval: number): RateLimiter {
  return new RateLimiter(tokensPerInterval, interval);
}