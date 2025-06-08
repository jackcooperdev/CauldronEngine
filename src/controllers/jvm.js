import fs from "fs";
import shelljs from "shelljs";
import path from "path";
import {processQueue, verifyInstallation} from "./queue.js";
import {grabPath, getOperatingSystem} from "../tools/compatibility.js";

async function checkCompat(jVersion, jvmData) {
    let actualPlatform = getOperatingSystem(true);
    if (jvmData[actualPlatform][jVersion] !== undefined) {
        return jvmData[actualPlatform][jVersion];
    } else {
        return false;
    }
}

async function checkJVM(name, jvmMani) {
    return new Promise(async (resolve) => {
        let CAULDRON_PATH = grabPath();
        shelljs.mkdir("-p", path.join(CAULDRON_PATH, "jvm", name));
        fs.writeFileSync(path.join(CAULDRON_PATH, "jvm", name + ".json"), JSON.stringify(jvmMani));
        let files = jvmMani.files;
        // Build Dir Structure
        for (let idx in files) {
            if (files[idx].type === "directory") {
                shelljs.mkdir("-p", path.join(CAULDRON_PATH, "jvm", name, idx));
            }
        }
        let dQueue = [];
        for (let sIdx in files) {
            let selectedFile = files[sIdx];
            let downUrl;
            /**
             * @param selectedFile.executable
             * @param selectedFile.lzma
             */
            if (selectedFile.type === "file") {
                let downloadPath = path.join(CAULDRON_PATH, "jvm", name, sIdx);
                try {
                    if (selectedFile.executable) {
                        downUrl = selectedFile.downloads.raw.url;
                    } else {
                        downUrl = selectedFile.downloads.raw.url;
                    }
                } catch (err) {
                    downUrl = selectedFile.downloads.raw.url;
                }
                dQueue.push({
                    origin: downUrl,
                    destination: path.join(downloadPath, "../"),
                    sha1: selectedFile.downloads.raw.sha1,
                    fileName: sIdx.split("/")[sIdx.split("/").length - 1],
                });
            }
        }
        await processQueue(dQueue, false, 'jvm');
        if (getOperatingSystem() === "linux") {
            await shelljs.chmod("+x", path.join(CAULDRON_PATH, "jvm", name, "bin", "java"));
        }
        let currentJVMFile = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, "config/jvm_installed.json")).toString());
        currentJVMFile[name] = {
            installed: true, lastChecked: new Date().getTime(),
        };
        fs.writeFileSync(path.join(CAULDRON_PATH, "config/jvm_installed.json"), JSON.stringify(currentJVMFile));
        resolve(true);
    });
}

export {checkCompat, checkJVM};
