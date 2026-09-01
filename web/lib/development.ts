export const isDevelopmentAuthBypassEnabled = (
  isDevelopment = import.meta.env?.DEV ?? false,
  bypassFlag = import.meta.env?.VITE_TICHU_DEV_AUTH_BYPASS,
) => isDevelopment && bypassFlag === "1";
