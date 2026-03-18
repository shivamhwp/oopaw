const STALE_DEPLOYMENT_SESSION_KEY = "oop.stale-deployment-reload";
const LOCALHOST_CACHE_CLEANUP_SESSION_KEY = "oop.localhost-cache-cleanup";

const staleDeploymentPatterns = [
  /bad http response code \(404\) was received when fetching the script/i,
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /loading chunk [\w-]+ failed/i,
  /server function info not found/i,
  /server function module (?:export )?not resolved/i,
  /server function not accessible from client/i,
];

const getErrorMessage = (error: unknown): string | undefined => {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    if ("reason" in error) {
      return getErrorMessage(error.reason);
    }

    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }
  }

  return undefined;
};

const isStaleDeploymentError = (error: unknown) => {
  const message = getErrorMessage(error);

  return message ? staleDeploymentPatterns.some((pattern) => pattern.test(message)) : false;
};

const recoverFromStaleDeployment = (error: unknown) => {
  if (typeof window === "undefined" || !isStaleDeploymentError(error)) {
    return false;
  }

  if (window.sessionStorage.getItem(STALE_DEPLOYMENT_SESSION_KEY)) {
    return false;
  }

  window.sessionStorage.setItem(STALE_DEPLOYMENT_SESSION_KEY, "1");
  window.location.reload();

  return true;
};

const isLocalDevelopmentHostname = (hostname: string) =>
  ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);

const cleanupLocalhostCachesOncePerSession = async ({
  hostname,
  sessionStorage,
  serviceWorker,
  cacheStorage,
}: {
  hostname: string;
  sessionStorage: Pick<Storage, "getItem" | "setItem">;
  serviceWorker?: Pick<ServiceWorkerContainer, "getRegistrations">;
  cacheStorage?: Pick<CacheStorage, "keys" | "delete">;
}) => {
  if (!isLocalDevelopmentHostname(hostname)) {
    return false;
  }

  if (sessionStorage.getItem(LOCALHOST_CACHE_CLEANUP_SESSION_KEY)) {
    return false;
  }

  sessionStorage.setItem(LOCALHOST_CACHE_CLEANUP_SESSION_KEY, "1");

  const registrations = serviceWorker ? await serviceWorker.getRegistrations() : [];
  const cacheKeys = cacheStorage ? await cacheStorage.keys() : [];

  await Promise.allSettled([
    ...registrations.map((registration) => registration.unregister()),
    ...cacheKeys.map((cacheKey) => cacheStorage?.delete(cacheKey)),
  ]);

  return true;
};

export const installLocalhostCacheCleanup = () => {
  if (typeof window === "undefined") {
    return;
  }

  void cleanupLocalhostCachesOncePerSession({
    hostname: window.location.hostname,
    sessionStorage: window.sessionStorage,
    serviceWorker: "serviceWorker" in navigator ? navigator.serviceWorker : undefined,
    cacheStorage: "caches" in globalThis ? globalThis.caches : undefined,
  });
};

export const installStaleDeploymentRecovery = () => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleError = (event: ErrorEvent) => {
    recoverFromStaleDeployment(event.error ?? event.message);
  };
  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    recoverFromStaleDeployment(event.reason);
  };

  window.addEventListener("error", handleError);
  window.addEventListener("unhandledrejection", handleUnhandledRejection);

  return () => {
    window.removeEventListener("error", handleError);
    window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  };
};
