const log4js = require("log4js");
const net = require("net");
const { createConsola } = require("consola");

const port = 9500;
const host = "127.0.0.1";
log4js.configure({
    appenders: {
        out: {type: "console"},
    }, categories: {
        default: {appenders: ["out"], level: "debug"},
    },
});


const mcLogger = log4js.getLogger("Minecraft");
const cauldronLogger = createConsola({level: 3});
let loggerSession = "";

async function startMCListening() {
    return new Promise(async (resolve, reject) => {
        let server;
        try {
            server = net.createServer();
            server.listen(port, host, () => {
                cauldronLogger.info("Listening For Minecraft Instances on port " + port + ".",);
            });
        } catch (e) {
            cauldronLogger.error(e)
        }

        let sockets = [];


        server.on("connection", function (sock) {
            cauldronLogger.info("Minecraft Connected");
            sockets.push(sock);
            sock.on("data", function (data) {
                let firstSplit = data.toString().split("\n");
                for (let idx in firstSplit) {
                    if (firstSplit[idx] !== "") {
                        let dataMessage = firstSplit[idx].split("]: ");
                        if (dataMessage[1]) {
                            let state = dataMessage[0].split("/")[1];
                            dataMessage.shift();
                            switch (state) {
                                case "INFO":
                                    mcLogger.info(dataMessage.join(" "));
                                    break;
                                case "DEBUG":
                                    mcLogger.debug(dataMessage.join(" "));
                                    break;
                                case "TRACE":
                                    mcLogger.trace(dataMessage.join(" "));
                                    break;
                                case "WARN":
                                    mcLogger.warn(dataMessage.join(" "));
                                    break;
                                case "ERROR":
                                    mcLogger.error(dataMessage.join(" "));
                                    break;
                                default:
                                    mcLogger.error(dataMessage.join(" "));
                                    break;
                            }
                        }
                    }
                }
            });
            sock.on("close", function () {
                let index = sockets.findIndex(function (o) {
                    return (o.remoteAddress === sock.remoteAddress && o.remotePort === sock.remotePort);
                });
                if (index !== -1) sockets.splice(index, 1);
                server.close();
                loggerSession = "";
                resolve(true)
            });
        });

        server.on("error", function (sock) {
            cauldronLogger.error(sock);
            reject(false);
        });
    })

}

function attachLoggerSession(id) {
    loggerSession = id;
}

module.exports =  {cauldronLogger, attachLoggerSession, startMCListening};
