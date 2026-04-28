// Polyfill for Node 25+ localStorage missing WebStorage API methods.
// Required during static export — next-themes / RainbowKit call localStorage.getItem
// during prerender; Node's built-in localStorage object exists but is missing methods.
if (
  typeof globalThis.localStorage !== "undefined" &&
  typeof globalThis.localStorage.getItem !== "function"
) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key),
    clear: () => store.clear(),
    key: index => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
}
