import { createHash } from "node:crypto";
import type { RelayEvent } from "./relay-types.js";

export const RELAY_EVENT_GENESIS = "GENESIS";

function eventPayload(event: Omit<RelayEvent, "previousHash" | "eventHash">): string {
  return JSON.stringify({
    id: event.id,
    sessionId: event.sessionId,
    sequence: event.sequence,
    type: event.type,
    at: event.at,
    turnId: event.turnId,
    agentId: event.agentId,
    runId: event.runId ?? null,
    attempt: event.attempt,
    detail: event.detail,
    fromAgentId: event.fromAgentId ?? null,
    toAgentId: event.toAgentId ?? null,
  });
}

export function hashRelayEvent(
  event: Omit<RelayEvent, "previousHash" | "eventHash">,
  previousHash: string,
): string {
  return createHash("sha256")
    .update(previousHash)
    .update("\n")
    .update(eventPayload(event))
    .digest("hex");
}

export function verifyRelayEventChain(events: RelayEvent[]): {
  verified: boolean;
  completeFromGenesis: boolean;
  hashedEvents: number;
  totalEvents: number;
  head: string | null;
  firstInvalidSequence: number | null;
} {
  if (events.length === 0) {
    return {
      verified: true,
      completeFromGenesis: true,
      hashedEvents: 0,
      totalEvents: 0,
      head: null,
      firstInvalidSequence: null,
    };
  }

  let previousHash = events[0]?.previousHash ?? RELAY_EVENT_GENESIS;
  const completeFromGenesis = previousHash === RELAY_EVENT_GENESIS;
  let hashedEvents = 0;
  for (const event of events) {
    if (!event.previousHash || !event.eventHash) {
      return {
        verified: false,
        completeFromGenesis: false,
        hashedEvents,
        totalEvents: events.length,
        head: hashedEvents ? events[hashedEvents - 1]?.eventHash ?? null : null,
        firstInvalidSequence: event.sequence,
      };
    }
    const { previousHash: recordedPrevious, eventHash, ...payload } = event;
    const expectedHash = hashRelayEvent(payload, previousHash);
    if (recordedPrevious !== previousHash || eventHash !== expectedHash) {
      return {
        verified: false,
        completeFromGenesis,
        hashedEvents,
        totalEvents: events.length,
        head: hashedEvents ? events[hashedEvents - 1]?.eventHash ?? null : null,
        firstInvalidSequence: event.sequence,
      };
    }
    previousHash = eventHash;
    hashedEvents += 1;
  }

  return {
    verified: true,
    completeFromGenesis,
    hashedEvents,
    totalEvents: events.length,
    head: previousHash,
    firstInvalidSequence: null,
  };
}
