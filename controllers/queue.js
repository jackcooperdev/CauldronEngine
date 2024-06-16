const Downloader = require("nodejs-file-downloader");
const fs = require('fs')
var lzma = require('lzma-native');
const crypto = require('crypto');
const path = require('path');
const { download, validate, extract } = require("../tools/downloader");

const chunk = (arr, size) =>
    Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
        arr.slice(i * size, i * size + size)
    );
async function processQueue(queue, conActions, type) {
    if (!conActions) {
        conActions = 3;
    };
    var failedActions = new Array();
    var newQueue = new Array();
    return new Promise(async (resolve) => {
        var chunkedQueue = chunk(queue, conActions);
        (chunkedQueue.length)
        for (idx in chunkedQueue) {
            // Fill Chunk with dummy fields if not full
            while (chunkedQueue[idx].length != conActions) {
                chunkedQueue[idx].push({ origin: 'no file', destination: 'no path', fileName: 'noName' })
            };
            var funArray = new Array();
            if (type == 'download') {
                for (rIdx in chunkedQueue[idx]) {
                    funArray.push(download(chunkedQueue[idx][rIdx].origin, chunkedQueue[idx][rIdx].destination, chunkedQueue[idx][rIdx].fileName));
                };
            } else if (type == 'checksum') {
                for (rIdx in chunkedQueue[idx]) {
                    funArray.push(validate(chunkedQueue[idx][rIdx]));
                };
            } else {
                for (rIdx in chunkedQueue[idx]) {
                    funArray.push(extract(path.join(chunkedQueue[idx][rIdx].destination, chunkedQueue[idx][rIdx].fileName)));
                };
            }
            var responses = await Promise.all(funArray);
            //Check responses for errors
            for (resIdx in responses) {
                (responses[resIdx])
                if (responses[resIdx].origin) {
                    (responses[resIdx])
                    failedActions.push(chunkedQueue[idx][resIdx]);
                }
            };
        };

        resolve(failedActions);

    })
};


module.exports = { processQueue }
