import { afterEach, describe, expect, it, vi } from "vitest";
import { dayToDate, daySpan, parseDay, todayEpochDay } from "./dates";

// Italian time: UTC+2 in summer, so the local day changes two hours before the UTC one.
process.env.TZ = "Europe/Rome";

describe("parseDay", () => {
  it("counts days since 1970-01-01", () => {
    expect(parseDay("1970-01-01")).toBe(0);
    expect(parseDay("1970-01-02")).toBe(1);
  });

  it("gives consecutive integers across a year change and a leap day", () => {
    expect(parseDay("2026-01-01") - parseDay("2025-12-31")).toBe(1);
    expect(parseDay("2028-03-01") - parseDay("2028-02-28")).toBe(2);
  });

  it("is not shifted by daylight saving time", () => {
    expect(parseDay("2026-03-30") - parseDay("2026-03-29")).toBe(1);
    expect(parseDay("2026-10-26") - parseDay("2026-10-25")).toBe(1);
  });

  it("round-trips through dayToDate", () => {
    expect(dayToDate(parseDay("2025-06-05")).toISOString().slice(0, 10)).toBe("2025-06-05");
  });
});

describe("todayEpochDay", () => {
  afterEach(() => vi.useRealTimers());

  it("uses the local day, not the UTC one", () => {
    vi.useFakeTimers();
    // 23:30 UTC on Sep 27 is 01:30 on Sep 28 in Italy.
    vi.setSystemTime(new Date("2026-09-27T23:30:00Z"));
    expect(todayEpochDay()).toBe(parseDay("2026-09-28"));
  });

  it("changes at local midnight on New Year's Eve", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-12-31T22:59:00Z")); // 23:59 in Italy (UTC+1)
    expect(todayEpochDay()).toBe(parseDay("2025-12-31"));
    vi.setSystemTime(new Date("2025-12-31T23:00:00Z")); // 00:00 on Jan 1
    expect(todayEpochDay()).toBe(parseDay("2026-01-01"));
  });
});

describe("daySpan", () => {
  it("counts days under 60, with the singular for one", () => {
    expect(daySpan(0)).toBe("0 days");
    expect(daySpan(1)).toBe("1 day");
    expect(daySpan(59)).toBe("59 days");
  });

  it("switches to months from 60 days and to years from 24 months", () => {
    expect(daySpan(60)).toBe("2 months");
    expect(daySpan(700)).toBe("23 months");
    expect(daySpan(730)).toBe("2 years");
  });

  it("works across a year change", () => {
    expect(daySpan(parseDay("2026-01-10") - parseDay("2025-12-25"))).toBe("16 days");
  });
});
