import { createSoloRoundController, SOLO_COUNTDOWN_SECONDS } from "../features/game/flow/soloRoundController";

const deferred = () => {
  let resolve!: (clip: { uri: string }) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<{ uri: string }>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const setup = (timeLimit = 8) => {
  const capture = deferred();
  const record = jest.fn(() => capture.promise);
  const stop = jest.fn();
  const onComplete = jest.fn();
  const onDiscard = jest.fn();
  const controller = createSoloRoundController({ timeLimit, record, stop, onComplete, onDiscard });
  return { controller, capture, record, stop, onComplete, onDiscard };
};
const flushCapture = async () => { await Promise.resolve(); };

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

test("waits for all three countdown seconds, then records exactly once", () => {
  const { controller, record } = setup();
  controller.start();
  controller.start();
  expect(controller.getSnapshot().countdown).toBe(SOLO_COUNTDOWN_SECONDS);
  jest.advanceTimersByTime(1000);
  expect(controller.getSnapshot().countdown).toBe(2);
  jest.advanceTimersByTime(1000);
  expect(controller.getSnapshot().countdown).toBe(1);
  jest.advanceTimersByTime(999);
  expect(record).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  expect(record).toHaveBeenCalledTimes(1);
  expect(controller.getSnapshot()).toMatchObject({ phase: "running", elapsed: 0 });
  controller.start();
  jest.advanceTimersByTime(500);
  expect(record).toHaveBeenCalledTimes(1);
});

test("cancelling during countdown does not create a video", () => {
  const { controller, record, stop } = setup();
  controller.start();
  jest.advanceTimersByTime(2500);
  controller.reset();
  jest.advanceTimersByTime(10_000);
  expect(controller.getSnapshot().phase).toBe("setup");
  expect(record).not.toHaveBeenCalled();
  expect(stop).not.toHaveBeenCalled();
});

test.each([8, 12, 20])("%i-second recording limit excludes countdown and waits for the native file", async timeLimit => {
  const { controller, stop, capture, onComplete } = setup(timeLimit);
  controller.start();
  jest.advanceTimersByTime(3000 + timeLimit * 1000 - 100);
  expect(stop).not.toHaveBeenCalled();
  expect(controller.getSnapshot().phase).toBe("running");
  jest.advanceTimersByTime(100);
  expect(controller.getSnapshot()).toMatchObject({ phase: "finishing", elapsed: timeLimit });
  expect(stop).toHaveBeenCalledTimes(1);
  expect(onComplete).not.toHaveBeenCalled();
  controller.finish();
  capture.resolve({ uri: "file:///cache/round.mov" });
  await flushCapture();
  expect(onComplete).toHaveBeenCalledTimes(1);
  expect(onComplete).toHaveBeenCalledWith({ uri: "file:///cache/round.mov" }, timeLimit);
  expect(controller.getSnapshot().phase).toBe("reviewing");
  expect(jest.getTimerCount()).toBe(0);
});

test("manual stop freezes the round duration while the file finishes", async () => {
  const { controller, stop, capture, onComplete } = setup();
  controller.start();
  jest.advanceTimersByTime(5500);
  controller.finish();
  controller.finish();
  expect(stop).toHaveBeenCalledTimes(1);
  expect(controller.getSnapshot()).toMatchObject({ phase: "finishing", elapsed: 2.5 });
  jest.advanceTimersByTime(2000);
  expect(onComplete).not.toHaveBeenCalled();
  capture.resolve({ uri: "file:///cache/round.mp4" });
  await flushCapture();
  expect(onComplete).toHaveBeenCalledWith({ uri: "file:///cache/round.mp4" }, 2.5);
});

test("native duration expiry can finish before the next JS timer tick", async () => {
  const { controller, stop, capture, onComplete } = setup();
  controller.start();
  jest.advanceTimersByTime(10999);
  capture.resolve({ uri: "file:///cache/native.mp4" });
  await flushCapture();
  expect(controller.getSnapshot().phase).toBe("reviewing");
  expect(onComplete).toHaveBeenCalledTimes(1);
  expect(onComplete.mock.calls[0][1]).toBeCloseTo(7.999);
  jest.advanceTimersByTime(1000);
  expect(stop).not.toHaveBeenCalled();
});

test.each(["countdown", "running", "finishing"])("interrupting %s stops the round without opening review", async phase => {
  const { controller, record, stop, capture, onComplete, onDiscard } = setup();
  controller.start();
  jest.advanceTimersByTime(phase === "countdown" ? 1000 : 4000);
  if (phase === "finishing") controller.finish();
  controller.interrupt();
  controller.interrupt();
  expect(controller.getSnapshot().phase).toBe("interrupted");
  expect(stop).toHaveBeenCalledTimes(phase === "countdown" ? 0 : 1);
  if (phase !== "countdown") {
    capture.resolve({ uri: "file:///cache/discard.mov" });
    await flushCapture();
    expect(onDiscard).toHaveBeenCalledWith("file:///cache/discard.mov");
  } else {
    jest.advanceTimersByTime(3000);
    expect(record).not.toHaveBeenCalled();
  }
  expect(onComplete).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

test("a late failure from an interrupted round does not affect its replacement", async () => {
  const { controller, capture, record, onComplete } = setup();
  const next = deferred();
  controller.start();
  jest.advanceTimersByTime(4000);
  controller.interrupt();
  controller.reset();
  record.mockReturnValueOnce(next.promise);
  controller.start();
  jest.advanceTimersByTime(3000);
  capture.reject(new Error("old camera unmounted"));
  await flushCapture();
  expect(controller.getSnapshot()).toMatchObject({ phase: "running", error: null });
  jest.advanceTimersByTime(1000);
  controller.finish();
  next.resolve({ uri: "file:///cache/new.mov" });
  await flushCapture();
  expect(onComplete).toHaveBeenCalledWith({ uri: "file:///cache/new.mov" }, 1);
});

test("a late file from an interrupted round is discarded while the replacement runs", async () => {
  const { controller, capture, record, onComplete, onDiscard } = setup();
  const next = deferred();
  controller.start();
  jest.advanceTimersByTime(4000);
  controller.reset();
  record.mockReturnValueOnce(next.promise);
  controller.start();
  jest.advanceTimersByTime(3000);
  capture.resolve({ uri: "file:///cache/old.mov" });
  await flushCapture();
  expect(onDiscard).toHaveBeenCalledWith("file:///cache/old.mov");
  expect(onComplete).not.toHaveBeenCalled();
  expect(controller.getSnapshot().phase).toBe("running");
});

test.each(["reject", "empty", "throw"])("recording %s errors return to a retry state without review", async failure => {
  const { controller, capture, record, onComplete } = setup();
  if (failure === "throw") record.mockImplementationOnce(() => { throw new Error("no camera"); });
  controller.start();
  jest.advanceTimersByTime(3000);
  if (failure === "reject") capture.reject(new Error("permission denied"));
  if (failure === "empty") capture.resolve({ uri: "" });
  await flushCapture();
  expect(controller.getSnapshot().phase).toBe("interrupted");
  expect(controller.getSnapshot().error).toBeTruthy();
  expect(onComplete).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

test("a stalled finalization becomes retryable and discards any later file", async () => {
  const { controller, capture, stop, onComplete, onDiscard } = setup();
  controller.start();
  jest.advanceTimersByTime(4000);
  controller.finish();
  jest.advanceTimersByTime(10_000);
  expect(controller.getSnapshot().phase).toBe("interrupted");
  expect(stop).toHaveBeenCalledTimes(1);
  capture.resolve({ uri: "file:///cache/late.mov" });
  await flushCapture();
  expect(onComplete).not.toHaveBeenCalled();
  expect(onDiscard).toHaveBeenCalledWith("file:///cache/late.mov");
});

test("subscribers receive changes until unsubscribed", () => {
  const { controller } = setup();
  const listener = jest.fn();
  const unsubscribe = controller.subscribe(listener);
  controller.start();
  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
  controller.reset();
  expect(listener).toHaveBeenCalledTimes(1);
});
