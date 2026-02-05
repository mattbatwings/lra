export function unique<T>(xs: T[]) {
  return Array.from(new Set(xs));
}
