const fs = require('fs');
const path = require('path');
const shelljs = require('shelljs');
const { grabPath } = require('./compatibility');

var currentSessions = {};


function createUUID() {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
        (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
    );
};

function createSession(data) {
    var newSession = data;
    var sessionID = createUUID();
    currentSessions[sessionID] = newSession;
    shelljs.mkdir('-p', path.join(grabPath(), 'sessionLogs', sessionID));
    return sessionID;
};

function checkForGameSession() {
    for (idx in currentSessions) {
        if (currentSessions[idx].type == 'game') {
            return true;
        }
    };
    return false;
}



function getSession(sessionID) {
    return currentSessions[sessionID];
};

async function destroySession(sessionID) {
    try {
        fs.writeFileSync(path.join(grabPath(), 'sessionLogs', sessionID, 'info.json'), JSON.stringify(currentSessions[sessionID]));     
    } catch (err) {
        
    }
    delete currentSessions[sessionID];
};


module.exports = { createSession, getSession, destroySession, createUUID,checkForGameSession };