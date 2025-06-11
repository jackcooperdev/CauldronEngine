---
title: Cauldron Engine
description: 'Index page for Cauldron Engine'
---

> This Documentation is correct for version [0.6.0](https://github.com/jackcooperdev/CauldronEngine/releases/tag/0.6.0)
> of CauldronEngine

## What does this do?

Cauldron Engine is a Node.js based minecraft launcher. It handles downloading and booting Minecraft Instances. It
supports all vanilla versions of minecraft. Additionally, there is support for plugins where additional loaders (such as
forge) can be booted.

## License Information

This project is licensed under [GPL 3.0](https://choosealicense.com/licenses/gpl-3.0/) so please make sure that your
project follows the license guidelines.

## Setup

To Install the package, run the following command

```
npm i @jackcooperdev/cauldronengine
```

## Using CauldronEngine

Cauldron Engine is split into multiple exports. They are listed below.

### Controllers

| Name                                          | Import                                        | Description                                   |
|-----------------------------------------------|-----------------------------------------------|-----------------------------------------------|
| [Launcher](/engine/controllers/launcher)      | ```@jackcooperdev/cauldronengine/launcher```  | Manages the launching of a Minecraft Instance |
| [Manifest](/engine/controllers/manifest)      | ```@jackcooperdev/cauldronengine/manifest```  | Acquires Relevant Data for launch             |
| [Assets](/engine/controllers/asset)           | ```@jackcooperdev/cauldronengine/assets```    | Manages Asset Download                        |
| [JVM](/engine/controllers/jvm)                | ```@jackcooperdev/cauldronengine/jvm```       | Manages JVM Download                          |
| [Libraries](/engine/controllers/library)      | ```@jackcooperdev/cauldronengine/libraries``` | Manages Library Download                      |
| [Queue Management](/engine/controllers/queue) | ```@jackcooperdev/cauldronengine/queue```     | Manages Download Queues                       |

### Tools

| Name                                         | Import                                          | Description                                 |
|----------------------------------------------|-------------------------------------------------|---------------------------------------------|
| [Logger](/engine/tools/logger)               | ```@jackcooperdev/cauldronengine/logger```      | Logging                                     |
| [Compatability](/engine/tools/compat)        | ```@jackcooperdev/cauldronengine/compat```      | Tool to Ensure Cross-Platform Compatability |
| [File Tools](/engine/tools/file)             | ```@jackcooperdev/cauldronengine/fileTools```   | Set of Tools to download / verify files     |
| [Session Manager](/engine/tools/session)     | ```@jackcooperdev/cauldronengine/session```     | Manages Minecraft Sessions                  |
| [Check Connection](/engine/tools/connection) | ```@jackcooperdev/cauldronengine/online```      | Checks if Client is Online                  |
| [Launch File Builder](/engine/tools/launch)  | ```@jackcooperdev/cauldronengine/launchBuild``` | Builds launch File                          |


## Information

For information on how a launcher works, this blog post by Ryan Cao explains it brilliantly.
[Inside a Minecraft Launcher](https://ryanccn.dev/posts/inside-a-minecraft-launcher/)

Wiki.vg was a great resource that provided lots of information on how various parts of Minecraft works.
It has been merged into Minecraft Wiki
and can be viewed [here](https://minecraft.wiki/w/Microsoft_authentication#Navigation)