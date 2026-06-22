/**
 * Tests for PoseRingBuffer.
 */

import { PoseRingBuffer } from "@/lib/poseRingBuffer";
import type { PoseFrame } from "@/types/onDevicePose";

const makeFrame = (index: number, ts?: number): PoseFrame => ({
  frame_index: index,
  timestamp_ms: ts ?? index * 100,
  keypoints: {},
  confidence: 0.9,
});

describe("PoseRingBuffer", () => {
  describe("construction", () => {
    it("creates an empty buffer with the requested capacity", () => {
      const buf = new PoseRingBuffer(10);
      expect(buf.capacity).toBe(10);
      expect(buf.size).toBe(0);
      expect(buf.isEmpty).toBe(true);
    });

    it("throws for capacity < 1", () => {
      expect(() => new PoseRingBuffer(0)).toThrow(RangeError);
      expect(() => new PoseRingBuffer(-5)).toThrow(RangeError);
    });
  });

  describe("push and size", () => {
    it("increments size up to capacity", () => {
      const buf = new PoseRingBuffer(5);
      for (let i = 0; i < 5; i++) {
        buf.push(makeFrame(i));
        expect(buf.size).toBe(i + 1);
      }
      expect(buf.isFull).toBe(true);
    });

    it("does not exceed capacity", () => {
      const buf = new PoseRingBuffer(3);
      for (let i = 0; i < 10; i++) buf.push(makeFrame(i));
      expect(buf.size).toBe(3);
    });
  });

  describe("toArray order", () => {
    it("returns frames in insertion order when not full", () => {
      const buf = new PoseRingBuffer(10);
      buf.push(makeFrame(0));
      buf.push(makeFrame(1));
      buf.push(makeFrame(2));
      const arr = buf.toArray();
      expect(arr.map(f => f.frame_index)).toEqual([0, 1, 2]);
    });

    it("returns frames in oldest-first order after wraparound", () => {
      const buf = new PoseRingBuffer(3);
      for (let i = 0; i < 5; i++) buf.push(makeFrame(i));
      // After pushing 5 frames into capacity-3 buffer:
      // frames 0, 1 were overwritten; we should have 2, 3, 4
      const arr = buf.toArray();
      expect(arr.map(f => f.frame_index)).toEqual([2, 3, 4]);
    });

    it("returns empty array when empty", () => {
      const buf = new PoseRingBuffer(5);
      expect(buf.toArray()).toEqual([]);
    });

    it("returns a copy (mutation does not affect buffer state)", () => {
      const buf = new PoseRingBuffer(3);
      buf.push(makeFrame(0));
      const arr1 = buf.toArray();
      arr1[0] = makeFrame(99);
      const arr2 = buf.toArray();
      expect(arr2[0]!.frame_index).toBe(0);
    });
  });

  describe("dropped frame tracking", () => {
    it("increments droppedCount when overwriting", () => {
      const buf = new PoseRingBuffer(3);
      for (let i = 0; i < 6; i++) buf.push(makeFrame(i));
      expect(buf.droppedCount).toBe(3);
    });

    it("computes droppedRate correctly", () => {
      const buf = new PoseRingBuffer(3);
      for (let i = 0; i < 6; i++) buf.push(makeFrame(i));
      expect(buf.droppedRate).toBeCloseTo(3 / 6);
    });

    it("droppedRate is 0 when nothing pushed", () => {
      const buf = new PoseRingBuffer(5);
      expect(buf.droppedRate).toBe(0);
    });

    it("droppedCount stays 0 when under capacity", () => {
      const buf = new PoseRingBuffer(10);
      for (let i = 0; i < 5; i++) buf.push(makeFrame(i));
      expect(buf.droppedCount).toBe(0);
    });
  });

  describe("totalPushed", () => {
    it("counts every push including overwritten frames", () => {
      const buf = new PoseRingBuffer(3);
      for (let i = 0; i < 10; i++) buf.push(makeFrame(i));
      expect(buf.totalPushed).toBe(10);
    });
  });

  describe("clear", () => {
    it("resets all state", () => {
      const buf = new PoseRingBuffer(5);
      for (let i = 0; i < 8; i++) buf.push(makeFrame(i));
      buf.clear();
      expect(buf.size).toBe(0);
      expect(buf.droppedCount).toBe(0);
      expect(buf.totalPushed).toBe(0);
      expect(buf.toArray()).toEqual([]);
    });
  });

  describe("capacity-1 edge case", () => {
    it("keeps only the most recent frame", () => {
      const buf = new PoseRingBuffer(1);
      buf.push(makeFrame(0));
      buf.push(makeFrame(1));
      buf.push(makeFrame(2));
      const arr = buf.toArray();
      expect(arr).toHaveLength(1);
      expect(arr[0]!.frame_index).toBe(2);
      expect(buf.droppedCount).toBe(2);
    });
  });
});
