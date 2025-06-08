import os from "os";
import path from "path";
import shell from "shelljs";

const osCurrent = os.platform();
const archCurrent = os.arch();
const homedir = path.join(os.homedir());

function grabPath() {
    let WORKING_DIR = ".cauldron";
    let pathReturn;
    if (!process.env.CAULDRON_PATH) {
        if (osCurrent === "win32") {
            pathReturn = path.join(homedir, "AppData", "Roaming", WORKING_DIR);
        } else if (osCurrent === "linux" || osCurrent === "darwin") {
            pathReturn = path.join(homedir, WORKING_DIR);
        }
    } else {
        pathReturn = path.join(process.env.CAULDRON_PATH);
    }
    shell.mkdir("-p", path.join(pathReturn));
    return pathReturn;
}

let osConvertStandard = {win32: "windows", linux: "linux", darwin: "osx"};

function getOperatingSystem(isJVM) {
    if (!isJVM) {
        let actualOS = osConvertStandard[osCurrent];
        if (!actualOS) {
            throw new Error("Unsupported Operating System");
        } else {
            return actualOS;
        }
    } else {
        let actualOS = osConvertStandard[osCurrent];
        if (!actualOS) {
            throw new Error("Unsupported Operating System");
        } else {
            if (actualOS === "linux") {
                return actualOS;
            }
            if (actualOS === "windows") {
                if (archCurrent === "x64") {
                    return "windows-x64";
                } else if (archCurrent.includes("arch")) {
                    return "windows-arm64";
                } else {
                    return "windows-x86";
                }
            }

            if (actualOS === "darwin") {
                if (archCurrent.includes("arm")) {
                    return "mac-os-arm64";
                }
            } else {
                return "macos";
            }
        }
    }
}

export {grabPath, getOperatingSystem};
