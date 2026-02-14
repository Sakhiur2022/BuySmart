export class SimpleRateLimiter {
  private nextAvailableAt = 0;

  constructor(private readonly minDelayMs: number) {}

  async schedule<T>(task: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const waitMs = Math.max(0, this.nextAvailableAt - now);

    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    this.nextAvailableAt = Date.now() + this.minDelayMs;
    return task();
  }
}
