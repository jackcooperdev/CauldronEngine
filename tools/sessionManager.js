const fs = require('fs');

var CURRENT_SESSION_ID = "";
var CURRENT_SESSION_DATA = {};

function uuidv4() {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
        (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
    );
};

function createSession(data) {
    CURRENT_SESSION_ID = uuidv4();
    CURRENT_SESSION_DATA = data;
    return CURRENT_SESSION_ID;
};



function getSession() {
    return {data:CURRENT_SESSION_DATA,id:CURRENT_SESSION_ID};
};

async function destroySession() {
    CURRENT_SESSION_DATA = {};
    console.log('session dest')
    CURRENT_SESSION_ID = undefined;
};


module.exports = { createSession,getSession, destroySession };