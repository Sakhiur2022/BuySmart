export class SimpleRateLimiter {
  private nextAvailableAt = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly minDelayMs: number) {}

  async schedule<T>(task: () => Promise<T>): Promise<T> {
    let result: T;

    this.queue = this.queue.then(async () => {
      const now = Date.now();
      const waitMs = Math.max(0, this.nextAvailableAt - now);

      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }

      this.nextAvailableAt = Date.now() + this.minDelayMs;
      result = await task();
    });

    await this.queue;
    return result!;
  }
}
