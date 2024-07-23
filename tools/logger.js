const log4js = require("log4js");
const net = require('net');
const { destroySession } = require("./sessionManager");
const port = 9500;
const path = require('path');
const { grabPath } = require("./compatibility");
const host = '127.0.0.1';
log4js.configure({
    appenders: {
        out: { type: "console" },
        file: { type: "file", filename: path.join(grabPath(),'cauldron_engine_logs','logs.log'), maxLogSize: 10485760, backups: 3, compress: true},
    },
    categories: { default: { appenders: ["out","file"], level: "debug" } },
});

const mcLogger = log4js.getLogger("Minecraft");
const cauldronLogger = log4js.getLogger('Cauldron')

const server = net.createServer();
server.listen(port, host, () => {
    cauldronLogger.info('Listening For Minecraft Instances on port ' + port + '.');
});

let sockets = [];

var loggerSession = "";

server.on('connection', function (sock) {
    cauldronLogger.info('Minecraft Connected');
    sockets.push(sock);
    sock.on('data', function (data) {
        var firstSplit = data.toString().split("\n");
        for (idx in firstSplit) {
            if (firstSplit[idx] != '') {
                var dataMessage = firstSplit[idx].split("]: ");
                if (dataMessage[1]) {
                    var state = dataMessage[0].split("/")[1];
                    switch (state) {
                        case 'INFO':
                            mcLogger.info(dataMessage[1]);
                            break;
                        case 'DEBUG':
                            mcLogger.debug(dataMessage[1]);
                            break;
                        case 'TRACE':
                            mcLogger.trace(dataMessage[1]);
                            break;
                        case 'WARN':
                            mcLogger.warn(dataMessage[1]);
                            break;
                        case 'ERROR':
                            mcLogger.error(dataMessage[1]);
                            break;
                        default:
                            mcLogger.error(dataMessage[1]);
                            break;
                    };
                };
            };
        };
    });
    sock.on('close', function (data) {
        let index = sockets.findIndex(function (o) {
            return o.remoteAddress === sock.remoteAddress && o.remotePort === sock.remotePort;
        })
        if (index !== -1) sockets.splice(index, 1);
        cauldronLogger.info('Minecraft Disconnected');
            destroySession(loggerSession);
            loggerSession = "";
        
    });
});

function setLoggerSession(id) {
    loggerSession = id;
}

module.exports = { cauldronLogger, setLoggerSession}