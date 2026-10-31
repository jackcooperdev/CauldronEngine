# Cauldron Engine

> This Documentation is correct for version [0.16.0](https://github.com/jackcooperdev/CauldronEngine)
> of CauldronEngine

## What does this do?

Cauldron Engine is a Node.js based minecraft launcher. It handles downloading and booting Minecraft Instances. It
supports all vanilla versions of minecraft. Additionally, the following loaders are supported:

+ `vanilla`
+ `forge`
+ `fabric`
+ `neoforge`

## License Information

This project is licensed under [GPL 3.0](https://choosealicense.com/licenses/gpl-3.0/) so please make sure that your
project follows the license guidelines.

## Setup

To Install the package, run the following command

```
npm i @jackcooperdev/cauldronengine
```

## Quick Start

```js
const { startGame } = require('@jackcooperdev/cauldronengine/client');

// Installs (if needed) and boots a 1.20.1 Forge client
const sessionID = await startGame('1.20.1', { type: 'forge' }, authData);
```

See the [Client](https://docs.cauldronmc.com/engine/controllers/client) controller for more information.

## Using CauldronEngine

Cauldron Engine is split into multiple exports. They are listed below.

### Controllers

| Name                                          | Import                                       | Description                                         |
|-----------------------------------------------|----------------------------------------------|-----------------------------------------------------|
| [Client](https://docs.cauldronmc.com/engine/controllers/client)          | ```@jackcooperdev/cauldronengine/client```   | Installs and launches a Minecraft Client            |
| [Manifest](https://docs.cauldronmc.com/engine/controllers/manifest)      | ```@jackcooperdev/cauldronengine/manifest``` | Acquires Relevant Data for install and launch       |
| [Queue Management](https://docs.cauldronmc.com/engine/controllers/queue) | ```@jackcooperdev/cauldronengine/queue```    | Manages Download Queues                             |

### Tools

| Name                                         | Import                                          | Description                                 |
|----------------------------------------------|-------------------------------------------------|---------------------------------------------|
| [Logger](https://docs.cauldronmc.com/engine/tools/logger)               | ```@jackcooperdev/cauldronengine/logger```      | Logging                                     |
| [Compatibility](https://docs.cauldronmc.com/engine/tools/compat)        | ```@jackcooperdev/cauldronengine/compat```      | Tool to Ensure Cross-Platform Compatibility |
| [File Tools](https://docs.cauldronmc.com/engine/tools/file)             | ```@jackcooperdev/cauldronengine/fileTools```   | Set of Tools to download / verify files     |
| [Check Connection](https://docs.cauldronmc.com/engine/tools/connection) | ```@jackcooperdev/cauldronengine/online```      | Checks if Client is Online                  |
| [Launch File Builder](https://docs.cauldronmc.com/engine/tools/launch)  | ```@jackcooperdev/cauldronengine/launchbuild``` | Builds launch File                          |

### Environment Variables

| Variable          | Description                                                                 | Default                            |
|-------------------|-----------------------------------------------------------------------------|------------------------------------|
| `CAULDRON_PATH`   | Root folder used for all installed files. See [grabPath](https://docs.cauldronmc.com/engine/tools/compat#grabpath) | `.cauldron` in the user's home / AppData folder |
| `RESOURCE_SERVER` | Server used to fetch version specs, loader manifests and post processors    | `https://resources.cauldronmc.com` |

## Offline Use

Versions that have been installed while online can be installed and launched without an internet connection.
The engine saves the version manifests and a verified copy of each version's install data
([version.ce](https://docs.cauldronmc.com/engine/controllers/manifest#versionce)) in the Cauldron folder for this.

`release` and `snapshot` resolve to the latest versions that were known the last time the engine was online.

If a file is missing while offline, installing fails with:

```
Version Installation is corrupted! Please Reinstall with a stable internet connection. Issue With: <url>
```

## Migrating from 0.6.x

Version 0.13.0 reworked the engine around a single install object. The following exports have been removed:

| Removed                          | Replacement                                                        |
|----------------------------------|--------------------------------------------------------------------|
| `launcher` (`launchGame`)        | [`client`](https://docs.cauldronmc.com/engine/controllers/client) (`startGame`, `installGame`) |
| `assets` (`getAssets`)           | Handled by [`installGame`](https://docs.cauldronmc.com/engine/controllers/client#installgame-version-loaderinfo) |
| `jvm` (`checkJVM`, `checkCompat`) | Handled by [`installGame`](https://docs.cauldronmc.com/engine/controllers/client#installgame-version-loaderinfo) |
| `libraries` (`getLibraries`)     | Handled by [`installGame`](https://docs.cauldronmc.com/engine/controllers/client#installgame-version-loaderinfo) |
| `session` (Session Manager)      | Session IDs are now returned by [`startGame`](https://docs.cauldronmc.com/engine/controllers/client#startgame-version-loaderinfo-authinfo-overrides) |
| `manifest` (`getManifests`, `checkManifest`, `getPackwizJVM`) | [`getCEObject`](https://docs.cauldronmc.com/engine/controllers/manifest#getceobject-installobject) |

The format of the authentication data passed to the engine has also changed.
See [Auth Info](/engine/controllers/client#auth-info).

## Information

For information on how a launcher works, this blog post by Ryan Cao explains it brilliantly.
[Inside a Minecraft Launcher](https://ryanccn.dev/posts/inside-a-minecraft-launcher/)

Wiki.vg was a great resource that provided lots of information on how various parts of Minecraft works.
It has been merged into Minecraft Wiki
and can be viewed [here](https://minecraft.wiki/w/Microsoft_authentication#Navigation)
