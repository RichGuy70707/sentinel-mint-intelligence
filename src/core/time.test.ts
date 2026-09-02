import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyMintStatus, formatCountdown, formatWhen, normalizeTimestamp, stageClock, windowLabel } from "./time.ts";

describe("time", () => {
  it("formats countdown without a negative sign", () => {
    assert.equal(formatCountdown(1000), "00:00:01");
    assert.equal(formatCountdown(-1000), "ENDED");
    assert.equal(formatCountdown(0), "ENDED");
    assert.equal(formatCountdown(null), "—");
    assert.equal(formatCountdown(90_000), "00:01:30");
  });

  it("rejects epoch and second-scale junk as timestamps", () => {
    assert.equal(normalizeTimestamp(0), null);
    assert.equal(normalizeTimestamp(1), null);
    assert.equal(normalizeTimestamp(NaN), null);
    assert.equal(normalizeTimestamp(-1), null);
    const sec = 1_700_000_000;
    const ms = normalizeTimestamp(sec);
    assert.ok(ms != null && Math.abs(ms - sec * 1000) < 2);
    assert.equal(formatWhen(0), "UNKNOWN");
    assert.equal(formatWhen(null), "UNKNOWN");
  });

  it("stage clock covers future, live, ended, unknown", () => {
    const now = Date.UTC(2026, 0, 1);
    assert.equal(stageClock(now + 5_000, now + 10_000, now).text, "00:00:05");
    assert.equal(stageClock(now + 5_000, now + 10_000, now).kind, "future");
    assert.equal(stageClock(now - 5_000, now + 9_000, now).kind, "active");
    assert.equal(stageClock(now - 20_000, now - 10_000, now).text, "ENDED");
    assert.equal(stageClock(0, 0, now).text, "—");
    assert.equal(stageClock(now - 5_000, null, now).text, "LIVE");
    assert.equal(stageClock(null, null, now).kind, "unknown");
  });

  it("classifies stage windows and ignores epoch zeros", () => {
    const now = 1_700_000_000_000;
    assert.equal(
      classifyMintStatus([{ startTime: now - 10, endTime: now + 10 }], now),
      "LIVE",
    );
    assert.equal(
      classifyMintStatus([{ startTime: now + 10, endTime: now + 20 }], now),
      "UPCOMING",
    );
    assert.equal(
      classifyMintStatus([{ startTime: now - 20, endTime: now - 10 }], now),
      "ENDED",
    );
    assert.equal(classifyMintStatus([{ startTime: 0, endTime: 0 }], now), "UNKNOWN");
  });

  it("labels calendar buckets", () => {
    const now = Date.now();
    assert.equal(windowLabel(now - 1000, now), "Minting Now");
    assert.equal(windowLabel(now + 10_000, now), "Next Hour");
  });
});
