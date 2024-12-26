import { DependencyList, useEffect } from "react";

type EffectAsyncCallback = (...args: any[]) => Promise<any>;
type EffectDestructorCallback = () => void;

export class EffectAsyncRegistry {
  static tasks = new Set<EffectAsyncCallback>();
}

export function useEffectAsync(effectCallback: EffectAsyncCallback, deps?: DependencyList, destructorCallback?: EffectDestructorCallback) {
  return useEffect(() => {
    if (!EffectAsyncRegistry.tasks.has(effectCallback)) {
      EffectAsyncRegistry.tasks.add(effectCallback);
      effectCallback().then(() => EffectAsyncRegistry.tasks.delete(effectCallback));
    }
    return destructorCallback;
  }, deps);
}