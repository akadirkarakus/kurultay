import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useOptimisticPick } from "@/lib/client/useOptimisticPick";

describe("useOptimisticPick", () => {
  it("sets the value instantly on click, before the submit promise resolves", () => {
    let resolveSubmit: () => void = () => {};
    const submit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    const { result } = renderHook(() => useOptimisticPick(null, submit));

    act(() => {
      result.current.pick("char-1");
    });

    expect(result.current.effectiveValue).toBe("char-1");
    expect(result.current.submitting).toBe(true);

    act(() => resolveSubmit());
  });

  it("reverts to null and sets an error when submit rejects", async () => {
    const submit = vi.fn().mockRejectedValue(new Error("character_used"));
    const { result } = renderHook(() => useOptimisticPick(null, submit));

    await act(async () => {
      await result.current.pick("char-1");
    });

    expect(result.current.effectiveValue).toBeNull();
    expect(result.current.error).toBe("character_used");
    expect(result.current.submitting).toBe(false);
  });

  it("keeps the optimistic value when submit resolves successfully", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useOptimisticPick(null, submit));

    await act(async () => {
      await result.current.pick("char-1");
    });

    expect(result.current.effectiveValue).toBe("char-1");
    expect(result.current.error).toBeNull();
  });

  it("is a no-op if already locked in (server value already set)", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useOptimisticPick("already-picked", submit));

    await act(async () => {
      await result.current.pick("char-2");
    });

    expect(submit).not.toHaveBeenCalled();
    expect(result.current.effectiveValue).toBe("already-picked");
  });

  it("is a no-op for a second click while the first is still in flight", async () => {
    let resolveFirst: () => void = () => {};
    const submit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    const { result } = renderHook(() => useOptimisticPick(null, submit));

    let firstPick!: Promise<void>;
    act(() => {
      firstPick = result.current.pick("char-1");
    });
    act(() => {
      result.current.pick("char-2"); // ignored — optimistic value already set
    });

    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith("char-1");

    await act(async () => {
      resolveFirst();
      await firstPick;
    });

    expect(result.current.submitting).toBe(false);
  });
});
