# Cauldron Engine

> This Documentation is correct for version [0.6.3](https://github.com/jackcooperdev/CauldronEngine/releases/tag/0.6.3)
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

| Name                                                                     | Import                                        | Description                                   |
|--------------------------------------------------------------------------|-----------------------------------------------|-----------------------------------------------|
| [Launcher](https://docs.cauldronmc.com/engine/controllers/launcher)      | ```@jackcooperdev/cauldronengine/launcher```  | Manages the launching of a Minecraft Instance |
| [Manifest](https://docs.cauldronmc.com/engine/controllers/manifest)      | ```@jackcooperdev/cauldronengine/manifest```  | Acquires Relevant Data for launch             |
| [Assets](https://docs.cauldronmc.com/engine/controllers/asset)           | ```@jackcooperdev/cauldronengine/assets```    | Manages Asset Download                        |
| [JVM](https://docs.cauldronmc.com/engine/controllers/jvm)                | ```@jackcooperdev/cauldronengine/jvm```       | Manages JVM Download                          |
| [Libraries](https://docs.cauldronmc.com/engine/controllers/library)      | ```@jackcooperdev/cauldronengine/libraries``` | Manages Library Download                      |
| [Queue Management](https://docs.cauldronmc.com/engine/controllers/queue) | ```@jackcooperdev/cauldronengine/queue```     | Manages Download Queues                       |

### Tools

| Name                                                                    | Import                                          | Description                                 |
|-------------------------------------------------------------------------|-------------------------------------------------|---------------------------------------------|
| [Logger](https://docs.cauldronmc.com/engine/tools/logger)               | ```@jackcooperdev/cauldronengine/logger```      | Logging                                     |
| [Compatability](https://docs.cauldronmc.com/engine/tools/compat)        | ```@jackcooperdev/cauldronengine/compat```      | Tool to Ensure Cross-Platform Compatability |
| [File Tools](https://docs.cauldronmc.com/engine/tools/file)             | ```@jackcooperdev/cauldronengine/fileTools```   | Set of Tools to download / verify files     |
| [Session Manager](https://docs.cauldronmc.com/engine/tools/session)     | ```@jackcooperdev/cauldronengine/session```     | Manages Minecraft Sessions                  |
| [Check Connection](https://docs.cauldronmc.com/engine/tools/connection) | ```@jackcooperdev/cauldronengine/online```      | Checks if Client is Online                  |
| [Launch File Builder](https://docs.cauldronmc.com/engine/tools/launch)  | ```@jackcooperdev/cauldronengine/launchBuild``` | Builds launch File                          |


## Information

For information on how a launcher works, this blog post by Ryan Cao explains it brilliantly.
[Inside a Minecraft Launcher](https://ryanccn.dev/posts/inside-a-minecraft-launcher/)

Wiki.vg was a great resource that provided lots of information on how various parts of Minecraft works.
It has been merged into Minecraft Wiki
and can be viewed [here](https://minecraft.wiki/w/Microsoft_authentication#Navigation)