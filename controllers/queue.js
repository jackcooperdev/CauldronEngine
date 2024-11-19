const Downloader = require("nodejs-file-downloader");
const fs = require('fs')
var lzma = require('lzma-native');
const crypto = require('crypto');
const path = require('path');
const Promise = require('bluebird');
const { download, validate, extract } = require("../tools/fileTools");
var _ = require('lodash');
const { startProgress, triggerProgress } = require("../tools/progress");



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
        }
        triggerProgress();
        resolve('pass')
        } catch (e) {
            console.log('supressed')
        }
        
    })
}

async function verifyInstallation(queue, isAssetDownload,supressProgress) {
    return new Promise(async (resolve) => {
        if (queue.length > 1 && !supressProgress) {
            startProgress(queue.length);
        };
        
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
