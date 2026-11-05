import { describe, expect, it } from "vitest";
import { parseServiceTimes } from "../src/service-times.ts";

describe("parseServiceTimes", () => {
  it("reads stored display format", () => {
    expect(parseServiceTimes("Sun 9:00 AM; Sun 4:30 PM").slots).toEqual([{ dayOfWeek: 0, startTime: "09:00" }, { dayOfWeek: 0, startTime: "16:30" }]);
  });
  it("reads OSM format with ranges and lists", () => {
    const s = parseServiceTimes("Su 08:00, 10:30; Mo-We 19:00");
    expect(s.parsed).toBe(true);
    expect(s.slots).toHaveLength(5);
  });
  it("keeps raw when it can't parse", () => {
    expect(parseServiceTimes("Dec-Apr Fr[1] 16:00")).toEqual({ raw: "Dec-Apr Fr[1] 16:00", slots: [], parsed: false });
  });
  it("handles empty", () => expect(parseServiceTimes(null)).toEqual({ raw: null, slots: [], parsed: false }));
});
