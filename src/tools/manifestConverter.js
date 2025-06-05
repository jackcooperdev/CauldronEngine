import {grabPath} from "./compatibility.js";
import template from "../files/manifestTemplate.json" with {type: "json"};

import path from "path";
import os from "os";

const osCurrent = os.platform();

async function addOSSpecArguments(original) {
    console.log('run')
    if (osCurrent === "win32") {
        original.arguments.jvm.push(
            "-XX:HeapDumpPath=MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump",
        );
        original.arguments.jvm.push("-Dos.version=10.0");
    } else if (osCurrent === "darwin") {
        // Unsure if needed on newer Mac versions. require hardware to test
        // Disabling for now
        //arguments.push("-XstartOnFirstThread")
    }
    return original;
}

async function convertAssets(original) {
    return new Promise(async (resolve) => {
        let CAULDRON_PATH = grabPath();
        let objs = original.objects;
        let newData = [];
        for (let idx in objs) {
            let obj = {
                origin: `https://resources.download.minecraft.net/${objs[idx].hash.substring(0, 2)}/${objs[idx].hash}`,
                sha1: objs[idx].hash,
                destination: path.join(
                    CAULDRON_PATH,
                    "assets",
                    "objects",
                    objs[idx].hash.substring(0, 2),
                ),
                fileName: objs[idx].hash,
            };
            newData.push(obj);
        }
        resolve(newData);
    });
}

async function convertLegacyAssets(original) {
    return new Promise(async (resolve) => {
        let CAULDRON_PATH = grabPath();
        let objs = original.objects;
        let newData = [];
        for (let idx in objs) {
            let splitPath = idx.split("/");
            let fileName = splitPath.pop();
            let obj = {
                origin: `https://resources.download.minecraft.net/${objs[idx].hash.substring(0, 2)}/${objs[idx].hash}`,
                sha1: objs[idx].hash,
                destination: path.join(
                    CAULDRON_PATH,
                    "assets",
                    "virtual",
                    "legacy",
                    splitPath.join("/"),
                ),
                fileName: fileName,
            };
            newData.push(obj);
        }
        resolve(newData);
    });
}

async function convertPre16Assets(original) {
    return new Promise(async (resolve) => {
        let CAULDRON_PATH = grabPath();
        let objs = original.objects;
        let newData = [];
        for (let idx in objs) {
            let splitPath = idx.split("/");
            let fileName = splitPath.pop();
            let obj = {
                origin: `https://resources.download.minecraft.net/${objs[idx].hash.substring(0, 2)}/${objs[idx].hash}`,
                sha1: objs[idx].hash,
                destination: path.join(CAULDRON_PATH, "resources", splitPath.join("/")),
                fileName: fileName,
            };
            newData.push(obj);
        }
        resolve(newData);
    });
}

export {
    addOSSpecArguments,
    convertAssets,
    convertLegacyAssets,
    convertPre16Assets,
};
