import { describe, expect, it } from "vitest";
import { CONTRIBUTION_MODES, formatOpportunity, type ContributionMode } from "../domain/contribution";
import { ContributionHistory } from "../domain/contribution-history";
import { GENERIC_COMMENT_PATTERNS } from "../domain/distinctiveness";
import { DEFAULT_USER_PROFILE, type UserProfile } from "../domain/user-profile";
import { evaluateContribution } from "./contribution-companion";

const SERVICE_BUS_EVIDENCE_PROFILE: UserProfile = {
  expertise: DEFAULT_USER_PROFILE.expertise,
  evidence: [
    {
      id: "sb-retry-harness",
      kind: "experiment",
      topics: ["Azure Integration Architecture", "Messaging", "Resilience"],
      summary:
        "The Service Bus retry harness measured dead-letter depth against max delivery count.",
      suggests:
        "Poison payloads clustered on the DLQ, so widening retries hid the fault instead of removing it.",
    },
  ],
};

const INTEGRATION_PROJECT_PROFILE: UserProfile = {
  expertise: DEFAULT_USER_PROFILE.expertise,
  evidence: [
    {
      id: "integration-processor",
      kind: "project",
      topics: ["Azure Integration Architecture", "Resilience", ".NET"],
      workName: "the integration processor",
      summary: "Service Bus handler lock duration versus processing time.",
      suggests: "Lock expiry turned at-least-once delivery into an application protocol.",
    },
  ],
};

function evaluate(
  text: string,
  profile: UserProfile = DEFAULT_USER_PROFILE,
  history = new ContributionHistory()
) {
  return evaluateContribution({
    post: { text, source: "test" },
    profile,
    history,
  });
}

describe("evaluateContribution — required situations", () => {
  it("SKIPs a generic inspirational LinkedIn post", () => {
    const result = evaluate(
      "Leadership is about inspiring others. Grateful for my amazing team. Monday motivation!"
    );
    expect(result.verdict).toBe("SKIP");
    expect(result.contribution).toBeUndefined();
    expect(result.mode).toBeUndefined();
    expect(result.why.length).toBeGreaterThan(20);
    expect(formatOpportunity(result)).toContain("Verdict:\nSKIP");
    expect(formatOpportunity(result)).not.toContain("Contribution:");
  });

  it("adds one insight when a technical post is missing a real nuance", () => {
    const result = evaluate(
      "Retries make your system more reliable. Just add a retry policy around every downstream call and you'll be fine."
    );
    expect(result.verdict).toBe("COMMENT");
    expect(result.mode).toBe("ADD_ONE_INSIGHT");
    expect(result.angle).toBe("retry amplification");
    expect(result.novelty).toBe("NEW");
    expect(result.contribution).toMatch(/idempoten|backoff|budget/i);
    expect(result.contribution).not.toMatch(/in my experience/i);
    expect(result.why).toMatch(/retr/i);
  });

  it("challenges a questionable architecture assumption", () => {
    const result = evaluate(
      "Microservices are always the right architecture for any growing product. If you're still on a monolith, you're already behind."
    );
    expect(result.verdict).toBe("COMMENT");
    expect(result.mode).toBe("CHALLENGE_ASSUMPTION");
    expect(result.contribution).toMatch(/monolith|ownership|consistency/i);
    expect(result.contribution).not.toMatch(/you'?re wrong|always disagree/i);
  });

  it("draws a technical distinction when two concepts are conflated", () => {
    const result = evaluate(
      "We achieved reliability by adding retries. If the request fails, we just retry until it succeeds, so the system is durable."
    );
    expect(result.verdict).toBe("COMMENT");
    expect(result.mode).toBe("TECHNICAL_DISTINCTION");
    expect(result.contribution).toMatch(/durab/i);
    expect(result.contribution).toMatch(/acknowledged|crash/i);
  });

  it("shares evidence only when verified engineering evidence exists", () => {
    const post =
      "We're seeing Azure Service Bus retries succeed in metrics while users still lose orders. We keep increasing max delivery count.";

    const withEvidence = evaluate(post, SERVICE_BUS_EVIDENCE_PROFILE);
    expect(withEvidence.verdict).toBe("COMMENT");
    expect(withEvidence.mode).toBe("SHARE_EVIDENCE");
    expect(withEvidence.contribution).toMatch(/dead-letter|dlq/i);
    expect(withEvidence.contribution).not.toMatch(/in my experience/i);

    const withoutEvidence = evaluate(post);
    expect(withoutEvidence.mode).not.toBe("SHARE_EVIDENCE");
    expect(withoutEvidence.contribution ?? "").not.toMatch(/in my experience/i);
  });

  it("asks a better question when the technical claim is underspecified", () => {
    const result = evaluate("We need to scale the API. Let's add more instances.");
    expect(result.verdict).toBe("COMMENT");
    expect(result.mode).toBe("ASK_BETTER_QUESTION");
    expect(result.contribution).toMatch(/\?/);
    expect(result.contribution).not.toMatch(/what do you think\?/i);
    expect(result.contribution).toMatch(/bottleneck|hot partition|instances/i);
  });

  it("opens a discussion on a strong technical topic", () => {
    const result = evaluate(
      "We've been moving our integration layer from request/reply to events. Curious how others are handling the shift from orchestrated workflows to choreography."
    );
    expect(result.verdict).toBe("COMMENT");
    expect(result.mode).toBe("OPEN_DISCUSSION");
    expect(result.contribution).toMatch(/compensat|orchestration|workflow/i);
  });

  it("corrects an incorrect technical claim carefully", () => {
    const result = evaluate(
      "Kafka gives you exactly-once delivery out of the box, so you don't need idempotent consumers."
    );
    expect(result.verdict).toBe("COMMENT");
    expect(result.mode).toBe("CORRECT_CAREFULLY");
    expect(result.contribution).toMatch(/exactly-once/i);
    expect(result.contribution).toMatch(/idempoten/i);
    expect(result.contribution).not.toMatch(/you're wrong|incorrect/i);
  });

  it("bridges to the user's engineering work without self-promoting", () => {
    const post =
      "Designing an Azure integration layer in .NET: how do you keep Service Bus handlers resilient without turning every failure into a retry storm?";
    const result = evaluate(post, INTEGRATION_PROJECT_PROFILE);
    expect(result.verdict).toBe("COMMENT");
    expect(result.mode).toBe("BRIDGE_TO_ENGINEERING");
    expect(result.contribution).toMatch(/lock|handler|service bus/i);
    expect(result.contribution).not.toMatch(/i wrote an article/i);
    expect(result.contribution).not.toMatch(/check out my/i);
  });

  it("selects a different intellectual angle when the first one was just used", () => {
    const history = new ContributionHistory();
    const post =
      "Retries make your system more reliable. Just add a retry policy around every downstream call and you'll be fine.";
    const first = evaluate(post, DEFAULT_USER_PROFILE, history);
    const second = evaluate(post, DEFAULT_USER_PROFILE, history);
    expect(first.verdict).toBe("COMMENT");
    expect(second.verdict).toBe("COMMENT");
    expect(first.angle).toBe("retry amplification");
    expect(second.angle).toBe("idempotency");
    expect(second.novelty).toBe("NEW");
  });

  it("SKIPs a generic 'great post' opportunity", () => {
    const result = evaluate("So true! This is such an important conversation. Thanks for sharing.");
    expect(result.verdict).toBe("SKIP");
    expect(result.contribution).toBeUndefined();
  });
});

describe("evaluateContribution — quality rules", () => {
  it("never invents personal experience on the default profile", () => {
    const posts = [
      "Retries make your system more reliable. Just add a retry policy around every downstream call and you'll be fine.",
      "Microservices are always the right architecture for any growing product. If you're still on a monolith, you're already behind.",
      "We need to scale the API. Let's add more instances.",
      "Kafka gives you exactly-once delivery out of the box, so you don't need idempotent consumers.",
    ];
    for (const text of posts) {
      const result = evaluate(text);
      expect(result.contribution ?? "").not.toMatch(/in my experience/i);
      expect(result.contribution ?? "").not.toMatch(/when I led/i);
      expect(result.contribution ?? "").not.toMatch(/in production we/i);
      expect(result.contribution ?? "").not.toMatch(/my team shipped/i);
    }
  });

  it("does not inject expertise keywords into an unrelated post", () => {
    const result = evaluate(
      "Our dental clinic just hired a new receptionist and the waiting room feels calmer already."
    );
    expect(result.verdict).toBe("SKIP");
    expect(result.contribution).toBeUndefined();
  });

  it("does not treat generic agreement as a successful comment", () => {
    const result = evaluate("Great perspective. Really important stuff. Thanks for sharing!");
    expect(result.verdict).toBe("SKIP");
  });

  it("selects a mode before drafting and explains why the contribution is useful", () => {
    const result = evaluate(
      "Retries make your system more reliable. Just add a retry policy around every downstream call and you'll be fine."
    );
    expect(result.mode).toBeDefined();
    expect(CONTRIBUTION_MODES).toContain(result.mode as ContributionMode);
    expect(result.why.length).toBeGreaterThan(30);
    expect(result.contribution?.split(/\s+/).length).toBeLessThanOrEqual(70);
  });

  it("makes SKIP a valid final outcome with no fallback comment", () => {
    const result = evaluate("Blessed to work with such inspiring leaders. Dream big this week.");
    expect(result.verdict).toBe("SKIP");
    expect(result.contribution).toBeUndefined();
    expect(result.mode).toBeUndefined();
  });
});

const TECHNICAL_CORPUS: readonly string[] = [
  "Retries make your system more reliable. Just add a retry policy around every downstream call and you'll be fine.",
  "Retries are all you need for reliability. Wrap every downstream call and forget about it.",
  "Microservices are always the right architecture for any growing product. If you're still on a monolith, you're already behind.",
  "If you are still on a monolith, microservices are always the right next step.",
  "We achieved reliability by adding retries. If the request fails, we just retry until it succeeds, so the system is durable.",
  "Retry until it succeeds and the write is durable. That is how we got reliability.",
  "We need to scale the API. Let's add more instances.",
  "Scaling means adding more instances in front of the API.",
  "We've been moving our integration layer from request/reply to events. Curious how others are handling the shift from orchestrated workflows to choreography.",
  "From request/reply to events: orchestration versus choreography is the real design fight.",
  "Kafka gives you exactly-once delivery out of the box, so you don't need idempotent consumers.",
  "Exactly-once Kafka means there is no need for an idempotent consumer.",
  "Just add a cache and the API will be faster.",
  "Caching will make it faster — just add Redis in front.",
  "If we just move this to an asynchronous background job, the request will no longer fail.",
  "Go async and the caller won't fail anymore.",
  "Events automatically decouple the producer from every consumer. Just publish and you are done.",
  "Publishing events automatically means we are decoupled.",
  "HTTP is reliable. If the REST call succeeds, the work always succeeded.",
  "REST guarantees delivery, so the HTTP path is reliable.",
  "We have 99.9% availability, so the system is resilient.",
  "High availability means we are already resilient.",
  "We need to scale the service to make each request faster.",
  "Scaling will improve performance and latency.",
  "We should use the outbox after the database write so the event is published.",
  "Publish the message after the database commit.",
  "Let's go event-driven for the next service.",
  "Event-driven architecture will fix this service.",
  "At-least-once delivery to the consumer means processing happened once.",
  "Exactly-once delivery settings make the handler safe.",
  "Our retry policy is the recovery strategy: retry until it succeeds.",
  "Recovery is just retrying the same call.",
  "Leadership is about inspiring others. Grateful for my amazing team. Monday motivation!",
  "So true! This is such an important conversation. Thanks for sharing.",
  "Great post. Love this. Couldn't agree more.",
  "Blessed to work with such inspiring leaders. Dream big this week.",
  "Hustle harder. Never stop learning. Glass half full.",
  "Proud of this journey and grateful for the amazing team.",
  "Our dental clinic just hired a new receptionist.",
  "The waiting room playlist at the clinic is so much better now.",
  "We keep increasing Service Bus max delivery count when users lose orders.",
  "Dead-letter queues on Azure Service Bus are filling while retries look healthy.",
  "How should a .NET Service Bus handler stay resilient when lock duration is shorter than processing?",
  "Azure integration architecture: where should a Service Bus failure stop being a retry?",
  "Idempotency keys on the API stopped our timeout-retry duplicates.",
  "Circuit breakers and timeouts are not the same resilience control.",
  "A saga is not two-phase commit with extra steps.",
  "Modular monolith versus microservices is an ownership question.",
  "Cloud autoscale will not fix a hot partition.",
  "Event Grid and Service Bus solve different integration jobs on Azure.",
];

describe("evaluateContribution — anti-repetition over a large corpus", () => {
  it("does not converge on a small set of generic structures across 50–100 evaluations", () => {
    const history = new ContributionHistory();
    const comments: string[] = [];
    const modes = new Set<string>();
    const ideaIds = new Set<string>();
    const angles = new Set<string>();
    const angleCounts = new Map<string, number>();
    const skips: string[] = [];

    const expanded = [...TECHNICAL_CORPUS, ...TECHNICAL_CORPUS];
    expect(expanded.length).toBeGreaterThanOrEqual(80);

    for (const [index, text] of expanded.entries()) {
      const profile =
        index % 17 === 0
          ? SERVICE_BUS_EVIDENCE_PROFILE
          : index % 19 === 0
            ? INTEGRATION_PROJECT_PROFILE
            : DEFAULT_USER_PROFILE;
      const result = evaluate(text, profile, history);
      if (result.verdict === "SKIP") {
        skips.push(text);
        expect(result.contribution).toBeUndefined();
        continue;
      }
      expect(result.contribution).toBeDefined();
      comments.push(result.contribution as string);
      if (result.mode) modes.add(result.mode);
      if (result.ideaId) ideaIds.add(result.ideaId);
      if (result.angleFingerprint) {
        angles.add(result.angleFingerprint);
        angleCounts.set(result.angleFingerprint, (angleCounts.get(result.angleFingerprint) ?? 0) + 1);
      }
    }

    const genericPosts = expanded.filter((text) =>
      /monday motivation|thanks for sharing|great post|dream big|hustle|dental clinic|waiting room/i.test(
        text
      )
    );
    for (const text of genericPosts) {
      expect(evaluate(text).verdict).toBe("SKIP");
    }

    expect(comments.length).toBeGreaterThan(20);
    expect(modes.size).toBeGreaterThanOrEqual(6);
    expect(ideaIds.size).toBeGreaterThanOrEqual(10);
    expect(angles.size).toBeGreaterThanOrEqual(8);
    expect(Math.max(0, ...angleCounts.values()) / comments.length).toBeLessThan(0.4);

    for (const comment of comments) {
      for (const pattern of GENERIC_COMMENT_PATTERNS) {
        expect(comment).not.toMatch(pattern);
      }
      expect(comment).not.toMatch(/^great /i);
      expect(comment).not.toMatch(/what do you think\?/i);
    }

    const openings = comments.map((comment) => comment.split(/\s+/).slice(0, 4).join(" ").toLowerCase());
    const openingCounts = new Map<string, number>();
    for (const opening of openings) {
      openingCounts.set(opening, (openingCounts.get(opening) ?? 0) + 1);
    }
    const mostCommonOpening = Math.max(...openingCounts.values());
    expect(mostCommonOpening / comments.length).toBeLessThan(0.45);
  });
});
