---
title: Cauldron Engine
description: 'Index page for Cauldron Engine'
---

# Cauldron Engine

> This Documentation is correct for version [0.5.4](https://github.com/jackcooper04/CauldronEngine/releases/tag/0.5.4) of CauldronEngine

## What does this do?
Cauldron Engine is a Node.js based minecraft launcher. It handles downloading and booting Minecraft Instances. It supports all vanilla versions of minecraft. Additionally, there is support for plugins where additional loaders (such as forge) can be booted.

## License Information
This project is licensed under [GPL 3.0](https://choosealicense.com/licenses/gpl-3.0/) so please make sure that your project follows the license guidelines.

## Setup

To Install the package, run the following command

```
npm i @jackcooper04/cauldronengine
```

## Using CauldronEngine

Cauldron Engine is split into multiple exports. They are listed below.

### Controllers

| Name                                                                     | Import                                       | Description                                   |
|--------------------------------------------------------------------------|----------------------------------------------|-----------------------------------------------|
| [Launcher](https://docs.cauldronmc.com/engine/controllers/launcher)      | ```@jackcooper04/cauldronengine/launcher```  | Manages the launching of a Minecraft Instance |
| [Manifest](https://docs.cauldronmc.com/engine/controllers/manifest)      | ```@jackcooper04/cauldronengine/manifest```  | Acquires Relevant Data for launch             |
| [Assets](https://docs.cauldronmc.com/engine/controllers/asset)           | ```@jackcooper04/cauldronengine/assets```    | Manages Asset Download                        |
| [JVM](https://docs.cauldronmc.com/engine/controllers/jvm)                | ```@jackcooper04/cauldronengine/jvm```       | Manages JVM Download                          |
| [Libraries](https://docs.cauldronmc.com/engine/controllers/library)      | ```@jackcooper04/cauldronengine/libraries``` | Manages Library Download                      |
| [Queue Management](https://docs.cauldronmc.com/engine/controllers/queue) | ```@jackcooper04/cauldronengine/queue```     | Manages Download Queues                       |

### Tools

| Name                                                                    | Import                                         | Description                                 |
|-------------------------------------------------------------------------|------------------------------------------------|---------------------------------------------|
| [Logger](https://docs.cauldronmc.com/engine/tools/logger)               | ```@jackcooper04/cauldronengine/logger```      | Logging                                     |
| [Compatability](https://docs.cauldronmc.com/engine/tools/compat)        | ```@jackcooper04/cauldronengine/compat```      | Tool to Ensure Cross-Platform Compatability |
| [File Tools](https://docs.cauldronmc.com/engine/tools/file)             | ```@jackcooper04/cauldronengine/fileTools```   | Set of Tools to download / verify files     |
| [Session Manager](https://docs.cauldronmc.com/engine/tools/session)     | ```@jackcooper04/cauldronengine/session```     | Manages Minecraft Sessions                  |
| [Check Connection](https://docs.cauldronmc.com/engine/tools/connection) | ```@jackcooper04/cauldronengine/online```      | Checks if Client is Online                  |
| [Auth Verifier](https://docs.cauldronmc.com/engine/tools/auth)          | ```@jackcooper04/cauldronengine/auth```        | Check Access Token Validity                 |
| [Launch File Builder](https://docs.cauldronmc.com/engine/tools/launch)  | ```@jackcooper04/cauldronengine/launchBuild``` | Builds launch File                          |


### Plugins

Plugins are used to allow for other loaders to be used for more information go [here]().



## Information

For information on how a launcher works, this blog post by Ryan Cao explains it brilliantly.
[Inside a Minecraft Launcher](https://ryanccn.dev/posts/inside-a-minecraft-launcher/)

Wiki.vg was a great resource that provided lots of information on how various parts of Minecraft works.
It has been merged into Minecraft Wiki
and can be viewed [here](https://minecraft.wiki/w/Microsoft_authentication#Navigation)