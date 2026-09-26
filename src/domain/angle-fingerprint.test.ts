import { describe, expect, it } from "vitest";
import {
  alreadySaidThis,
  assessNoveltyAgainst,
  fingerprintAngle,
  isSameIntellectualAngle,
} from "./angle-fingerprint";

const DAY = 86_400_000;

describe("angle fingerprints", () => {
  it("builds a stable fingerprint from topic, concepts, reason, and angle", () => {
    const fingerprint = fingerprintAngle({
      topics: ["Azure Integration Architecture"],
      concepts: ["retry", "lock", "failure-ownership"],
      reason: "connect_concepts",
      angle: "ownership of failure",
    });
    expect(fingerprint).toContain("retry");
    expect(fingerprint).toContain("lock");
    expect(fingerprint).toContain("failure-ownership");
    expect(fingerprint).toBe(fingerprintAngle({
      topics: ["Azure Integration Architecture"],
      concepts: ["failure-ownership", "lock", "retry"],
      reason: "connect_concepts",
      angle: "ownership of failure",
    }));
  });

  it("does not treat the same wording as the same idea when the concepts differ", () => {
    const amplification = {
      concepts: ["retry-amplification", "poison-message"],
      angle: "retry amplification",
    };
    const idempotency = {
      concepts: ["idempotency", "duplicate-side-effects"],
      angle: "idempotency",
    };
    expect(alreadySaidThis(amplification, idempotency)).toBe(false);
    expect(isSameIntellectualAngle(amplification, idempotency)).toBe(false);
  });

  it("detects the same idea under different wording", () => {
    const first = {
      concepts: ["retry-amplification", "poison-message"],
      angle: "retry amplification",
    };
    const second = {
      concepts: ["poison-message", "retry-amplification"],
      angle: "amplifying a message that can never succeed",
    };
    expect(alreadySaidThis(first, second)).toBe(true);
  });

  it("allows the same topic with a different angle", () => {
    const amplification = {
      topics: ["Resilience"],
      concepts: ["retry-amplification"],
      angle: "retry amplification",
    };
    const idempotency = {
      topics: ["Resilience"],
      concepts: ["idempotency"],
      angle: "idempotency",
    };
    expect(isSameIntellectualAngle(amplification, idempotency)).toBe(false);
  });

  it("treats the same angle on a different topic as conceptually repetitive", () => {
    const retries = {
      topics: ["Resilience"],
      concepts: ["retry-amplification"],
      angle: "retry amplification",
    };
    const serviceBus = {
      topics: ["Azure Integration Architecture"],
      concepts: ["retry-amplification"],
      angle: "retry amplification",
    };
    expect(isSameIntellectualAngle(retries, serviceBus)).toBe(true);
  });

  it("penalizes a recent angle much more than an old one", () => {
    const now = Date.parse("2026-09-12T12:00:00Z");
    const candidate = { concepts: ["retry-amplification"], angle: "retry amplification" };

    const recent = assessNoveltyAgainst(
      candidate,
      [{ ...candidate, at: now - DAY }],
      now
    );
    const old = assessNoveltyAgainst(
      candidate,
      [{ ...candidate, at: now - 400 * DAY }],
      now
    );

    expect(recent.novelty).toBe("RECENTLY_USED");
    expect(recent.penalty).toBeGreaterThan(20);
    expect(old.novelty).toBe("NEW");
    expect(old.penalty).toBe(0);
  });

  it("gives a previously used angle a smaller penalty than a recent one", () => {
    const now = Date.parse("2026-09-12T12:00:00Z");
    const candidate = { concepts: ["idempotency"], angle: "idempotency" };
    const medium = assessNoveltyAgainst(
      candidate,
      [{ ...candidate, at: now - 40 * DAY }],
      now
    );
    expect(medium.novelty).toBe("PREVIOUSLY_USED");
    expect(medium.penalty).toBeGreaterThan(0);
    expect(medium.penalty).toBeLessThan(30);
  });
});
