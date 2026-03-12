import type { configure } from "onedollarstats";

function parseBooleanFlag(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
}

type OneDollarStatsConfig = Parameters<typeof configure>[0];

export function getOneDollarStatsConfig(
  env: Pick<
    ImportMetaEnv,
    | "DEV"
    | "VITE_ONEDOLLARSTATS_ENABLED"
    | "VITE_ONEDOLLARSTATS_HOSTNAME"
    | "VITE_ONEDOLLARSTATS_COLLECTOR_URL"
  >,
): OneDollarStatsConfig | null {
  const explicitEnabled = parseBooleanFlag(env.VITE_ONEDOLLARSTATS_ENABLED);
  const hostname = env.VITE_ONEDOLLARSTATS_HOSTNAME?.trim() || undefined;
  const collectorUrl = env.VITE_ONEDOLLARSTATS_COLLECTOR_URL?.trim() || undefined;

  if (explicitEnabled === false) {
    return null;
  }

  const baseConfig = {
    autocollect: true,
    hashRouting: false,
    ...(collectorUrl ? { collectorUrl } : {}),
  };

  if (env.DEV) {
    if (explicitEnabled !== true || !hostname) {
      return null;
    }

    return {
      ...baseConfig,
      devmode: true,
      hostname,
    };
  }

  return {
    ...baseConfig,
    ...(hostname ? { hostname } : {}),
  };
}
