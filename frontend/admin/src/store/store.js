import { createAppModel } from './app-model.js';

// Existing domain actions remain independent of the view; React observes their mutations.
export function createAppStore() {
  const model = createAppModel();
  model.$refs = Object.create(null);
  model.$nextTick = (callback) => requestAnimationFrame(callback);
  let version = 0;
  const listeners = new Set();
  const cache = new WeakMap();
  const notify = () => { version++; listeners.forEach((listener) => listener()); };
  function observable(value) {
    if (!value || typeof value !== 'object' || (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype)) return value;
    if (cache.has(value)) return cache.get(value);
    const proxy = new Proxy(value, {
      get(target, key, receiver) { return observable(Reflect.get(target, key, receiver)); },
      set(target, key, next, receiver) {
        const old = Reflect.get(target, key, receiver);
        const changed = Reflect.set(target, key, next, receiver);
        if (changed && !Object.is(old, next)) notify();
        return changed;
      },
    });
    cache.set(value, proxy);
    return proxy;
  }
  return {
    app: observable(model),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    snapshot() { return version; },
  };
}
