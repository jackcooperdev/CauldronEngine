const template = require('./manifestTemplate.json');
const osCurrent = require('os').platform();




async function attemptToConvert(original) {
    var newTemplate = template;
    // Fill Template As Much as Possible
    for (idx in newTemplate) {
        newTemplate[idx] = original[idx]
    };
    if (!newTemplate['javaVersion']) {
        javaVersion = { component: 'jre-legacy' };
        newTemplate['javaVersion'] = javaVersion;
    };
    if (original.minecraftArguments) {
        arguments['game'] = original.minecraftArguments.split(" ");
    };
    if (!newTemplate['arguments'].jvm || newTemplate['arguments'].jvm.length == 0) {
        var arguments = [
                "-Djava.library.path=${natives_directory}",
                "-Dminecraft.launcher.brand=${launcher_name}",
                "-Dminecraft.client.jar=${client_jar}",
                "-Dminecraft.launcher.version=${launcher_version}",
                "-cp",
                "${classpath}",
                "-Xmx2G",
                "-XX:+UnlockExperimentalVMOptions",
                "-XX:+UseG1GC" ,
                "-XX:G1NewSizePercent=20",
                "-XX:G1ReservePercent=20",
                "-XX:MaxGCPauseMillis=50",
                "-XX:G1HeapRegionSize=32M"
            ]
        if (osCurrent == 'win32') {
            arguments.push("-XX:HeapDumpPath=MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump");
            arguments.push("-Dos.version=10.0");
        } else if (osCurrent == 'darwin') {
            arguments.push("-XstartOnFirstThread")
        };
        newTemplate['arguments']['jvm'] = arguments;
    };
    return newTemplate;
};

module.exports = { attemptToConvert };