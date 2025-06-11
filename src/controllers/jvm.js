const fs = require("fs");
const path = require("path");
const { processQueue, verifyInstallation } = require("./queue.js");
const { grabPath, getOperatingSystem } = require("../tools/compatibility.js");

async function checkCompat(jVersion, jvmData) {
    const actualPlatform = getOperatingSystem(true);
    return jvmData[actualPlatform]?.[jVersion] ?? false;
}

async function checkJVM(name, jvmMani) {
    return new Promise(async (resolve) => {
        const CAULDRON_PATH = grabPath();

        // Create main JVM directory
        fs.mkdirSync(path.join(CAULDRON_PATH, "jvm", name), { recursive: true });
        fs.writeFileSync(
            path.join(CAULDRON_PATH, "jvm", `${name}.json`),
            JSON.stringify(jvmMani)
        );

        const files = jvmMani.files;

        // Create directory structure
        for (const idx in files) {
            if (files[idx].type === "directory") {
                fs.mkdirSync(path.join(CAULDRON_PATH, "jvm", name, idx), {
                    recursive: true,
                });
            }
        }

        // Download queue
        const dQueue = [];

        for (const sIdx in files) {
            const selectedFile = files[sIdx];
            if (selectedFile.type === "file") {
                const downloadPath = path.join(CAULDRON_PATH, "jvm", name, sIdx);
                const downUrl = selectedFile.downloads.raw.url;

                dQueue.push({
                    origin: downUrl,
                    destination: path.dirname(downloadPath),
                    sha1: selectedFile.downloads.raw.sha1,
                    fileName: path.basename(sIdx),
                });
            }
        }

        await processQueue(dQueue, false, "jvm");

        // Make Java executable on Linux
        if (getOperatingSystem() === "linux") {
            const javaPath = path.join(CAULDRON_PATH, "jvm", name, "bin", "java");
            try {
                fs.chmodSync(javaPath, 0o755); // rwxr-xr-x
            } catch (err) {
                console.warn(`chmod failed: ${err.message}`);
            }
        }

        const jvmFilePath = path.join(CAULDRON_PATH, "config/jvm_installed.json");
        const currentJVMFile = fs.existsSync(jvmFilePath)
            ? JSON.parse(fs.readFileSync(jvmFilePath).toString())
            : {};

        currentJVMFile[name] = {
            installed: true,
            lastChecked: Date.now(),
        };

        fs.writeFileSync(jvmFilePath, JSON.stringify(currentJVMFile));
        resolve(true);
    });
}

module.exports =  { checkCompat, checkJVM };
