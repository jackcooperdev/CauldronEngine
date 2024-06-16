const fs = require('fs');
const { grabPath } = require('./compatibility');
const path = require('path');
var CAULDRON_PATH = grabPath()

var CURRENT_SESSION_ID = "";

function uuidv4() {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
        (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
    );
};

function createSession() {
    CURRENT_SESSION_ID = uuidv4();
    return CURRENT_SESSION_ID;
};

function getSession() {
    return CURRENT_SESSION_ID;
};

async function destroySession() {
    const destroy = await fs.promises.rm(path.join(CAULDRON_PATH,'bin',CURRENT_SESSION_ID), { recursive: true, force: true });
    CURRENT_SESSION_ID = "";
};


module.exports = { createSession,getSession, destroySession };