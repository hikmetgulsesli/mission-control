export interface BackgroundIntervalOwner {
  start(): void;
  stop(): Promise<void>;
}

type IntervalHandle = ReturnType<typeof setInterval>;

/**
 * Lifecycle owner for one bounded periodic effect. The initial tick is started
 * without an HTTP request, interval ticks never overlap, and stop prevents new
 * work while awaiting the current tick.
 */
export class SingleFlightBackgroundIntervalOwner implements BackgroundIntervalOwner {
  private interval: IntervalHandle | null = null;
  private inFlight: Promise<void> | null = null;
  private started = false;
  private stopped = false;

  constructor(private readonly options: Readonly<{
    intervalMs: number;
    run(): Promise<void>;
    onError?(error: unknown): void;
    setIntervalImpl?: typeof setInterval;
    clearIntervalImpl?: typeof clearInterval;
  }>) {
    if (!Number.isSafeInteger(options.intervalMs) || options.intervalMs < 1 || options.intervalMs > 86_400_000) {
      throw new Error("BACKGROUND_INTERVAL_CONFIGURATION_INVALID");
    }
  }

  start(): void {
    if (this.started) return;
    if (this.stopped) throw new Error("BACKGROUND_INTERVAL_OWNER_ALREADY_STOPPED");
    this.started = true;
    void this.tick();
    const schedule = this.options.setIntervalImpl ?? setInterval;
    this.interval = schedule(() => { void this.tick(); }, this.options.intervalMs);
    this.interval.unref?.();
  }

  async stop(): Promise<void> {
    if (this.stopped) {
      if (this.inFlight) await this.inFlight;
      return;
    }
    this.stopped = true;
    if (this.interval) {
      const cancel = this.options.clearIntervalImpl ?? clearInterval;
      cancel(this.interval);
      this.interval = null;
    }
    if (this.inFlight) await this.inFlight;
  }

  private tick(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.inFlight) return this.inFlight;
    const operation = Promise.resolve()
      .then(() => this.options.run())
      .catch((error) => { this.options.onError?.(error); })
      .finally(() => {
        if (this.inFlight === operation) this.inFlight = null;
      });
    this.inFlight = operation;
    return operation;
  }
}
