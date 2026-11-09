import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import {
  createDuelRequestId, DuelRoomApi, duelErrorCode, duelErrorMessage, duelStateFromSnapshot, normalizeDuelCode,
  type DuelRoomOperation, type DuelRoomSnapshot,
} from "./duelRoomApi";

type RoomApi = Pick<DuelRoomApi, "create" | "join" | "get" | "ready" | "select" | "start" | "heartbeat" | "reset" | "leave">;
type RoomStorage = Pick<typeof AsyncStorage, "getItem" | "setItem" | "removeItem">;
type RoomView = {
  userId: string | null;
  roomId: string | null;
  snapshot: DuelRoomSnapshot | null;
  connected: boolean;
  busy: boolean;
  operation: DuelRoomOperation | null;
  restoring: boolean;
  error: string | null;
  now: number;
};
const emptyView = (userId: string | null): RoomView => ({
  userId, roomId: null, snapshot: null, connected: true, busy: false, operation: null,
  restoring: !!userId, error: null, now: Date.now(),
});
const roomStorageKey = (userId: string) => `paws:duel:active_room:${userId}`;
const pendingStorageKey = (userId: string) => `paws:duel:pending_create:${userId}`;
const pendingJoinKey = (userId: string) => `paws:duel:pending_join:${userId}`;
const isUuid = (value: string | null | undefined): value is string => !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const isMissingRoom = (error: unknown) => ["DUEL_ROOM_NOT_FOUND", "DUEL_ROOM_CLOSED"].includes(duelErrorCode(error) ?? "");

/** Network state owner; injected dependencies also let tests exercise response races. */
export class DuelRoomController {
  private view: RoomView;
  private epoch = 0;
  private disposed = false;
  private active = true;
  private mutation: symbol | null = null;
  private refreshFlight: Promise<boolean> | null = null;
  private recoveryRequired = false;
  private pendingCreate: { dogId: string; requestId: string } | null = null;
  private pendingJoin: { dogId: string; code: string } | null = null;
  private storageWrites: Promise<void> = Promise.resolve();

  constructor(
    readonly userId: string,
    private readonly api: RoomApi,
    private readonly storage: RoomStorage,
    private readonly onChange: (view: RoomView) => void,
    private readonly newRequestId = createDuelRequestId,
  ) { this.view = emptyView(userId); }

  get current(): RoomView { return this.view; }
  private valid(epoch: number): boolean { return !this.disposed && epoch === this.epoch; }
  private publish(update: Partial<RoomView>): void {
    if (this.disposed) return;
    this.view = { ...this.view, ...update, now: Date.now() };
    this.onChange(this.view);
  }

  clearError(): void { this.publish({ error: null }); }

  private writeStorage(action: () => Promise<void>, epoch: number): Promise<void> {
    // A queued old set can never run after the acknowledged leave's removal.
    this.storageWrites = this.storageWrites.catch(() => undefined).then(async () => {
      if (!this.valid(epoch)) return;
      await action();
    }).catch(() => undefined);
    return this.storageWrites;
  }

  private persist(roomId: string | null, epoch: number): Promise<void> {
    return this.writeStorage(() => roomId ? this.storage.setItem(roomStorageKey(this.userId), roomId)
      : this.storage.removeItem(roomStorageKey(this.userId)), epoch);
  }

  private persistCreate(value: { dogId: string; requestId: string } | null, epoch: number): Promise<void> {
    return this.writeStorage(() => value ? this.storage.setItem(pendingStorageKey(this.userId), JSON.stringify(value))
      : this.storage.removeItem(pendingStorageKey(this.userId)), epoch);
  }

  private persistJoin(value: { dogId: string; code: string } | null, epoch: number): Promise<void> {
    return this.writeStorage(() => value ? this.storage.setItem(pendingJoinKey(this.userId), JSON.stringify(value))
      : this.storage.removeItem(pendingJoinKey(this.userId)), epoch);
  }

  private async clearRoom(message: string | null): Promise<void> {
    const epoch = ++this.epoch;
    this.pendingCreate = null;
    this.pendingJoin = null;
    this.mutation = null;
    this.recoveryRequired = false;
    this.publish({ roomId: null, snapshot: null, connected: true, restoring: false, busy: false, operation: null, error: message });
    await this.persist(null, epoch);
    await this.persistCreate(null, epoch);
    await this.persistJoin(null, epoch);
  }

  private async accept(next: DuelRoomSnapshot, epoch: number, expectedRoomId: string | null, readyCleared = false): Promise<boolean> {
    if (!this.valid(epoch)) return false;
    if (next.meUserId !== this.userId || (expectedRoomId && next.room.id !== expectedRoomId)
      || (this.view.roomId && next.room.id !== this.view.roomId)) {
      throw new Error("DUEL_INVALID_REQUEST");
    }
    const previous = this.view.snapshot;
    if (previous?.room.id === next.room.id && next.room.revision < previous.room.revision) return false;
    if (next.room.phase === "closed") {
      await this.clearRoom("The host left this room. Create or join another game.");
      return false;
    }
    // A disconnect can occur while a mutation is in flight, not only during a
    // poll. Reconcile every incoming non-playing snapshot before exposing it.
    if (this.recoveryRequired && !readyCleared && next.room.phase !== "playing") {
      return this.accept(await this.api.ready(next.room.id, false), epoch, next.room.id, true);
    }
    const newlyBound = !this.view.roomId;
    this.recoveryRequired = !this.active && next.room.phase !== "playing";
    this.publish({ roomId: next.room.id, snapshot: next, connected: this.active, error: null });
    if (newlyBound) await this.persist(next.room.id, epoch);
    return this.valid(epoch);
  }

  connectionLost(): void {
    if (!this.view.roomId || this.disposed) return;
    this.recoveryRequired ||= this.view.snapshot?.room.phase !== "playing";
    this.publish({ connected: false });
  }

  private async failed(error: unknown, epoch: number, clearMissing: boolean): Promise<void> {
    if (!this.valid(epoch)) return;
    if (clearMissing && isMissingRoom(error)) {
      await this.clearRoom(duelErrorMessage(error));
      return;
    }
    if (!duelErrorCode(error) && this.view.roomId) this.connectionLost();
    this.publish({ error: duelErrorMessage(error) });
  }

  private async read(roomId: string, epoch: number, heartbeat: boolean): Promise<boolean> {
    const next = await (heartbeat && this.active ? this.api.heartbeat(roomId) : this.api.get(roomId));
    if (!this.valid(epoch) || this.view.roomId !== roomId) return false;
    if (next.meUserId !== this.userId || next.room.id !== roomId) throw new Error("DUEL_INVALID_REQUEST");
    return this.accept(next, epoch, roomId);
  }

  async restore(): Promise<boolean> {
    const epoch = this.epoch;
    const token = Symbol("restore");
    this.mutation = token;
    this.publish({ restoring: true, busy: true, operation: "restore" });
    try {
      const roomId = await this.storage.getItem(roomStorageKey(this.userId));
      if (!this.valid(epoch)) return false;
      if (!roomId) {
        const pending = await this.storage.getItem(pendingStorageKey(this.userId));
        if (!this.valid(epoch)) return false;
        if (!pending) {
          const pendingJoin = await this.storage.getItem(pendingJoinKey(this.userId));
          if (!this.valid(epoch)) return false;
          if (!pendingJoin) return true;
          let request: { dogId?: string; code?: string } | null = null;
          try { request = JSON.parse(pendingJoin) as { dogId?: string; code?: string }; } catch { /* Invalid local cache is discarded. */ }
          const code = typeof request?.code === "string" ? normalizeDuelCode(request.code) : null;
          if (!request || !isUuid(request.dogId) || !code) { await this.persistJoin(null, epoch); return false; }
          this.pendingJoin = { dogId: request.dogId, code };
          this.recoveryRequired = true;
          const accepted = await this.accept(await this.api.join(code, request.dogId), epoch, null);
          if (accepted) { this.pendingJoin = null; await this.persistJoin(null, epoch); }
          return accepted;
        }
        let request: { dogId?: string; requestId?: string } | null = null;
        try { request = JSON.parse(pending) as { dogId?: string; requestId?: string }; } catch { /* Invalid local cache is discarded. */ }
        if (!request || !isUuid(request.dogId) || !isUuid(request.requestId)) {
          await this.persistCreate(null, epoch);
          return false;
        }
        this.pendingCreate = { dogId: request.dogId, requestId: request.requestId };
        this.recoveryRequired = true;
        const accepted = await this.accept(await this.api.create(request.dogId, request.requestId), epoch, null);
        if (accepted) { this.pendingCreate = null; await this.persistCreate(null, epoch); }
        return accepted;
      }
      if (!isUuid(roomId)) { await this.persist(null, epoch); return false; }
      this.publish({ roomId, connected: false });
      this.recoveryRequired = true;
      return await this.read(roomId, epoch, true);
    } catch (error) {
      if (this.valid(epoch) && this.pendingCreate && duelErrorCode(error)) {
        this.pendingCreate = null;
        await this.persistCreate(null, epoch);
      }
      if (this.valid(epoch) && this.pendingJoin && duelErrorCode(error)) {
        this.pendingJoin = null;
        await this.persistJoin(null, epoch);
      }
      await this.failed(error, epoch, true);
      return false;
    } finally {
      if (this.valid(epoch) && this.mutation === token) {
        this.mutation = null;
        this.publish({ restoring: false, busy: false, operation: null });
      }
    }
  }

  refresh(heartbeat = false): Promise<boolean> {
    if (this.disposed || !this.active || !this.view.roomId || this.mutation) return Promise.resolve(false);
    if (this.refreshFlight) return this.refreshFlight;
    const epoch = this.epoch, roomId = this.view.roomId;
    const flight = (async () => {
      try { return await this.read(roomId, epoch, heartbeat); }
      catch (error) { await this.failed(error, epoch, true); return false; }
    })();
    this.refreshFlight = flight;
    void flight.finally(() => { if (this.refreshFlight === flight) this.refreshFlight = null; });
    return flight;
  }

  private async command(operation: DuelRoomOperation, action: (epoch: number) => Promise<boolean>): Promise<boolean> {
    if (this.disposed || this.mutation) return false;
    const epoch = this.epoch, token = Symbol(operation);
    this.mutation = token;
    this.publish({ busy: true, operation, error: null });
    try {
      // A poll can finish first, but no second mutation may overtake this one.
      await this.refreshFlight;
      if (!this.valid(epoch)) return false;
      return await action(epoch);
    } catch (error) {
      await this.failed(error, epoch, operation !== "create" && operation !== "join" && operation !== "leave");
      return false;
    } finally {
      if (this.valid(epoch) && this.mutation === token) {
        this.mutation = null;
        this.publish({ busy: false, operation: null });
        if (this.active && this.recoveryRequired) void this.refresh(true);
      }
    }
  }

  private validDog(dogId: string | null | undefined): dogId is string {
    if (isUuid(dogId)) return true;
    this.publish({ error: "Add your dog’s profile before joining a game." });
    return false;
  }

  create(dogId?: string | null): Promise<boolean> {
    if (!this.validDog(dogId)) return Promise.resolve(false);
    if (this.view.roomId) { this.publish({ error: "Leave your current room before creating another game." }); return Promise.resolve(false); }
    if (this.pendingJoin) { this.publish({ error: "Retry joining your current game first." }); return Promise.resolve(false); }
    return this.command("create", async epoch => {
      if (this.pendingCreate && this.pendingCreate.dogId !== dogId) {
        this.publish({ error: "Retry your current room request before changing dogs." });
        return false;
      }
      this.pendingCreate ??= { dogId, requestId: this.newRequestId() };
      try {
        await this.persistCreate(this.pendingCreate, epoch);
        if (!this.valid(epoch)) return false;
        const next = await this.api.create(dogId, this.pendingCreate.requestId);
        const accepted = await this.accept(next, epoch, null);
        if (accepted) { this.pendingCreate = null; await this.persistCreate(null, epoch); }
        return accepted;
      } catch (error) {
        if (this.valid(epoch) && duelErrorCode(error)) {
          this.pendingCreate = null;
          await this.persistCreate(null, epoch);
        }
        throw error;
      }
    });
  }

  join(code: string, dogId?: string | null): Promise<boolean> {
    if (!this.validDog(dogId)) return Promise.resolve(false);
    const normalized = normalizeDuelCode(code);
    if (!normalized) { this.publish({ error: "Enter a 6-character game code." }); return Promise.resolve(false); }
    if (this.view.roomId) { this.publish({ error: "Leave your current room before joining another game." }); return Promise.resolve(false); }
    if (this.pendingCreate) { this.publish({ error: "Retry creating your current game first." }); return Promise.resolve(false); }
    return this.command("join", async epoch => {
      if (this.pendingJoin && (this.pendingJoin.dogId !== dogId || this.pendingJoin.code !== normalized)) {
        this.publish({ error: "Retry joining your current game before changing the code." });
        return false;
      }
      this.pendingJoin = { dogId, code: normalized };
      try {
        await this.persistJoin(this.pendingJoin, epoch);
        if (!this.valid(epoch)) return false;
        const accepted = await this.accept(await this.api.join(normalized, dogId), epoch, null);
        if (accepted) { this.pendingJoin = null; await this.persistJoin(null, epoch); }
        return accepted;
      } catch (error) {
        if (this.valid(epoch) && duelErrorCode(error)) { this.pendingJoin = null; await this.persistJoin(null, epoch); }
        throw error;
      }
    });
  }

  private roomCommand(operation: DuelRoomOperation, action: (roomId: string) => Promise<DuelRoomSnapshot>, readyCleared = false): Promise<boolean> {
    const roomId = this.view.roomId;
    if (!roomId) return Promise.resolve(false);
    return this.command(operation, async epoch => {
      if (this.recoveryRequired) {
        await this.read(roomId, epoch, true);
        if (!this.valid(epoch) || this.view.roomId !== roomId) return false;
      }
      return this.accept(await action(roomId), epoch, roomId, readyCleared);
    });
  }

  ready(ready: boolean): Promise<boolean> { return this.roomCommand("ready", roomId => this.api.ready(roomId, ready), !ready); }
  select(): Promise<boolean> { return this.roomCommand("select", roomId => this.api.select(roomId)); }
  start(): Promise<boolean> { return this.roomCommand("start", roomId => this.api.start(roomId)); }
  resetRound(): Promise<boolean> { return this.roomCommand("reset", roomId => this.api.reset(roomId)); }

  leave(): Promise<boolean> {
    const roomId = this.view.roomId;
    if (!roomId) return Promise.resolve(false);
    return this.command("leave", async epoch => {
      await this.api.leave(roomId);
      if (!this.valid(epoch)) return false;
      await this.clearRoom(null);
      return true;
    });
  }

  retry(): Promise<boolean> {
    const roomId = this.view.roomId;
    if (!roomId) { this.clearError(); return Promise.resolve(false); }
    return this.command("retry", epoch => this.read(roomId, epoch, true));
  }

  setActive(active: boolean): void {
    if (this.disposed || this.active === active) return;
    this.active = active;
    if (!this.view.roomId) return;
    if (!active) {
      if (this.view.snapshot?.room.phase !== "playing") {
        this.connectionLost();
        // Best effort only; the foreground recovery path repeats this if busy
        // or offline, before restoring a selecting snapshot to the screen.
        const roomId = this.view.roomId;
        void this.command("ready", async epoch => this.accept(await this.api.ready(roomId, false), epoch, roomId, true));
      }
    } else {
      void this.refresh(true);
    }
  }

  dispose(): void { this.disposed = true; this.epoch += 1; this.mutation = null; }
}

export function useDuelRoom() {
  const { user, isLoading } = useAuth();
  const userId = user?.id ?? null;
  const client = getSupabaseClient();
  const controller = useRef<DuelRoomController | null>(null);
  const currentUserId = useRef(userId);
  currentUserId.current = userId;
  const [view, setView] = useState<RoomView>(() => emptyView(null));

  useEffect(() => {
    if (!userId || !client) { setView({ ...emptyView(userId), restoring: false }); return undefined; }
    const current = new DuelRoomController(userId, new DuelRoomApi(client), AsyncStorage, setView);
    controller.current = current;
    setView(current.current);
    current.setActive(AppState.currentState === "active");
    void current.restore();
    const stateListener = AppState.addEventListener("change", state => current.setActive(state === "active"));
    const poll = setInterval(() => { void current.refresh(); }, 3_000);
    const heartbeat = setInterval(() => { void current.refresh(true); }, 20_000);
    return () => {
      current.dispose();
      if (controller.current === current) controller.current = null;
      stateListener.remove(); clearInterval(poll); clearInterval(heartbeat);
    };
  }, [userId, client]);

  const roomId = view.userId === userId ? view.roomId : null;
  useEffect(() => {
    const current = controller.current;
    if (!userId || !client || !roomId || current?.userId !== userId) return undefined;
    let listening = true;
    // A channel join can precede PostgreSQL replication readiness. Wait for
    // that subscription before treating SUBSCRIBED as the recovery checkpoint.
    const channel = client.channel(`duel-room:${roomId}:${userId}`, {
      config: { postgres_changes_options: { wait: true, timeout: 15_000 } },
    })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "duel_rooms", filter: `id=eq.${roomId}` }, () => {
        if (listening) void current.refresh();
      })
      .subscribe(status => {
        if (!listening) return;
        if (status === "SUBSCRIBED") void current.refresh();
        else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) current.connectionLost();
      });
    return () => { listening = false; void client.removeChannel(channel); };
  }, [client, userId, roomId]);

  const withController = useCallback((action: (current: DuelRoomController) => Promise<boolean>): Promise<boolean> => {
    const current = controller.current;
    if (current && current.userId === currentUserId.current) return action(current);
    setView(previous => ({ ...previous, error: "Your session is still connecting. Try again." }));
    return Promise.resolve(false);
  }, []);
  const clearError = useCallback(() => {
    if (controller.current) controller.current.clearError();
    else setView(previous => ({ ...previous, error: null }));
  }, []);
  const create = useCallback((dogId?: string | null) => withController(current => current.create(dogId)), [withController]);
  const join = useCallback((code: string, dogId?: string | null) => withController(current => current.join(code, dogId)), [withController]);
  const ready = useCallback((value: boolean) => withController(current => current.ready(value)), [withController]);
  const select = useCallback(() => withController(current => current.select()), [withController]);
  const start = useCallback(() => withController(current => current.start()), [withController]);
  const leave = useCallback(() => withController(current => current.leave()), [withController]);
  const resetRound = useCallback(() => withController(current => current.resetRound()), [withController]);
  const retry = useCallback(() => withController(current => current.retry()), [withController]);
  const sameUser = view.userId === userId;
  const snapshot = sameUser && view.snapshot?.meUserId === userId ? view.snapshot : null;
  const restoring = isLoading || (!!userId && (!sameUser || view.restoring));
  return {
    snapshot,
    state: duelStateFromSnapshot(snapshot, sameUser && view.connected, view.now),
    busy: restoring || (sameUser && view.busy),
    operation: sameUser ? view.operation : null,
    restoring,
    error: sameUser ? view.error : null,
    clearError, create, join, ready, select, start, leave, resetRound, retry,
  };
}
