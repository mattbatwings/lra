export function clsx(...xs: Array<string | undefined | false>) {
  return xs.filter(Boolean).join(" ");
}
