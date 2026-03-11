import { useEffect, useRef, useState } from "react";

type UseProgressiveWindowOptions = {
  loadedCount: number;
  pageSize: number;
  threshold: number;
  identityKey: string;
  hasRemoteMore: boolean;
  isFetchingRemoteMore: boolean;
  onRemoteLoadMore?: () => Promise<void> | void;
};

export const getInitialVisibleCount = (loadedCount: number, pageSize: number) =>
  Math.min(loadedCount, pageSize);

export const getNextVisibleCount = ({
  loadedCount,
  pageSize,
  threshold,
  visibleCount,
  lastVisibleIndex,
}: {
  loadedCount: number;
  pageSize: number;
  threshold: number;
  visibleCount: number;
  lastVisibleIndex: number | null;
}) => {
  if (lastVisibleIndex === null || lastVisibleIndex < 0 || loadedCount === 0) {
    return visibleCount;
  }

  if (lastVisibleIndex >= visibleCount - threshold && visibleCount < loadedCount) {
    return Math.min(visibleCount + pageSize, loadedCount);
  }

  return visibleCount;
};

export const getRemoteLoadTriggerKey = ({
  identityKey,
  loadedCount,
  threshold,
  lastVisibleIndex,
  hasRemoteMore,
  isFetchingRemoteMore,
  hasRemoteLoadHandler,
  lastRemoteTriggerKey,
}: {
  identityKey: string;
  loadedCount: number;
  threshold: number;
  lastVisibleIndex: number | null;
  hasRemoteMore: boolean;
  isFetchingRemoteMore: boolean;
  hasRemoteLoadHandler: boolean;
  lastRemoteTriggerKey: string | null;
}) => {
  if (
    lastVisibleIndex === null ||
    lastVisibleIndex < loadedCount - threshold ||
    !hasRemoteMore ||
    isFetchingRemoteMore ||
    !hasRemoteLoadHandler
  ) {
    return null;
  }

  const nextTriggerKey = `${identityKey}:${loadedCount}`;

  return lastRemoteTriggerKey === nextTriggerKey ? null : nextTriggerKey;
};

export function useProgressiveWindow({
  loadedCount,
  pageSize,
  threshold,
  identityKey,
  hasRemoteMore,
  isFetchingRemoteMore,
  onRemoteLoadMore,
}: UseProgressiveWindowOptions) {
  const [visibleCount, setVisibleCount] = useState(() =>
    getInitialVisibleCount(loadedCount, pageSize),
  );
  const lastIdentityKeyRef = useRef(identityKey);
  const lastRemoteTriggerKeyRef = useRef<string | null>(null);
  const onRemoteLoadMoreRef = useRef(onRemoteLoadMore);

  useEffect(() => {
    onRemoteLoadMoreRef.current = onRemoteLoadMore;
  }, [onRemoteLoadMore]);

  useEffect(() => {
    if (lastIdentityKeyRef.current === identityKey) {
      return;
    }

    lastIdentityKeyRef.current = identityKey;
    setVisibleCount(getInitialVisibleCount(loadedCount, pageSize));
    lastRemoteTriggerKeyRef.current = null;
  }, [identityKey, pageSize, loadedCount]);

  useEffect(() => {
    setVisibleCount((current) => {
      const minimumVisibleCount = getInitialVisibleCount(loadedCount, pageSize);

      if (current > loadedCount) {
        return loadedCount;
      }

      if (current < minimumVisibleCount) {
        return minimumVisibleCount;
      }

      return current;
    });
  }, [loadedCount, pageSize]);

  const reportLastVisibleIndex = (lastVisibleIndex: number | null) => {
    const nextVisibleCount = getNextVisibleCount({
      loadedCount,
      pageSize,
      threshold,
      visibleCount,
      lastVisibleIndex,
    });

    if (nextVisibleCount !== visibleCount) {
      setVisibleCount(nextVisibleCount);
    }

    const remoteTriggerKey = getRemoteLoadTriggerKey({
      identityKey,
      loadedCount,
      threshold,
      lastVisibleIndex,
      hasRemoteMore,
      isFetchingRemoteMore,
      hasRemoteLoadHandler: Boolean(onRemoteLoadMore),
      lastRemoteTriggerKey: lastRemoteTriggerKeyRef.current,
    });

    if (!remoteTriggerKey) {
      return;
    }

    lastRemoteTriggerKeyRef.current = remoteTriggerKey;
    void onRemoteLoadMoreRef.current?.();
  };

  return {
    visibleCount,
    showLoaderRow: isFetchingRemoteMore,
    reportLastVisibleIndex,
  };
}
