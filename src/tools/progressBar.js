
const REDRAW_INTERVAL = 100;
const BAR_WIDTH = 28;


function createProgressBar(label, groups) {
    groups = groups.filter(group => group.total > 0).map(group => ({ ...group, done: 0, downloaded: 0 }));
    const total = groups.reduce((sum, group) => sum + group.total, 0);
    const enabled = Boolean(process.stderr.isTTY) && total > 0;
    const start = Date.now();
    let lastDraw = 0;
    let linesDrawn = 0;
    let dirty = false;

    const nameWidth = Math.max(0, ...groups.map(group => group.name.length));
    const countWidth = String(Math.max(0, ...groups.map(group => group.total))).length;

    function formatGroup(group) {
        const percent = Math.floor((group.done / group.total) * 100);
        const filled = Math.round((group.done / group.total) * BAR_WIDTH);
        const bar = "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
        const count = `${String(group.done).padStart(countWidth)}/${String(group.total).padEnd(countWidth)}`;
        return `  ${group.name.padEnd(nameWidth)}  ${bar}  ${count}  ${String(percent).padStart(3)}%  ${group.downloaded} downloaded`;
    }

    function draw() {
        // Lines are cut to the terminal width so they don't wrap and break the redraw
        const columns = (process.stderr.columns || 80) - 1;
        const lines = [`[info] ${label}`, ...groups.map(formatGroup)].map(line => line.slice(0, columns));
        let out = linesDrawn > 0 ? `\x1b[${linesDrawn}A` : "";
        for (const line of lines) {
            out += `\r${line}\x1b[K\n`;
        }
        process.stderr.write(out);
        linesDrawn = lines.length;
        lastDraw = Date.now();
        dirty = false;
    }

    if (enabled) {
        draw();
    }

    return {
        tick(groupName, wasDownloaded = false) {
            const group = groups.find(group => group.name === groupName);
            if (!group) {
                return;
            }
            group.done++;
            if (wasDownloaded) {
                group.downloaded++;
            }
            dirty = true;
            if (enabled && (group.done === group.total || Date.now() - lastDraw >= REDRAW_INTERVAL)) {
                draw();
            }
        },

        stop(success = true) {
            if (!enabled) {
                return;
            }
            if (dirty) {
                draw();
            }
            if (success) {
                const downloaded = groups.reduce((sum, group) => sum + group.downloaded, 0);
                const seconds = ((Date.now() - start) / 1000).toFixed(1);
                process.stderr.write(`[info] Done in ${seconds}s: ${downloaded} files downloaded, ${total - downloaded} already installed\n`);
            }
        },
    };
}

module.exports = { createProgressBar };
