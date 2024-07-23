const Downloader = require("nodejs-file-downloader");
const fs = require('fs')
var lzma = require('lzma-native');
const crypto = require('crypto');
const path = require('path');
const Promise = require('bluebird');
const { download, validate, extract } = require("../tools/fileTools");
var _ = require('lodash');

async function processQueue(queue, conActions, type) {
    if (!conActions) {
        conActions = 3;
    };
    var failedActions = new Array();
    var newQueue = new Array();
    return new Promise(async (resolve) => {
        for (idx in queue) {
            var funArray = new Array();
            if (type == 'download') {
                for (rIdx in queue[idx]) {
                    funArray.push(download(queue[idx][rIdx].origin, queue[idx][rIdx].destination, queue[idx][rIdx].fileName));
                };
            } else if (type == 'checksum') {
                for (rIdx in queue[idx]) {
                    funArray.push(validate(queue[idx][rIdx]));
                };
            } else {
                for (rIdx in queue[idx]) {
                    funArray.push(extract(path.join(queue[idx][rIdx].destination, queue[idx][rIdx].fileName)));
                };
            }
            var responses = await Promise.all(funArray);

        };

        //resolve(failedActions);

    })
};

function removeItem(array, item) {
    var i = array.length;

    while (i--) {
        if (array[i] === item) {
            array.splice(i, 1);
        }
    }
}

async function handleDownloadQueue(queue) {
    console.log(queue)
};

async function handleChecksumQueue(queue) {
    return new Promise(async (resolve) => {
        console.log(queue.length)
        const res = await Promise.map(queue, validate, { concurrency: queue.length });
        removeItem(res, 'true')
        resolve(res);
    })
}


async function checkDownloadAndCheck(item) {
    return new Promise(async (resolve) => {
        var validateItem = await validate(item);
        while (typeof validateItem == 'object') {
            const downloadItem = await download(validateItem.origin,validateItem.destination,validateItem.fileName);
            validateItem = await validate(item)
        }
        resolve('pass')
    })
}

async function verifyInstallation(queue) {
    return new Promise(async (resolve) => {
        const procQueue = await Promise.map(queue, checkDownloadAndCheck, { concurrency: queue.length})
        removeItem(procQueue, 'pass');
        resolve(procQueue)
    })
}

module.exports = { processQueue, handleDownloadQueue, handleChecksumQueue, verifyInstallation }
