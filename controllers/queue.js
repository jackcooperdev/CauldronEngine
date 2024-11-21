const Downloader = require("nodejs-file-downloader");
const fs = require('fs')
var lzma = require('lzma-native');
const crypto = require('crypto');
const path = require('path');
const Promise = require('bluebird');
const { download, validate, extract } = require("../tools/fileTools");
var _ = require('lodash');
const { cauldronLogger } = require("../tools/logger");



function removeItem(array, item) {
    var i = array.length;

    while (i--) {
        if (array[i] === item) {
            array.splice(i, 1);
        }
    }
}






async function checkDownloadAndCheck(item) {
    return new Promise(async (resolve) => {
        try {
            var validateItem = await validate(item);
        while (typeof validateItem == 'object') {
            const downloadItem = await download(validateItem.origin,validateItem.destination,validateItem.fileName);
            validateItem = await validate(item)
        };
        resolve('pass')
        } catch (e) {
            cauldronLogger.error(e);
        }
        
    })
}

async function verifyInstallation(queue, isAssetDownload) {
    return new Promise(async (resolve) => {
        var concurrency = queue.length;
        if (isAssetDownload) {
            concurrency = queue.length / 2;
        };
        const procQueue = await Promise.map(queue, checkDownloadAndCheck, { concurrency: concurrency})
        removeItem(procQueue, 'pass');
        resolve(procQueue)
    })
}

module.exports = { verifyInstallation }
