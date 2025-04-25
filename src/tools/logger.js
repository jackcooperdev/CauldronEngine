import log4js from "log4js";
import net from "net";
import { destroySession } from "./sessionManager.js";
import createLogger from 'logging';
import logging from 'logging';
const port = 9500;
import path from "path";
import { grabPath } from "./compatibility.js";
import { createConsola } from "consola";
const host = "127.0.0.1";
log4js.configure({
  appenders: {
    out: { type: "console" },
  },
  categories: {
    default: { appenders: ["out"], level: "debug" },
  },
});
const mcLogger = log4js.getLogger("Minecraft");
const cauldronLogger = createConsola({level:3});
let loggerSession = "";
function startMCListening() {
  let server;
  try {
    server = net.createServer();
    server.listen(port, host, () => {
      cauldronLogger.info(
        "Listening For Minecraft Instances on port " + port + ".",
      );
    });
  } catch {
    //do nothing
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
        return (
          o.remoteAddress === sock.remoteAddress &&
          o.remotePort === sock.remotePort
        );
      });
      if (index !== -1) sockets.splice(index, 1);
      cauldronLogger.info("Minecraft Disconnected");
      destroySession(loggerSession).then(function () {});
      server.close();
      loggerSession = "";
    });
  });

  server.on("error", function (sock) {
    cauldronLogger.error(sock);
  });
}

function attachLoggerSession(id) {
  loggerSession = id;
}

export { cauldronLogger, attachLoggerSession, startMCListening };
