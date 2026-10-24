// shared
import { type SpaceSize, type SpaceTemplate } from "@void/shared";

/** The one space every bot joins. Not a real row anywhere: the server here keeps it in memory. */
export const LOAD_SPACE_ID = "99999999-9999-4999-8999-999999999999";

export interface LoadOptions {
  bots: number;
  seconds: number;
  size: SpaceSize;
  template: SpaceTemplate;
  /** Bots joining per second, so the ramp does not look like a thundering herd. */
  rampPerSecond: number;
  /** Moves a bot sends per second; the client sends one every 80 ms (12.5). */
  sendHz: number;
}

export const DEFAULTS: LoadOptions = {
  bots: 100,
  seconds: 60,
  size: "medium",
  template: "office",
  rampPerSecond: 20,
  sendHz: 12.5,
};

/** What the server process reports once a second. */
export interface ServerStats {
  clients: number;
  /** CPU use of the server process over the last second, in percent of one core. */
  cpuPercent: number;
  /** Event loop delay (99th percentile and worst) over the last second, in milliseconds. */
  loopP99Ms: number;
  loopMaxMs: number;
  rssMb: number;
  /** Bytes the server wrote to all sockets since it started. */
  bytesOut: number;
  /** Bytes the server read from all sockets since it started. */
  bytesIn: number;
}

export type ServerMessage = { type: "ready"; port: number } | { type: "stats"; stats: ServerStats };
