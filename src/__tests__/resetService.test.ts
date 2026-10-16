jest.mock("expo-notifications", () => ({ cancelAllScheduledNotificationsAsync: jest.fn() }));
jest.mock("@/lib/cloudKv", () => ({ wipeLocalData: jest.fn() }));
jest.mock("@/lib/queryClient", () => ({ queryClient: { clear: jest.fn() } }));
jest.mock("@/services/serviceUtils", () => ({ getClientOrThrow: jest.fn() }));

import { canReset } from "@/services/resetService";

describe("account reset", () => {
  it("is only offered to the owner's account", () => {
    expect(canReset("thkang091@gmail.com")).toBe(true);
    expect(canReset("  THKang091@Gmail.com ")).toBe(true);
    expect(canReset("someone@example.com")).toBe(false);
    expect(canReset(null)).toBe(false);
    expect(canReset(undefined)).toBe(false);
  });
});
