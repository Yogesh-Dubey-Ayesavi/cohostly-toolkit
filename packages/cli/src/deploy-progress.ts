// What a deploy shows while the server works: a line per stage, and for the build either every log line (--verbose) or one live status line.
// The status line shows the time spent and the newest log line, so a long build never looks frozen. It only redraws on a terminal.

export interface Out { write(s: string): unknown; isTTY?: boolean; columns?: number }

export interface ProgressOptions { verbose: boolean; out?: Out; now?: () => number }

const CLEAR = '\r\x1b[K';

export class DeployProgress {
  private out: Out;
  private now: () => number;
  private stage = '';
  private since = 0;
  private newest = '';
  private statusShown = false;
  private timer?: ReturnType<typeof setInterval>;

  constructor(private label: (stage: string) => string, private o: ProgressOptions) {
    this.out = o.out ?? process.stdout;
    this.now = o.now ?? Date.now;
  }

  /** One streamed event from the server. */
  event(e: { stage: string; message?: string; log?: string }): void {
    if (e.log !== undefined) { this.log(e.log); return; }
    if (e.stage === this.stage && !e.message) return;
    this.clearStatus();
    if (e.stage !== this.stage) { this.stage = e.stage; this.since = this.now(); this.newest = ''; }
    this.out.write(`${this.label(e.stage)}${e.message ? '  ' + e.message : ''}\n`);
    this.arm();
  }

  /** Call when the stream ends, so no status line is left behind. */
  done(): void {
    if (this.timer) clearInterval(this.timer);
    this.clearStatus();
  }

  private log(line: string): void {
    this.newest = line;
    if (this.o.verbose) { this.clearStatus(); this.out.write(`    ${line}\n`); }
    else this.draw();
  }

  private arm(): void {
    if (this.o.verbose || !this.out.isTTY || this.timer) return;
    this.timer = setInterval(() => this.draw(), 1000);
    this.timer.unref();
  }

  private draw(): void {
    if (this.o.verbose || !this.out.isTTY || !this.stage) return;
    const secs = Math.max(0, Math.round((this.now() - this.since) / 1000));
    const head = `    ${secs}s`;
    const room = Math.max(10, (this.out.columns ?? 100) - head.length - 3);
    const tail = this.newest ? `  ${this.newest.replace(/\s+/g, ' ').trim().slice(0, room)}` : '';
    this.out.write(`${CLEAR}${head}${tail}`);
    this.statusShown = true;
  }

  private clearStatus(): void {
    if (!this.statusShown) return;
    this.out.write(CLEAR);
    this.statusShown = false;
  }
}
