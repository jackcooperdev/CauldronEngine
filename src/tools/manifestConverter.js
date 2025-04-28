import {grabPath} from "./compatibility.js";
import template from "../files/manifestTemplate.json" with {type: "json"};

import path from "path";
import os from "os";

const osCurrent = os.platform();

async function attemptToConvert(original) {
    let newTemplate = template;
    // Fill Template As Much as Possible
    for (let idx in newTemplate) {
        newTemplate[idx] = original[idx];
    }
    let javaVersion;
    if (!newTemplate["javaVersion"]) {
        javaVersion = {component: "jre-legacy"};
        newTemplate["javaVersion"] = javaVersion;
    }

    if (
        !newTemplate["arguments"] ||
        !newTemplate["arguments"].jvm ||
        newTemplate["arguments"].jvm.length === 0
    ) {
        let template_arguments = [
            "-Djava.library.path=${natives_directory}",
            "-Dminecraft.launcher.brand=${launcher_name}",
            "-Dminecraft.client.jar=${client_jar}",
            "-Dminecraft.launcher.version=${launcher_version}",
            "-cp",
            "${classpath}",
            "-Xmx${ram}G",
            "-XX:+UnlockExperimentalVMOptions",
            "-XX:+UseG1GC",
            "-XX:G1NewSizePercent=20",
            "-XX:G1ReservePercent=20",
            "-XX:MaxGCPauseMillis=50",
            "-XX:G1HeapRegionSize=32M",
        ];
        if (osCurrent === "win32") {
            template_arguments.push(
                "-XX:HeapDumpPath=MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump",
            );
            template_arguments.push("-Dos.version=10.0");
        } else if (osCurrent === "darwin") {
            //arguments.push("-XstartOnFirstThread")
        }
        if (!newTemplate["arguments"]) {
            newTemplate["arguments"] = {};
        }
        newTemplate["arguments"]["jvm"] = template_arguments;
        if (original.minecraftArguments) {
            //gameArguments['game'] =
            newTemplate["arguments"]["game"] = original.minecraftArguments.split(" ");
        }
    }
    return newTemplate;
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
    attemptToConvert,
    convertAssets,
    convertLegacyAssets,
    convertPre16Assets,
};
