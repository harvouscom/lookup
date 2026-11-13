// Setup hints for developers. Each prints once, and only on a local development host (localhost,
// 127.0.0.1, *.localhost, *.test), so production consoles and servers stay quiet.
const said: Record<string, 1> = {};

export function devWarn(message: string): void {
  const host = typeof location == "object" ? location.hostname : "";
  if (said[message] || !/^(localhost|127\.0\.0\.1|\[::1\])$|\.(localhost|test)$/.test(host)) return;
  said[message] = 1;
  console.warn("Lookup: " + message);
}
