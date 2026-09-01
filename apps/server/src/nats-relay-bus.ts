import { Kvm } from "@nats-io/kv";
import {
  AckPolicy,
  DeliverPolicy,
  RetentionPolicy,
  StorageType,
  jetstream,
  jetstreamManager,
  type JetStreamClient,
  type JetStreamManager,
} from "@nats-io/jetstream";
import { connect, nanos, type NatsConnection } from "@nats-io/transport-node";
import type { KV } from "@nats-io/kv";
import type {
  RelayBus,
  RelayDelivery,
  RelayEvent,
  RelaySession,
  RelayStateRecord,
  RelayTurn,
} from "./relay-types.js";

const STREAM_NAME = "AGENT_RELAY";
const CONSUMER_NAME = "relay_coordinator";
const STATE_BUCKET = "agent_relay_state";
const TURN_SUBJECT = "agentrelay.turn";
const EVENT_SUBJECT_PREFIX = "agentrelay.event";
const SESSION_KEY_PREFIX = "session.";
const encoder = new TextEncoder();

export interface NatsRelayBusOptions {
  servers: string;
  ackWaitMs: number;
  maxDeliver: number;
}

function encodeJson(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}

function isMissingResource(error: unknown): boolean {
  const text = String(error).toLowerCase();
  return text.includes("not found") || text.includes("does not exist");
}

export class NatsRelayBus implements RelayBus {
  private connection: NatsConnection | null = null;
  private js: JetStreamClient | null = null;
  private manager: JetStreamManager | null = null;
  private state: KV | null = null;

  constructor(private readonly options: NatsRelayBusOptions) {}

  async initialize(): Promise<void> {
    if (this.connection) return;
    const connection = await connect({ servers: this.options.servers });
    try {
      const js = jetstream(connection);
      const manager = await jetstreamManager(connection);

      try {
        await manager.streams.info(STREAM_NAME);
      } catch (error) {
        if (!isMissingResource(error)) throw error;
        await manager.streams.add({
          name: STREAM_NAME,
          subjects: ["agentrelay.>"],
          retention: RetentionPolicy.Limits,
          storage: StorageType.File,
          duplicate_window: nanos(120_000),
        });
      }

      try {
        await manager.consumers.info(STREAM_NAME, CONSUMER_NAME);
      } catch (error) {
        if (!isMissingResource(error)) throw error;
        await manager.consumers.add(STREAM_NAME, {
          durable_name: CONSUMER_NAME,
          name: CONSUMER_NAME,
          filter_subject: TURN_SUBJECT,
          ack_policy: AckPolicy.Explicit,
          ack_wait: nanos(this.options.ackWaitMs),
          max_deliver: this.options.maxDeliver,
          deliver_policy: DeliverPolicy.All,
        });
      }

      const state = await new Kvm(connection).create(STATE_BUCKET, {
        history: 10,
        storage: StorageType.File,
      });

      this.connection = connection;
      this.js = js;
      this.manager = manager;
      this.state = state;
    } catch (error) {
      await connection.close();
      throw error;
    }
  }

  async close(): Promise<void> {
    const connection = this.connection;
    this.connection = null;
    this.js = null;
    this.manager = null;
    this.state = null;
    if (connection) await connection.close();
  }

  async createSession(session: RelaySession): Promise<void> {
    await this.requireState().create(this.sessionKey(session.id), encodeJson(session));
  }

  async getSession(sessionId: string): Promise<RelayStateRecord | null> {
    const entry = await this.requireState().get(this.sessionKey(sessionId));
    if (!entry) return null;
    return { session: entry.json<RelaySession>(), revision: entry.revision };
  }

  async listSessions(): Promise<RelaySession[]> {
    const uniqueKeys = new Set<string>();
    const keys = await this.requireState().keys(`${SESSION_KEY_PREFIX}*`);
    for await (const key of keys) {
      uniqueKeys.add(key);
    }
    const sessions = new Map<string, RelaySession>();
    for (const key of uniqueKeys) {
      const entry = await this.requireState().get(key);
      if (entry) {
        const session = entry.json<RelaySession>();
        const current = sessions.get(session.id);
        if (!current || session.updatedAt.localeCompare(current.updatedAt) >= 0) {
          sessions.set(session.id, session);
        }
      }
    }
    return [...sessions.values()].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }

  async updateSession(
    sessionId: string,
    revision: number,
    session: RelaySession,
  ): Promise<number> {
    return await this.requireState().update(
      this.sessionKey(sessionId),
      encodeJson(session),
      revision,
    );
  }

  async publishTurn(turn: RelayTurn): Promise<{ duplicate: boolean }> {
    const acknowledgement = await this.requireJetStream().publish(
      TURN_SUBJECT,
      encodeJson(turn),
      { msgID: turn.id },
    );
    return { duplicate: acknowledgement.duplicate };
  }

  async publishEvent(event: RelayEvent): Promise<{ duplicate: boolean }> {
    const acknowledgement = await this.requireJetStream().publish(
      `${EVENT_SUBJECT_PREFIX}.${event.sessionId}`,
      encodeJson(event),
      { msgID: event.id },
    );
    return { duplicate: acknowledgement.duplicate };
  }

  async nextTurn(expiresMs: number): Promise<RelayDelivery | null> {
    const consumer = await this.requireJetStream().consumers.get(
      STREAM_NAME,
      CONSUMER_NAME,
    );
    const message = await consumer.next({ expires: Math.max(1_000, expiresMs) });
    if (!message) return null;
    return {
      turn: message.json<RelayTurn>(),
      deliveryCount: message.info.deliveryCount,
      extendLease: () => message.working(),
      acknowledge: async () => {
        await message.ackAck();
      },
      retry: (delayMs) => message.nak(delayMs),
      terminate: (reason) => message.term(reason),
    };
  }

  private sessionKey(sessionId: string): string {
    return `${SESSION_KEY_PREFIX}${sessionId}`;
  }

  private requireJetStream(): JetStreamClient {
    if (!this.js) throw new Error("Relay bus is not initialized");
    return this.js;
  }

  private requireState(): KV {
    if (!this.state) throw new Error("Relay bus is not initialized");
    return this.state;
  }
}
