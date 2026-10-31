const SHELLS = {
  posix: {
    continuation: " \\",
    quote: (a) => (a !== "" && /^[\w@%+=:,./-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`),
    command: (q) => q,
  },
  cmd: {
    continuation: " ^",
    // Quote anything with spaces or cmd metacharacters. Inside a .bat file, % must be %%.
    quote: (a) => {
      const s = a.replace(/%/g, "%%");
      if (s !== "" && /^[\w@+=:,./\\-]+$/.test(s)) return s;
      // Java's Windows argument parser: backslashes before a quote are doubled, quote becomes \"
      const escaped = s.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, "$1$1");
      return `"${escaped}"`;
    },
    command: (q) => q,
  },
  powershell: {
    continuation: " `",
    quote: (a) => (a !== "" && /^[\w-]+$/.test(a) ? a : `'${a.replace(/'/g, "''")}'`),
    command: (q) => `& ${q}`,
  },
};

function pairArgs(args) {
  const lines = [];
  for (let i = 0; i < args.length; i++) {
    const a = String(args[i]), next = args[i + 1];
    const takesValue = a === "-cp" || a === "-classpath" || a.startsWith("--");
    if (takesValue && next !== undefined && !String(next).startsWith("--")) {
      lines.push([a, String(next)]);
      i++;
    } else {
      lines.push([a]);
    }
  }
  return lines;
}

export function formatLaunchCommand(javaPath, jvmArgs, mainClass, gameArgs, options = {}) {
  const shellName = options.shell ?? (process.platform === "win32" ? "cmd" : "posix");
  const shell = SHELLS[shellName];
  if (!shell) throw new Error(`unknown shell '${shellName}' (use posix, cmd or powershell)`);

  for (const a of [javaPath, mainClass, ...jvmArgs, ...gameArgs]) {
    if (typeof a !== "string") throw new TypeError(`launch argument is not a string: ${String(a)}`);
  }

  const line = (parts) => parts.map(shell.quote).join(" ");
  const eol = options.eol ?? (shellName === "posix" ? "\n" : "\r\n");
  return [
    shell.command(shell.quote(javaPath)),
    ...pairArgs(jvmArgs).map((l) => "  " + line(l)),
    "  " + shell.quote(mainClass),
    ...pairArgs(gameArgs).map((l) => "  " + line(l)),
  ].join(shell.continuation + eol);
}