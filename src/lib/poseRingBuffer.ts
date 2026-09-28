import type { PoseFrame } from "@/types/onDevicePose";

export class PoseRingBuffer {
  private readonly _capacity: number;
  private readonly _buffer: (PoseFrame | undefined)[];
  private _head: number = 0;
  private _size: number = 0;
  private _totalPushed: number = 0;
  private _droppedCount: number = 0;

  constructor(capacity: number) {
    if (capacity < 1) throw new RangeError("PoseRingBuffer capacity must be >= 1");
    this._capacity = capacity;
    this._buffer = new Array<PoseFrame | undefined>(capacity).fill(undefined);
  }

  push(frame: PoseFrame): void {
    if (this._size === this._capacity) {
      this._droppedCount++;
    } else {
      this._size++;
    }
    this._buffer[this._head] = frame;
    this._head = (this._head + 1) % this._capacity;
    this._totalPushed++;
  }

  toArray(): PoseFrame[] {
    if (this._size === 0) return [];

    const result: PoseFrame[] = new Array(this._size);
    const start = this._size < this._capacity
      ? 0
      : this._head;

    for (let i = 0; i < this._size; i++) {
      result[i] = this._buffer[(start + i) % this._capacity] as PoseFrame;
    }
    return result;
  }

  clear(): void {
    this._buffer.fill(undefined);
    this._head = 0;
    this._size = 0;
    this._totalPushed = 0;
    this._droppedCount = 0;
  }

  get size(): number {
    return this._size;
  }

  get capacity(): number {
    return this._capacity;
  }

  get totalPushed(): number {
    return this._totalPushed;
  }

  get droppedCount(): number {
    return this._droppedCount;
  }

  get droppedRate(): number {
    if (this._totalPushed === 0) return 0;
    return this._droppedCount / this._totalPushed;
  }

  get isEmpty(): boolean {
    return this._size === 0;
  }

  get isFull(): boolean {
    return this._size === this._capacity;
  }
}
