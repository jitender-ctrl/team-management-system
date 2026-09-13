// A tiny pub-sub so non-component code (like the axios interceptor) can
// trigger toasts without needing to be inside the React tree.
let listeners = [];
let nextId = 1;

function emit(type, message) {
  const toast = { id: nextId++, type, message };
  listeners.forEach((fn) => fn(toast));
  return toast.id;
}

export const toast = {
  success: (message) => emit("success", message),
  error: (message) => emit("error", message),
  info: (message) => emit("info", message),
  subscribe: (fn) => {
    listeners.push(fn);
    return () => {
      listeners = listeners.filter((l) => l !== fn);
    };
  },
};
