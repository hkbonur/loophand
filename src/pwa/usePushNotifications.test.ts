// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { renderHook, act, waitFor, cleanup } from "@testing-library/react";

// A valid base64url VAPID key (the real generated dev key) + one mutation spy.
const { vapidKey, mutationSpy } = vi.hoisted(() => ({
  vapidKey: "BOgP6QayvLB5j2JyD4ChhwL75CvxAmkhugYYrGNQgClRVLjq0ApmKuU8FmRExiSEtgUL73rwf7zL00l8ZyEwNjU",
  mutationSpy: vi.fn(() => Promise.resolve()),
}));
vi.mock("convex/react", () => ({
  useQuery: () => vapidKey,
  useMutation: () => mutationSpy,
}));

import { usePushNotifications } from "./usePushNotifications";

const fakeSubscription = {
  endpoint: "https://push.example/endpoint-1",
  toJSON: () => ({ endpoint: "https://push.example/endpoint-1", keys: { p256dh: "p256", auth: "auth" } }),
  unsubscribe: vi.fn(() => Promise.resolve(true)),
};
const pushManager = {
  subscribe: vi.fn(() => Promise.resolve(fakeSubscription)),
  getSubscription: vi.fn((): Promise<typeof fakeSubscription | null> => Promise.resolve(null)),
};

beforeEach(() => {
  mutationSpy.mockClear();
  pushManager.subscribe.mockClear();
  fakeSubscription.unsubscribe.mockClear();
  pushManager.getSubscription.mockResolvedValue(null);
  vi.stubGlobal("Notification", {
    permission: "default",
    requestPermission: vi.fn(() => Promise.resolve("granted")),
  });
  vi.stubGlobal("PushManager", function PushManager() {});
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager }) },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("usePushNotifications.enable", () => {
  test("requests permission, subscribes through PushManager, and registers on the server", async () => {
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.supported).toBe(true));

    await act(async () => {
      await result.current.enable();
    });

    expect(Notification.requestPermission).toHaveBeenCalled();
    expect(pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );
    expect(mutationSpy).toHaveBeenCalledWith({
      endpoint: "https://push.example/endpoint-1",
      p256dh: "p256",
      auth: "auth",
    });
    expect(result.current.subscribed).toBe(true);
  });

  test("does nothing when permission is denied", async () => {
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission: vi.fn(() => Promise.resolve("denied")),
    });
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.supported).toBe(true));

    await act(async () => {
      await result.current.enable();
    });

    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(mutationSpy).not.toHaveBeenCalled();
    expect(result.current.subscribed).toBe(false);
  });
});

describe("usePushNotifications.disable", () => {
  test("unsubscribes from the browser and clears the server record", async () => {
    pushManager.getSubscription.mockResolvedValue(fakeSubscription);
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.subscribed).toBe(true)); // mount reflects existing

    await act(async () => {
      await result.current.disable();
    });

    expect(mutationSpy).toHaveBeenCalledWith({ endpoint: fakeSubscription.endpoint });
    expect(fakeSubscription.unsubscribe).toHaveBeenCalled();
    expect(result.current.subscribed).toBe(false);
  });
});
