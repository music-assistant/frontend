<p align="center">
  <p align="center">
   <img width="150" height="150" src="app-icon.png" alt="Logo">
  </p>
	<h1 align="center"><b>Music Assistant Companion</b></h1>
	 <p align="center" style="margin-bottom:0px !important;">
	<a href="https://github.com/music-assistant/music-assistant-desktop/releases/latest">
	  <img src="https://img.shields.io/github/release/music-assistant/music-assistant-desktop?display_name=tag&include_prereleases&label=Latest%20version" alt="latest version">
	</a>
	<a href="https://discord.gg/kaVm8hGpne">
	  <img src="https://img.shields.io/discord/753947050995089438?label=Discord&logo=discord&color=5865F2" alt="discord">
	</a>
	<a href="https://github.com/sponsors/music-assistant">
	  <img src="https://img.shields.io/github/sponsors/music-assistant?label=Sponsors" alt="sponsor">
	</a>
	<a href="https://github.com/music-assistant/music-assistant-desktop/blob/main/LICENSE">
    	<img src="https://img.shields.io/static/v1?label=Licence&message=Apache-2.0&color=000" />
  	</a>
	<img src="https://img.shields.io/static/v1?label=Bundled%20Size&message=9.45MB&color=0974B4" />
  	<img src="https://img.shields.io/static/v1?label=Stage&message=Alpha&color=2BB4AB" />
	 </p>
	<p align="center">
		The desktop companion app for Music Assistant!
    <br />
    <a href="https://music-assistant.io/"><strong>Music Assistant »</strong></a>
    <br />
    <br />
    <b>Download for </b>
    macOS (<a href="https://github.com/music-assistant/music-assistant-desktop/releases/download/v0.0.70/Music.Assistant.Companion_0.0.45_aarch64.dmg">Apple Silicon</a> |
    <a href="https://github.com/music-assistant/music-assistant-desktop/releases/download/v0.0.70/Music.Assistant.Companion_0.0.45_x64.dmg">Intel</a>) ·
		<a href="https://github.com/music-assistant/music-assistant-desktop/releases/download/v0.0.70/Music.Assistant.Companion_0.0.45_x64_en-US.msi">Windows</a> ·
    Linux (<a href="https://github.com/music-assistant/music-assistant-desktop/releases/download/v0.0.70/music-assistant-companion_0.0.45_amd64.deb">Debian</a> | <a href="https://github.com/music-assistant/music-assistant-desktop/releases/download/v0.0.70/music-assistant-companion_0.0.45_amd64.AppImage">Other</a>)
    <br />
  </p>
</p>

## Setup

When starting the app for the first time you are asked about some information about the Music Assistant Server.

![image](https://github.com/music-assistant/desktop-companion/assets/74015378/cb97aa3e-12d8-4992-bfc6-0b58cedb81da)

> [!IMPORTANT]
> The app requires that the webserver is exposed. You can set that in the settings:
> ![How to fix](https://raw.githubusercontent.com/music-assistant/desktop-companion/main/cant_connect_error.gif)

<!-- ## Features -->

<!-- ### [Squeezelite](https://en.wikipedia.org/wiki/Squeezelite)

Squeezelite comes embedded in the application. This allows playback of music to your computer. The player name will be the same as your computer name. You can change the name in Music Assistant settings. You can also toggle if you wish to enable squeezelite at all.

To allow playback to the companion app you have to enable the slimproto provider in the Music Assistant settings. -->

<!-- ### [Discord Rich Presence](https://discord.com/developers/docs/rich-presence/how-to#so-what-is-it)

Like the Spotify app, the Music Assistant app can do Discord Rich Presence.

Example of Discord Rich Presence:

![Example of Discord Rich Presence](https://github.com/music-assistant/companion/assets/74015378/8de18bac-b963-4aba-bb61-5730b41759a9) -->

## Installation

### Windows

You can download the .msi installer from the [releases](https://github.com/music-assistant/desktop-companion/releases/latest/).

### MacOS

You can download the .dmg from the [releases](https://github.com/music-assistant/desktop-companion/releases/latest/).

Or you can download it using homebrew: `brew install music-assistant/tap/companion`

<!-- ### Arch Linux

This app is on the arch aur with the name `music-assistant-desktop` or `music-assistant-desktop-bin` for just the binary

You can install it with yay: `yay music-assistant-desktop-bin` -->

### Debian (And debian based distrobutions)

You can download the .deb from the [releases](https://github.com/music-assistant/companion/releases/latest/).

### All the other linux distros

You can download the AppImage from the [releases](https://github.com/music-assistant/companion/releases/latest/).

### From source

If you wish to build the app yourself you should first follow [the offical tauri prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites)

First, clone the repository and install the node dependencies. You can do this by running the following commands:

```bash
$ git clone https://github.com/music-assistant/desktop-companion
$ cd desktop-companion
$ yarn install
```

And then build the app

`$ yarn tauri build`

# Contributing

Check the CONTRIBUTING.md file

---

[![A project from the Open Home Foundation](https://www.openhomefoundation.org/badges/ohf-project.png)](https://www.openhomefoundation.org/)