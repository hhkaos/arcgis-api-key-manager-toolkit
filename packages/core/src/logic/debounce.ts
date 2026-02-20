export interface DebouncedFunction<TArgs extends unknown[]> {
  (...args: TArgs): void;
  cancel(): void;
}

export function debounce<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  waitMs: number
): DebouncedFunction<TArgs> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const wrapped = (...args: TArgs): void => {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      callback(...args);
      timer = null;
    }, waitMs);
  };

  wrapped.cancel = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return wrapped;
}

