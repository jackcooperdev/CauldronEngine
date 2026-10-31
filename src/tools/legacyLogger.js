const fs = require('fs');
const path = require('path');
const net = require('net');

const EXIT_MARKER = '__CAULDRON_GAME_EXITED__';
const SINK_PORTS = [9500, 9501];
const MAX_QUEUE = 5000;

function timestamp() {
    return new Date().toTimeString().slice(0, 8);
}


function guessLevel(msg) {
    if (/^\s*\[?(SEVERE|ERROR)\]?/i.test(msg) || /^\s*at\s|^Caused by:|Exception\b/.test(msg)) return 'ERROR';
    if (/^\s*\[?WARN(ING)?\]?/i.test(msg)) return 'WARN';
    return 'INFO';
}

// Log4j's Socket appender emulator (uses a tcp sink)
function createSink(port) {
    let sock = null, connected = false, closed = false;
    const queue = [];
    const connect = () => {
        if (closed) return;
        sock = net.connect(port, '127.0.0.1');
        sock.on('connect', () => {
            connected = true;
            while (queue.length) sock.write(queue.shift());
        });
        sock.on('error', () => {});
        sock.on('close', () => {
            connected = false;
            if (!closed) setTimeout(connect, 1000);
        });
    };
    connect();
    return {
        write(line) {
            if (connected) sock.write(line);
            else if (queue.length < MAX_QUEUE) queue.push(line);
        },
        end() {
            closed = true;
            if (connected) sock.end(); else sock.destroy();
        }
    };
}

function startLegacyLogging(rawLogPath) {
    const formattedPath = path.join(path.dirname(rawLogPath), 'mcLogs.log');
    const out = fs.createWriteStream(formattedPath, { flags: 'a' });
    const sinks = SINK_PORTS.map(createSink);
    let pos = 0, buf = '', stopped = false;

    const emit = (msg) => {
        const line = `[${timestamp()}] [main/${guessLevel(msg)}]: ${msg}\n`;
        out.write(line);
        for (const s of sinks) s.write(line);
    };

    const stop = () => {
        if (stopped) return;
        stopped = true;
        clearInterval(timer);
        if (buf) emit(buf);
        out.end();
        sinks.forEach(s => s.end());
    };

    const timer = setInterval(() => {
        let size;
        try { size = fs.statSync(rawLogPath).size; } catch { return; }
        if (size <= pos) return;

        const fd = fs.openSync(rawLogPath, 'r');
        const chunk = Buffer.alloc(size - pos);
        fs.readSync(fd, chunk, 0, chunk.length, pos);
        fs.closeSync(fd);
        pos = size;

        buf += chunk.toString('utf8');
        const lines = buf.split(/\r?\n/);
        buf = lines.pop();
        for (const msg of lines) {
            if (msg.trim() === EXIT_MARKER) { buf = ''; return stop(); }
            if (msg !== '') emit(msg);
        }
    }, 250);

    return stop;
}

module.exports = { startLegacyLogging, EXIT_MARKER };