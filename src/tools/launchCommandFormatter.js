// Pretty-print a launch command as a multi-line script for the target shell.
//
//   formatLaunchCommand(javaPath, jvmArgs, mainClass, gameArgs, { shell, jvmArgFile, eol })
//
// shell: "posix" (bash/zsh, .sh)  continuation " \"   quotes '...'
//        "cmd"   (cmd.exe, .bat)  continuation " ^"   quotes "..."
//        "powershell" (.ps1)      continuation " `"   quotes '...', call operator &
// Defaults to "cmd" on Windows and "posix" elsewhere.
//
// jvmArgFile: path of a Java argument file (Java 9+) holding jvmArgs, written with
// formatArgFile(). The command then uses "@file" instead of listing the JVM args.
// cmd.exe cuts any command line at 8191 characters, and a modern classpath is longer
// than that, so .bat files for 1.13+ need this.
//
// Pass every token as its own array element: ["--gameDir", dir], not ["--gameDir " + dir].
// Build the classpath with path.delimiter (";" on Windows, ":" elsewhere).
// This is for logs and generated scripts. To run the game, pass the arrays to spawn()
// directly; that needs no quoting on any platform.

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
            // Windows argument parsing: backslashes before a quote are doubled, the quote becomes \"
            const escaped = s.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, "$1$1");
            return `"${escaped}"`;
        },
        command: (q) => q,
    },
    powershell: {
        continuation: " `",
        // Quote anything with dots, equals etc.: Windows PowerShell 5.1 splits unquoted
        // native arguments like -Dlf.gameDir=... at the dot.
        quote: (a) => (a !== "" && /^[\w-]+$/.test(a) ? a : `'${a.replace(/'/g, "''")}'`),
        command: (q) => `& ${q}`,
    },
};

// Keep "-cp <path>" and "--flag <value>" on one line; everything else gets its own line.
function pairArgs(args) {
    const lines = [];
    for (let i = 0; i < args.length; i++) {
        const a = args[i], next = args[i + 1];
        const takesValue = a === "-cp" || a === "-classpath" || a.startsWith("--");
        if (takesValue && next !== undefined && !next.startsWith("--")) {
            lines.push([a, next]);
            i++;
        } else {
            lines.push([a]);
        }
    }
    return lines;
}

function assertStrings(args) {
    for (const a of args) {
        if (typeof a !== "string") throw new TypeError(`launch argument is not a string: ${String(a)}`);
    }
}

// Contents of a Java argument file. Every argument is quoted; inside quotes Java treats
// \ as an escape character, so backslashes are doubled and quotes become \".
function formatArgFile(args, eol = "\n") {
    assertStrings(args);
    return args.map((a) => `"${a.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(eol) + eol;
}
function formatLaunchCommand(javaPath, jvmArgs, mainClass, gameArgs, options = {}) {
    const shellName = options.shell ?? (process.platform === "win32" ? "cmd" : "posix");
    const shell = SHELLS[shellName];
    if (!shell) throw new Error(`unknown shell '${shellName}' (use posix, cmd or powershell)`);

    assertStrings([javaPath, mainClass, ...jvmArgs, ...gameArgs]);

    const eol = options.eol ?? (shellName === "posix" ? "\n" : "\r\n");
    const line = (parts) => "  " + parts.map(shell.quote).join(" ");
    const jvmLines = options.jvmArgFile
        ? [line(["@" + options.jvmArgFile])]
        : pairArgs(jvmArgs).map(line);

    return [
        shell.command(shell.quote(javaPath)),
        ...jvmLines,
        line([mainClass]),
        ...pairArgs(gameArgs).map(line),
    ].join(shell.continuation + eol);
}

module.exports = { formatLaunchCommand, formatArgFile };