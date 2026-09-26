import type { ContributionMode, ContributionReason } from "./contribution";
import { hasAllMarkers, hasAnyMarker, missingAllMarkers } from "./text-match";

export interface KnowledgeMatch {
  id: string;
  mode: ContributionMode;
  reason: ContributionReason;
  why: string;
  specificity: number;
  requiredTokens: readonly string[];
  topics: readonly string[];
  angle: string;
  concepts: readonly string[];
  observation?: string;
  insight?: string;
  implication?: string;
  usefulPart?: string;
  assumption?: string;
  whyAssumptionFails?: string;
  betterFraming?: string;
  conceptA?: string;
  conceptB?: string;
  distinction?: string;
  claim?: string;
  question?: string;
  discussionAngle?: string;
  correction?: string;
  consequence?: string;
  engineeringBridge?: string;
}

export interface TopicArea {
  expertise: string;
  markers: readonly string[];
}

export const TOPIC_AREAS: readonly TopicArea[] = [
  {
    expertise: "Software Architecture",
    markers: [
      "architecture",
      "microservices",
      "monolith",
      "modular monolith",
      "bounded context",
      "ownership boundary",
    ],
  },
  {
    expertise: "Azure Integration Architecture",
    markers: [
      "azure",
      "service bus",
      "event grid",
      "logic apps",
      "apim",
      "api management",
      "integration",
    ],
  },
  {
    expertise: ".NET",
    markers: [".net", "dotnet", "csharp", "c#", "asp.net", "polly"],
  },
  {
    expertise: "Distributed Systems",
    markers: [
      "distributed",
      "consistency",
      "consensus",
      "partition",
      "replica",
      "cap theorem",
      "exactly-once",
      "at-least-once",
    ],
  },
  {
    expertise: "Messaging",
    markers: [
      "kafka",
      "rabbitmq",
      "service bus",
      "queue",
      "pubsub",
      "pub/sub",
      "dead-letter",
      "dlq",
      "message",
    ],
  },
  {
    expertise: "Event-Driven Architecture",
    markers: [
      "event-driven",
      "event driven",
      "choreography",
      "orchestration",
      "saga",
      "outbox",
      "domain event",
    ],
  },
  {
    expertise: "APIs",
    markers: ["api", "rest", "http", "idempotency", "timeout", "versioning"],
  },
  {
    expertise: "Resilience",
    markers: ["retry", "retries", "circuit breaker", "timeout", "fallback", "resilience", "backoff"],
  },
  {
    expertise: "Cloud Architecture",
    markers: ["cloud", "availability zone", "scale-out", "autoscale", "region failover"],
  },
];

const INCORRECT_CLAIMS: readonly KnowledgeMatch[] = [
  {
    id: "claim:kafka-exactly-once-no-idempotency",
    mode: "CORRECT_CAREFULLY",
    reason: "practical_consequence",
    why: "The post treats Kafka exactly-once as if it also made consumer side-effects safe, which it does not.",
    specificity: 92,
    requiredTokens: ["exactly-once", "consumer", "idempoten"],
    topics: ["Distributed Systems", "Messaging"],
    angle: "exactly-once vs consumer idempotency",
    concepts: ["exactly-once", "consumer-idempotency", "side-effects"],
    claim: "Kafka exactly-once delivery removes the need for idempotent consumers",
    correction:
      "Kafka's exactly-once is about producing and reading inside its own transaction boundary, not about the side-effects your handler performs.",
    consequence:
      "If that handler writes to a database or calls an API, a replay still duplicates the business action unless the consumer is idempotent.",
  },
  {
    id: "claim:http-is-reliable-transport",
    mode: "CORRECT_CAREFULLY",
    reason: "practical_consequence",
    why: "The post treats HTTP success as a reliable business outcome.",
    specificity: 80,
    requiredTokens: ["HTTP", "timeout", "acknowledgment"],
    topics: ["APIs", "Distributed Systems"],
    angle: "HTTP success vs durable work",
    concepts: ["http-success", "durable-work", "timeout-duplicates"],
    claim: "A successful HTTP response means the work is durably done",
    correction:
      "An HTTP 200 only means the server answered. It does not tell you whether the write was committed, or whether the client will see the same answer after a retry.",
    consequence:
      "Timeouts after the server committed are how silent duplicates appear.",
  },
];

const ASSUMPTIONS: readonly KnowledgeMatch[] = [
  {
    id: "assumption:microservices-always",
    mode: "CHALLENGE_ASSUMPTION",
    reason: "challenge_assumption",
    why: "The post assumes growth itself makes a monolith the wrong shape.",
    specificity: 88,
    requiredTokens: ["monolith", "ownership", "consistency"],
    topics: ["Software Architecture"],
    angle: "growth vs monolith split",
    concepts: ["modular-monolith", "ownership-boundary", "consistency-boundary"],
    usefulPart:
      "Splitting a growing system can help when teams and failure domains actually need independent release.",
    assumption: "growth itself means the monolith is already the wrong architecture",
    whyAssumptionFails:
      "A modular monolith can absorb a lot of growth without paying the distributed-failure and distributed-transaction tax.",
    betterFraming:
      "The useful split is along the first hard ownership or consistency boundary, not along every noun in the domain.",
  },
  {
    id: "assumption:events-equal-decoupling",
    mode: "CHALLENGE_ASSUMPTION",
    reason: "challenge_assumption",
    why: "The post treats 'we publish events' as equivalent to loose coupling.",
    specificity: 78,
    requiredTokens: ["event", "schema", "consumer"],
    topics: ["Event-Driven Architecture", "Messaging"],
    angle: "events vs decoupling",
    concepts: ["event-schema", "coupling-surface"],
    usefulPart: "Events are a good way to share facts after a decision has been made.",
    assumption: "publishing events automatically decouples producers from consumers",
    whyAssumptionFails:
      "A shared payload that every consumer must understand is still a coupling surface — it just moved into the schema.",
    betterFraming:
      "The better question is which facts are stable enough to broadcast, and which decisions still need a single owner.",
  },
];

const DISTINCTIONS: readonly KnowledgeMatch[] = [
  {
    id: "distinction:reliability-vs-durability",
    mode: "TECHNICAL_DISTINCTION",
    reason: "missing_distinction",
    why: "The post treats retries as a reliability mechanism, but does not distinguish retry success from durability of the write.",
    specificity: 90,
    requiredTokens: ["retry", "durability", "acknowledged"],
    topics: ["Resilience", "Distributed Systems"],
    angle: "reliability vs durability",
    concepts: ["reliability", "durability", "acknowledgment"],
    conceptA: "reliability",
    conceptB: "durability",
    distinction:
      "Retries improve the chance a request eventually succeeds. Durability is whether the write survives a crash after it was acknowledged.",
    implication:
      "A successful retry can still leave you with a lost write if the store never acknowledged it.",
  },
  {
    id: "distinction:retry-vs-recovery",
    mode: "TECHNICAL_DISTINCTION",
    reason: "missing_distinction",
    why: "The post treats retry policy as if it were a recovery strategy.",
    specificity: 86,
    requiredTokens: ["retry policy", "recovery"],
    topics: ["Resilience"],
    angle: "retry policy vs recovery strategy",
    concepts: ["retry-policy", "recovery-strategy", "failure-ownership"],
    conceptA: "retry policy",
    conceptB: "recovery strategy",
    distinction:
      "A retry policy repeats the same call. Recovery decides what happens after retries are exhausted — compensate, park, or hand ownership to an operator.",
    implication:
      "Once retries cross a process or team boundary, failure handling becomes an architectural concern rather than an implementation detail.",
  },
  {
    id: "distinction:delivery-vs-processing",
    mode: "TECHNICAL_DISTINCTION",
    reason: "missing_distinction",
    why: "The post conflates broker delivery semantics with processing semantics.",
    specificity: 84,
    requiredTokens: ["delivery", "processing", "side-effect"],
    topics: ["Messaging", "Distributed Systems"],
    angle: "delivery semantics vs processing semantics",
    concepts: ["delivery-semantics", "processing-semantics"],
    conceptA: "delivery semantics",
    conceptB: "processing semantics",
    distinction:
      "The broker can promise at-least-once delivery. It cannot promise that your handler's side-effects ran once.",
    implication: "Processing guarantees live in the consumer, not in the transport setting.",
  },
  {
    id: "distinction:availability-vs-resilience",
    mode: "TECHNICAL_DISTINCTION",
    reason: "missing_distinction",
    why: "The post uses availability and resilience as if they were the same property.",
    specificity: 76,
    requiredTokens: ["availability", "resilience"],
    topics: ["Resilience", "Cloud Architecture"],
    angle: "availability vs resilience",
    concepts: ["availability", "resilience"],
    conceptA: "availability",
    conceptB: "resilience",
    distinction:
      "Availability is whether the system answers now. Resilience is whether it still does the right thing after a dependency fails.",
    implication: "A 99.9% endpoint that returns stale or partial work is available and still wrong.",
  },
  {
    id: "distinction:scale-vs-performance",
    mode: "TECHNICAL_DISTINCTION",
    reason: "missing_distinction",
    why: "The post treats adding capacity as the same problem as making a single request faster.",
    specificity: 74,
    requiredTokens: ["scale", "latency", "hot path"],
    topics: ["Cloud Architecture", "APIs"],
    angle: "scaling vs performance",
    concepts: ["scaling", "performance", "hot-path"],
    conceptA: "scaling",
    conceptB: "performance",
    distinction:
      "Scaling is about more concurrent work. Performance is about the cost of one unit of work.",
    implication: "Replicas will not shrink a synchronous hot path that still does ten sequential I/O calls.",
  },
];

const MISSING_NUANCES: readonly KnowledgeMatch[] = [
  {
    id: "nuance:retries-need-budget",
    mode: "ADD_ONE_INSIGHT",
    reason: "missing_nuance",
    why: "The post is right that retries help with transient faults, but it leaves out the conditions that keep retries from amplifying failure.",
    specificity: 82,
    requiredTokens: ["idempotency", "backoff", "retry budget"],
    topics: ["Resilience", "APIs"],
    angle: "retry amplification",
    concepts: ["retry-amplification", "retry-budget", "backoff"],
    observation: "Retries can hide a transient blip.",
    insight:
      "Without an idempotency key, a budget, and backoff, the same policy that helps one caller can amplify load into an outage.",
    implication: "The useful question is what the system does when every client retries at once.",
  },
  {
    id: "nuance:cache-invalidation",
    mode: "ADD_ONE_INSIGHT",
    reason: "missing_nuance",
    why: "The post recommends caching as a speed fix without naming invalidation as the actual design problem.",
    specificity: 70,
    requiredTokens: ["cache", "invalidation"],
    topics: ["APIs", "Software Architecture"],
    angle: "cache invalidation ownership",
    concepts: ["cache-invalidation", "source-of-truth"],
    observation: "A cache can take pressure off a hot read path.",
    insight:
      "The hard part is not storing the value — it is deciding who owns invalidation when the write happens on another path.",
    implication: "If that owner is unclear, the cache becomes a second source of truth.",
  },
  {
    id: "nuance:async-failure",
    mode: "ADD_ONE_INSIGHT",
    reason: "missing_nuance",
    why: "The post treats going asynchronous as if it removed the failure-handling problem.",
    specificity: 68,
    requiredTokens: ["asynchronous", "failure", "owner"],
    topics: ["Event-Driven Architecture", "Messaging"],
    angle: "delayed failure ownership",
    concepts: ["delayed-failure", "failure-ownership"],
    observation: "Moving work off the request thread can protect the caller.",
    insight:
      "The failure still exists — it just happens later, when the original caller is no longer there to see it.",
    implication: "Someone still has to own the delayed failure, or it becomes silent data loss.",
  },
  {
    id: "nuance:retry-idempotency",
    mode: "ADD_ONE_INSIGHT",
    reason: "missing_nuance",
    why: "The post talks about retries without treating duplicate side-effects as the actual risk.",
    specificity: 75,
    requiredTokens: ["idempotency", "side-effect"],
    topics: ["Resilience", "APIs"],
    angle: "idempotency",
    concepts: ["idempotency", "duplicate-side-effects"],
    observation: "Retries can hide a transient blip.",
    insight:
      "A successful retry that repeats a side-effect is not recovery — it is a duplicate business action.",
    implication: "The missing control is idempotency, not a wider retry window.",
  },
  {
    id: "nuance:poison-message",
    mode: "ADD_ONE_INSIGHT",
    reason: "missing_nuance",
    why: "The post treats more retries as progress, but the useful idea is what happens to a message that can never succeed.",
    specificity: 77,
    requiredTokens: ["poison", "dead-letter"],
    topics: ["Messaging", "Resilience"],
    angle: "poison-message handling",
    concepts: ["poison-message", "dead-letter"],
    observation: "Retry count can look healthy while work is still lost.",
    insight:
      "A message that can never succeed just becomes repeated load until something parks it.",
    implication: "Dead-letter depth is the useful signal, not a wider delivery count.",
  },
  {
    id: "nuance:failure-ownership",
    mode: "ADD_ONE_INSIGHT",
    reason: "missing_nuance",
    why: "The post stays inside the retry mechanism and never asks who owns the failure after retries stop helping.",
    specificity: 70,
    requiredTokens: ["ownership", "failure"],
    topics: ["Resilience", "Software Architecture"],
    angle: "ownership of failure",
    concepts: ["failure-ownership", "retry-boundary"],
    observation: "A retry policy can only repeat the same call.",
    insight:
      "Once retries cross a process or team boundary, the interesting question is who owns the failure, not how many times the caller tries.",
    implication: "Without that owner, exhausted retries become silent loss.",
  },
];

const UNDERSPECIFIED: readonly KnowledgeMatch[] = [
  {
    id: "question:scale-bottleneck",
    mode: "ASK_BETTER_QUESTION",
    reason: "useful_question",
    why: "The post jumps to adding instances without naming the bottleneck that extra replicas would actually move.",
    specificity: 80,
    requiredTokens: ["instances", "bottleneck", "hot partition"],
    topics: ["APIs", "Cloud Architecture"],
    angle: "scale bottleneck",
    concepts: ["scale-bottleneck", "hot-partition"],
    question:
      "Before adding instances: is the ceiling CPU, downstream chatty I/O, or a hot partition in the data store? Extra replicas will not move a single-row lock.",
  },
  {
    id: "question:event-driven-why",
    mode: "ASK_BETTER_QUESTION",
    reason: "useful_question",
    why: "The post proposes event-driven architecture without saying which coupling or latency problem that would solve.",
    specificity: 64,
    requiredTokens: ["event-driven", "coupling", "latency"],
    topics: ["Event-Driven Architecture"],
    angle: "event-driven purpose",
    concepts: ["event-driven-purpose", "coupling", "ownership"],
    question:
      "Which problem is the event supposed to solve — a coupling problem, a latency problem, or an ownership problem? Those three designs do not look the same.",
  },
];

const DISCUSSIONS: readonly KnowledgeMatch[] = [
  {
    id: "discuss:orchestration-choreography",
    mode: "OPEN_DISCUSSION",
    reason: "open_angle",
    why: "The shift from request/reply to events is a real architectural discussion, and the missing angle is where compensation still needs an owner.",
    specificity: 85,
    requiredTokens: ["workflow", "compensating", "orchestration"],
    topics: ["Event-Driven Architecture", "Software Architecture"],
    angle: "compensation vs choreography",
    concepts: ["compensation", "orchestration", "choreography"],
    discussionAngle:
      "The hard part in that shift is usually not the broker. It is which decisions stay in a workflow and which become reactions to facts. Once a compensating action has to exist, you have an orchestration problem whether you still call it choreography or not.",
  },
  {
    id: "discuss:outbox",
    mode: "OPEN_DISCUSSION",
    reason: "open_angle",
    why: "Publishing after a database write is a strong topic; the useful angle is the atomicity seam between the write and the message.",
    specificity: 72,
    requiredTokens: ["outbox", "transaction", "publish"],
    topics: ["Messaging", "Event-Driven Architecture"],
    angle: "outbox atomicity",
    concepts: ["outbox", "write-publish-atomicity"],
    discussionAngle:
      "The interesting seam is not 'use a broker'. It is whether the state change and the published fact can fail independently. If they can, consumers will eventually see a world that never committed.",
  },
];

export const GENERIC_POST_MARKERS: readonly string[] = [
  "monday motivation",
  "grateful for my",
  "grateful for the",
  "leadership is about",
  "inspire others",
  "inspiring others",
  "amazing team",
  "never stop learning",
  "dream big",
  "hustle",
  "blessed to",
  "glass half",
  "so proud of this journey",
];

export const PURE_AGREEMENT_MARKERS: readonly string[] = [
  "so true",
  "great post",
  "thanks for sharing",
  "this is such an important",
  "important conversation",
  "couldn't agree more",
  "could not agree more",
  "this is so important",
  "love this",
];

export const TECHNICAL_MARKERS: readonly string[] = TOPIC_AREAS.flatMap((area) => area.markers);

const RETRY_MARKERS = ["retry", "retries", "retry policy"];
const DURABILITY_MARKERS = ["durable", "durability"];
const MICROSERVICE_ALWAYS_MARKERS = ["microservices are always", "if you're still on a monolith", "if you are still on a monolith"];
const SCALE_INSTANCES_MARKERS = ["add more instances", "adding instances", "add instances"];
const KAFKA_EXACTLY_ONCE_MARKERS = ["exactly-once", "exactly once"];
const ORCH_MARKERS = ["orchestration", "choreography"];
const CACHE_MARKERS = ["cache", "caching"];
const EVENT_DECOUPLE_MARKERS = ["events automatically", "event-driven means decoupled", "events mean we are decoupled"];

export function detectTopicAreas(text: string): string[] {
  const hits: string[] = [];
  for (const area of TOPIC_AREAS) {
    if (hasAnyMarker(text, area.markers) && !hits.includes(area.expertise)) {
      hits.push(area.expertise);
    }
  }
  return hits;
}

export function isGenericInspirationalPost(text: string): boolean {
  if (hasAnyMarker(text, TECHNICAL_MARKERS)) return false;
  return hasAnyMarker(text, GENERIC_POST_MARKERS);
}

export function isPureAgreementPost(text: string): boolean {
  if (hasAnyMarker(text, TECHNICAL_MARKERS)) return false;
  return hasAnyMarker(text, PURE_AGREEMENT_MARKERS);
}

export function hasTechnicalSubstance(text: string): boolean {
  return hasAnyMarker(text, TECHNICAL_MARKERS);
}

function matchesIncorrectClaim(text: string, entry: KnowledgeMatch): boolean {
  if (entry.id === "claim:kafka-exactly-once-no-idempotency") {
    return (
      hasAnyMarker(text, ["kafka"]) &&
      hasAnyMarker(text, KAFKA_EXACTLY_ONCE_MARKERS) &&
      hasAnyMarker(text, ["idempotent", "idempotency"]) &&
      hasAnyMarker(text, ["don't need", "do not need", "don't need idempotent", "no need"])
    );
  }
  if (entry.id === "claim:http-is-reliable-transport") {
    return (
      hasAnyMarker(text, ["http", "rest"]) &&
      hasAnyMarker(text, ["reliable", "always succeeds", "guarantees delivery"]) &&
      missingAllMarkers(text, ["timeout", "idempoten"])
    );
  }
  return false;
}

function matchesAssumption(text: string, entry: KnowledgeMatch): boolean {
  if (entry.id === "assumption:microservices-always") {
    return (
      hasAnyMarker(text, ["microservice"]) &&
      (hasAnyMarker(text, MICROSERVICE_ALWAYS_MARKERS) ||
        (hasAnyMarker(text, ["always the right", "always better"]) && hasAnyMarker(text, ["monolith"])))
    );
  }
  if (entry.id === "assumption:events-equal-decoupling") {
    return hasAnyMarker(text, EVENT_DECOUPLE_MARKERS) || (
      hasAnyMarker(text, ["event"]) &&
      hasAllMarkers(text, ["decoupl"]) &&
      hasAnyMarker(text, ["automatically", "just publish", "simply publish"])
    );
  }
  return false;
}

function matchesDistinction(text: string, entry: KnowledgeMatch): boolean {
  if (entry.id === "distinction:reliability-vs-durability") {
    return (
      hasAnyMarker(text, RETRY_MARKERS) &&
      hasAnyMarker(text, DURABILITY_MARKERS) &&
      missingAllMarkers(text, ["acknowledged", "acknowledgment", "ack"])
    );
  }
  if (entry.id === "distinction:retry-vs-recovery") {
    return (
      hasAnyMarker(text, RETRY_MARKERS) &&
      hasAnyMarker(text, ["until it succeeds", "retry until", "recover", "recovery"]) &&
      missingAllMarkers(text, DURABILITY_MARKERS) &&
      missingAllMarkers(text, ["dead-letter", "dlq", "compensate"])
    );
  }
  if (entry.id === "distinction:delivery-vs-processing") {
    return (
      hasAnyMarker(text, ["at-least-once", "at least once", "exactly-once", "exactly once", "delivery"]) &&
      hasAnyMarker(text, ["consumer", "handler", "processing"]) &&
      missingAllMarkers(text, ["side-effect", "side effect", "idempoten"])
    );
  }
  if (entry.id === "distinction:availability-vs-resilience") {
    return hasAnyMarker(text, ["availability"]) && hasAnyMarker(text, ["resilience", "resilient"]);
  }
  if (entry.id === "distinction:scale-vs-performance") {
    return (
      hasAnyMarker(text, ["scale", "scaling"]) &&
      hasAnyMarker(text, ["faster", "performance", "latency"]) &&
      missingAllMarkers(text, ["hot path", "hot partition"])
    );
  }
  return false;
}

function matchesMissingNuance(text: string, entry: KnowledgeMatch): boolean {
  if (entry.id === "nuance:retries-need-budget") {
    return (
      hasAnyMarker(text, RETRY_MARKERS) &&
      hasAnyMarker(text, ["reliab", "every downstream", "around every"]) &&
      missingAllMarkers(text, DURABILITY_MARKERS) &&
      missingAllMarkers(text, ["idempoten", "backoff", "retry budget", "jitter"])
    );
  }
  if (entry.id === "nuance:cache-invalidation") {
    return (
      hasAnyMarker(text, CACHE_MARKERS) &&
      hasAnyMarker(text, ["faster", "performance", "speed", "just add"]) &&
      missingAllMarkers(text, ["invalidat", "ttl", "evict"])
    );
  }
  if (entry.id === "nuance:async-failure") {
    return (
      hasAnyMarker(text, ["async", "asynchronous", "background job"]) &&
      hasAnyMarker(text, ["just move", "simply move", "no longer fail", "won't fail"]) &&
      missingAllMarkers(text, ["dead-letter", "dlq", "compensate"])
    );
  }
  if (entry.id === "nuance:retry-idempotency") {
    return (
      hasAnyMarker(text, RETRY_MARKERS) &&
      hasAnyMarker(text, ["reliab", "every downstream", "around every", "retry storm"]) &&
      missingAllMarkers(text, ["idempoten"])
    );
  }
  if (entry.id === "nuance:poison-message") {
    return (
      hasAnyMarker(text, RETRY_MARKERS) &&
      hasAnyMarker(text, ["dead-letter", "dlq", "poison", "lose orders", "delivery count"])
    );
  }
  if (entry.id === "nuance:failure-ownership") {
    return (
      hasAnyMarker(text, RETRY_MARKERS) &&
      hasAnyMarker(text, ["handler", "lock", "storm", "downstream", "ownership"]) &&
      missingAllMarkers(text, DURABILITY_MARKERS)
    );
  }
  return false;
}

function matchesUnderspecified(text: string, entry: KnowledgeMatch): boolean {
  if (entry.id === "question:scale-bottleneck") {
    return (
      hasAnyMarker(text, ["scale", "scaling"]) &&
      hasAnyMarker(text, SCALE_INSTANCES_MARKERS) &&
      missingAllMarkers(text, ["bottleneck", "cpu", "hot partition", "lock"])
    );
  }
  if (entry.id === "question:event-driven-why") {
    return (
      hasAnyMarker(text, ["event-driven", "event driven", "let's go event"]) &&
      missingAllMarkers(text, ORCH_MARKERS) &&
      missingAllMarkers(text, ["outbox", "coupling", "ownership"]) &&
      text.length < 280
    );
  }
  return false;
}

function matchesDiscussion(text: string, entry: KnowledgeMatch): boolean {
  if (entry.id === "discuss:orchestration-choreography") {
    return (
      hasAnyMarker(text, ["request/reply", "request-reply", "request reply"]) &&
      hasAnyMarker(text, ["event"]) &&
      hasAnyMarker(text, ORCH_MARKERS)
    );
  }
  if (entry.id === "discuss:outbox") {
    return hasAnyMarker(text, ["outbox"]) || (
      hasAnyMarker(text, ["publish"]) &&
      hasAnyMarker(text, ["database", "db write", "after commit"]) &&
      hasAnyMarker(text, ["event", "message"])
    );
  }
  return false;
}

export function matchKnowledge(text: string): KnowledgeMatch[] {
  const matches: KnowledgeMatch[] = [];

  for (const entry of INCORRECT_CLAIMS) {
    if (matchesIncorrectClaim(text, entry)) matches.push(entry);
  }
  for (const entry of ASSUMPTIONS) {
    if (matchesAssumption(text, entry)) matches.push(entry);
  }
  for (const entry of DISTINCTIONS) {
    if (matchesDistinction(text, entry)) matches.push(entry);
  }
  for (const entry of MISSING_NUANCES) {
    if (matchesMissingNuance(text, entry)) matches.push(entry);
  }
  for (const entry of UNDERSPECIFIED) {
    if (matchesUnderspecified(text, entry)) matches.push(entry);
  }
  for (const entry of DISCUSSIONS) {
    if (matchesDiscussion(text, entry)) matches.push(entry);
  }

  return matches;
}
