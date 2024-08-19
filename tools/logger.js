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
        network: { type: "tcp", host: "127.0.0.1",layout:{ type: "coloured" } },
    },
    categories: { default: { appenders: ["out","file","network"], level: "debug" } },
});

const mcLogger = log4js.getLogger("Minecraft");
const cauldronLogger = log4js.getLogger('Cauldron')


try {
    server = net.createServer();
    server.listen(port, host, () => {
        cauldronLogger.info('Listening For Minecraft Instances on port ' + port + '.');
    });
} catch {
    //do nothing 
}


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
                    var arr = dataMessage.shift();
                    switch (state) {
                        case 'INFO':
                            mcLogger.info(dataMessage.join(" "));
                            break;
                        case 'DEBUG':
                            mcLogger.debug(dataMessage.join(" "));
                            break;
                        case 'TRACE':
                            mcLogger.trace(dataMessage.join(" "));
                            break;
                        case 'WARN':
                            mcLogger.warn(dataMessage.join(" "));
                            break;
                        case 'ERROR':
                            mcLogger.error(dataMessage.join(" "));
                            break;
                        default:
                            mcLogger.error(dataMessage.join(" "));
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

server.on('error', function (sock) {
    ////console.log(sock)
})

function setLoggerSession(id) {
    loggerSession = id;
}

module.exports = { cauldronLogger, setLoggerSession}