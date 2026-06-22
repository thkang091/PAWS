/**
 * Fixed-capacity ring buffer for PoseFrame objects.
 *
 * When the buffer is full, new frames overwrite the oldest frames.
 * This bounds memory use regardless of recording length.
 *
 * Thread-safety: JavaScript is single-threaded so no locking is needed.
 * However, callers must not call push() during iteration of toArray().
 */

import type { PoseFrame } from "@/types/onDevicePose";

export class PoseRingBuffer {
  private readonly _capacity: number;
  private readonly _buffer: (PoseFrame | undefined)[];
  private _head: number = 0;   // next write position
  private _size: number = 0;   // current number of valid frames
  private _totalPushed: number = 0;
  private _droppedCount: number = 0;

  constructor(capacity: number) {
    if (capacity < 1) throw new RangeError("PoseRingBuffer capacity must be >= 1");
    this._capacity = capacity;
    this._buffer = new Array<PoseFrame | undefined>(capacity).fill(undefined);
  }

  /**
   * Append a frame. If the buffer is at capacity, the oldest frame is
   * silently overwritten and `droppedCount` is incremented.
   */
  push(frame: PoseFrame): void {
    if (this._size === this._capacity) {
      // About to overwrite the oldest frame.
      this._droppedCount++;
    } else {
      this._size++;
    }
    this._buffer[this._head] = frame;
    this._head = (this._head + 1) % this._capacity;
    this._totalPushed++;
  }

  /**
   * Return all frames in insertion order (oldest first).
   * Returns a new array; safe to hold across further push() calls.
   */
  toArray(): PoseFrame[] {
    if (this._size === 0) return [];

    const result: PoseFrame[] = new Array(this._size);
    const start = this._size < this._capacity
      ? 0
      : this._head;   // head points to oldest when full

    for (let i = 0; i < this._size; i++) {
      result[i] = this._buffer[(start + i) % this._capacity] as PoseFrame;
    }
    return result;
  }

  /** Remove all frames and reset counters. */
  clear(): void {
    this._buffer.fill(undefined);
    this._head = 0;
    this._size = 0;
    this._totalPushed = 0;
    this._droppedCount = 0;
  }

  /** Current number of frames stored. */
  get size(): number {
    return this._size;
  }

  /** Maximum number of frames storable. */
  get capacity(): number {
    return this._capacity;
  }

  /** Total frames ever pushed (including those that were overwritten). */
  get totalPushed(): number {
    return this._totalPushed;
  }

  /**
   * Number of frames that were overwritten due to a full buffer.
   * These represent dropped frames from the recording.
   */
  get droppedCount(): number {
    return this._droppedCount;
  }

  /**
   * Fraction of pushed frames that were dropped.
   * Returns 0 when nothing has been pushed.
   */
  get droppedRate(): number {
    if (this._totalPushed === 0) return 0;
    return this._droppedCount / this._totalPushed;
  }

  /** True when the buffer contains no frames. */
  get isEmpty(): boolean {
    return this._size === 0;
  }

  /** True when the buffer is at capacity. */
  get isFull(): boolean {
    return this._size === this._capacity;
  }
}
