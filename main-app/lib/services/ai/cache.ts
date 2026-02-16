interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TTLCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private cleanupCounter = 0;
  private readonly cleanupInterval = 100;

  get(key: string): T | undefined {
    const entry = this.store.get(key);

    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });

    this.cleanupCounter += 1;
    if (this.cleanupCounter >= this.cleanupInterval) {
      this.cleanupCounter = 0;
      this.cleanupExpired();
    }
  }

  clear(): void {
    this.store.clear();
  }

  private cleanupExpired(): void {
    const now = Date.now();

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}
