const fs = require('fs');
const path = require('path');
const shell = require('shelljs');
const conifgMain = require('../config.json')
const homedir = require('os').homedir()
const { cauldronLogger } = require('../tools/logger');
const { grabPath } = require('../tools/compatibility');
var CAULDRON_PATH = grabPath();
const { checkForValidFiles,downloadVersionManifests } = require('../tools/downloader');
const { processQueue } = require('./queue');

async function getAssets(assetsIndex, assetUrl) {
    return new Promise(async (resolve) => {
        if (assetsIndex != "legacy") {
            var createIndexsFolder = shell.mkdir('-p', path.join(CAULDRON_PATH, 'assets', 'indexes'))
            var createObjectsFolder = shell.mkdir('-p', path.join(CAULDRON_PATH, 'assets', 'objects'))
            const assetFiles = await downloadVersionManifests(assetUrl, true, path.join('assets', 'indexes'), assetsIndex);
            var objects = assetFiles.objects;
            var dQueue = new Array();
            for (idx in objects) {
                // Create Dirs and Create Dirs
                shell.mkdir('-p', path.join(CAULDRON_PATH, 'assets', 'objects', objects[idx].hash.substring(0, 2)));
                var obj = {
                    origin: `https://resources.download.minecraft.net/${objects[idx].hash.substring(0, 2)}/${objects[idx].hash}`,
                    sha1: objects[idx].hash,
                    destination: path.join(CAULDRON_PATH, 'assets', 'objects', objects[idx].hash.substring(0, 2)),
                    fileName: objects[idx].hash
                };
                dQueue.push(obj);
            };
            (dQueue)
            var checkForFiles = await processQueue(dQueue, 1000, 'checksum');
            (checkForFiles)
            while (checkForFiles.length != 0) {
                cauldronLogger.info(`Total Files (${dQueue.length}) Files to Download (${checkForFiles.length})`);
                cauldronLogger.info('Downloading Files');
                const handleDownload = await processQueue(checkForFiles, 2000, 'download');
                checkForFiles = await processQueue(checkForFiles, 1000, 'checksum');
            };
            cauldronLogger.info(`Checksums Passed Install is Valid!`);
        } else if (assetsIndex == "legacy") {
            cauldronLogger.info('Handling Legacy Assets');
            const assetFiles = await downloadVersionManifests(assetUrl, true, path.join('assets', 'indexes'), assetsIndex);
            var createVirtualFolder = shell.mkdir('-p', path.join(CAULDRON_PATH, 'assets', 'virtual', 'legacy'))
            var objects = assetFiles.objects;
            var dQueue = new Array();
            for (idx in objects) {
                // Create Dirs and Create Dirs
                var cutPath = idx.split("/");
                popped = cutPath.pop();
                shell.mkdir('-p', path.join(CAULDRON_PATH, 'assets', 'virtual', 'legacy', cutPath.join("/")));
                var obj = {
                    origin: `https://resources.download.minecraft.net/${objects[idx].hash.substring(0, 2)}/${objects[idx].hash}`,
                    sha1: objects[idx].hash,
                    destination: path.join(CAULDRON_PATH, 'assets', 'virtual', 'legacy', cutPath.join("/")),
                    fileName: popped
                };
                dQueue.push(obj);
            };
            var checkForFiles = await processQueue(dQueue, 1000, 'checksum');
            (checkForFiles)
            while (checkForFiles.length != 0) {
                cauldronLogger.info(`Total Files (${dQueue.length}) Files to Download (${checkForFiles.length})`);
                cauldronLogger.info('Downloading Files');
                const handleDownload = await processQueue(checkForFiles, 2000, 'download');
                checkForFiles = await processQueue(checkForFiles, 1000, 'checksum');
            };
            cauldronLogger.info(`Checksums Passed Install is Valid!`);
        };
        if (assetsIndex == 'pre-1.6') {
            // Pre 1.6 (Stream To Resources)
            cauldronLogger.info('Pre 1.6 Assets');
            const assetFiles = await downloadVersionManifests(assetUrl, true, path.join('assets', 'indexes'), assetsIndex);
            var createResources  = shell.mkdir('-p', path.join(CAULDRON_PATH, 'resources'))
            var objects = assetFiles.objects;
            var dQueue = new Array();
            for (idx in objects) {
                // Create Dirs and Create Dirs
                var cutPath = idx.split("/");
                popped = cutPath.pop();
                shell.mkdir('-p', path.join(CAULDRON_PATH, 'resources', cutPath.join("/")));
                var obj = {
                    origin: `https://resources.download.minecraft.net/${objects[idx].hash.substring(0, 2)}/${objects[idx].hash}`,
                    sha1: objects[idx].hash,
                    destination: path.join(CAULDRON_PATH, 'resources', cutPath.join("/")),
                    fileName: popped
                };
                dQueue.push(obj);
            };
            var checkForFiles = await processQueue(dQueue, 1000, 'checksum');
            (checkForFiles)
            while (checkForFiles.length != 0) {
                cauldronLogger.info(`Total Files (${dQueue.length}) Files to Download (${checkForFiles.length})`);
                cauldronLogger.info('Downloading Files');
                const handleDownload = await processQueue(checkForFiles, 2000, 'download');
                checkForFiles = await processQueue(checkForFiles, 1000, 'checksum');
            };
            cauldronLogger.info(`Checksums Passed Install is Valid!`);
            resolve(true);
        } else {
            resolve(true)
        }

    })

}


module.exports = { getAssets };