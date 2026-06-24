// src/exec.ts
// True process replacement via libc execvp (Bun has no built-in exec).
// macOS only — the build target is bun-darwin-arm64.
import { dlopen, ptr } from "bun:ffi";

const libc = dlopen("/usr/lib/libSystem.B.dylib", {
  execvp: { args: ["ptr", "ptr"], returns: "int" },
});

function cstr(s: string): Buffer {
  return Buffer.from(s + "\0", "utf8");
}

/**
 * Replace the current process image with `argv` (argv[0] is PATH-resolved).
 * On success this never returns — the process *becomes* the new program.
 * Returns only if exec fails.
 */
export function execReplace(argv: string[]): void {
  const bufs = argv.map(cstr);
  const ptrs = new BigInt64Array(bufs.length + 1);
  for (let i = 0; i < bufs.length; i++) ptrs[i] = BigInt(ptr(bufs[i]));
  ptrs[bufs.length] = 0n; // null-terminate the argv array
  libc.symbols.execvp(ptr(bufs[0]), ptr(ptrs));
}
