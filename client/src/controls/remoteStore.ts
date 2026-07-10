let controllerCount = 0;
const listeners = new Set<() => void>();

export function getControllerCount(): number {
  return controllerCount;
}

export function setControllerCount(count: number) {
  controllerCount = count;
  listeners.forEach((listener) => listener());
}

export function subscribeControllerCount(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
