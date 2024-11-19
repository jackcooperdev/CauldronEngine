const ws = require('ws');
const fs = require('fs');
const path = require('path');
const { grabPath } = require('./compatibility');
// This only runs with the agent. Dont worry about it.
var ws_c;
async function startProgress(queueLength) {
    try {
        if (fs.existsSync(path.join(grabPath(), 'agent_jackcooper04'))) {
            const client = new ws(`ws://localhost:8778/ws/start-progress`);
            client.on('open', () => {
                establishConnection();
                client.send(queueLength);
            });
        }

    } catch (err) {
        // do nothing
    }

}

async function triggerProgress() {
    if (ws_c) {
        ws_c.send('Hello from another function!');
      }

}

function establishConnection() {
    const socket = new ws('ws://localhost:8778/ws');
    socket.onopen = () => {
      ws_c = socket; // Assign the socket to the global variable
      console.log('Connected');
    };
  }

module.exports = { startProgress, triggerProgress }