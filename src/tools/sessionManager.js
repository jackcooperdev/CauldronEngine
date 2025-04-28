// noinspection JSUnusedGlobalSymbols

let currentSessions = {};

function createUUID() {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (
            +c ^
            (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))
        ).toString(16),
    );
}

function createSession() {
    let sessionID = createUUID();
    currentSessions[sessionID] = sessionID;
    return sessionID;
}

function checkForGameSession() {
    for (let idx in currentSessions) {
        if (currentSessions[idx].type === "game") {
            return true;
        }
    }
    return false;
}

async function destroySession(sessionID) {
    try {
        if (!sessionID) {
            for (let idx in currentSessions) {
                if (currentSessions[idx].type === "game") {
                    delete currentSessions[idx];
                    return;
                }
            }
        } else {
            delete currentSessions[sessionID];
        }
    } catch (err) {
        // do nothing
    }
}

export {createSession, destroySession, checkForGameSession};
