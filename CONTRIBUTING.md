# Music Assistant Companion Contributing Guide

Thank you for your interest in contributing to the Music Assistant Companion! This guide will provide you with the necessary information to get started.

## Background Information

The Music Assistant Companion app is built with [Tauri](https://v2.tauri.app/). Tauri bundles the frontend and displays it using the system's built-in WebView. The app uses Rust for the backend, which is responsible for starting squeezelite, connecting to the Discord RPC if enabled, and handling the tray menu, icons, and other related tasks.

### Architecture

Below are some of the important files and folders used by the Companion app. Some of the files have explanations.

```
companion
├── frontend - Submodule pointing to the companion branch on the frontend repo
├── LICENSE
├── musicassistant.desktop - Desktop file for Linux
├── package.json
├── privacy-policy.md - Required by Apple
├── README.md
├── resource
│   ├── app_icon.png
│   ├── app_icon.svg
│   ├── io.music_assistant.companion.metainfo.xml
│   └── screenshots
└── src-tauri - Tauri folder
    ├── bin - Binaries that should be bundled with the application
    │   ├── squeezelite-aarch64-apple-darwin - Bundled with macOS Silicon
    │   ├── squeezelite-x86_64-apple-darwin - Bundled with macOS Intel
    │   ├── squeezelite-x86_64-pc-windows-msvc.exe - Bundled with Windows
    │   └── squeezelite-x86_64-unknown-linux-gnu - Bundled with Linux
    ├── build.rs - For building the app
    ├── capabilities
    ├── Cargo.lock
    ├── Cargo.toml - Cargo dependency file
    ├── Entitlements.plist - Entitlements file for macOS builds
    ├── icons
    ├── src - Tauri backend source code
    │   ├── discord_rpc.rs - Code for the Discord integration
    │   ├── lib.rs - Tauri library file
    │   └── main.rs - Main backend code 
    ├── target - Tauri output folder
    └── tauri.conf.json - Tauri config
```

### Frontend Submodule

The frontend for the Music Assistant Companion is included as a submodule. This means that the frontend code is stored in a separate repository, which allows for easier merging of changes from the main frontend repository. To pull changes from the main repository and update the frontend submodule, follow these steps:

1. Navigate to the root directory of the Music Assistant Companion repository.
2. Navigate to the `frontend` directory and pull the changes from the submodule repository using regular Git commands:

    ```
    cd frontend
    git pull origin main
    ```

    This will pull the latest changes from the main branch of the submodule repository.

4. After pulling the changes, there might be a few merge conflicts to resolve. 

The frontend should be regularly updated to maintain compatibility with the latest Music Assistant versions. The release action has a checkbox to enable pulling the frontend during build time. This will *attempt* to pull the latest frontend changes from the **companion** branch. However, you will still need to manually merge changes from the main branch to the companion branch.

### Releasing

To release the Music Assistant Companion app, you can use the GitHub Actions workflow provided in the repository. This workflow automatically updates the version number and performs the necessary steps to build and release the app.

Here's how you can use the GitHub Actions workflow to release the app:

1. Go to the repository's Actions tab.
2. Click on the "Publish" workflow.
3. Click on the "Run workflow" button.
4. Select the level at which the version number should be bumped: "patch", "minor", or "major".
5. Click on the "Run workflow" button to start the release process.

The workflow will automatically update the version number in the `Cargo.toml`, `tauri.conf.toml`, and `Cargo.lock` files, build the app using the Tauri CLI, create a new release on GitHub, and upload the generated binaries as release assets.

By using the GitHub Actions workflow, the companion app is automatically built for all platforms and the updates are distributed to the updater.

### Signing

#### Updater

The auto-updater will only allow automatic updates if the release is signed with the correct signing key. The signing key is stored as a GitHub Actions secret and is used by the action during build time. Music Assistant members can find information on how to access the private key and password [here](https://discord.com/channels/753947050995089438/1107389060219154643/1167784220878446663).

This is the public key:
```
dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDE4MTRFMzdFOTQxREQ0MzIKUldReTFCMlVmdU1VR0xtTW4wRzVjRThzLzA1NG4rZXhSYmYwTngxQmw3RVRDelJ2VEQzby80dmUK
```

#### macOS

The macOS builds are signed and notarized using our Apple developer account. The signing keys are also stored in the GitHub Actions secrets. The following secrets are used:

- `APPLE_SIGNING_IDENTITY`: the name of the keychain entry that contains the signing certificate.
- `APPLE_CERTIFICATE`: base64 string of the .p12 certificate exported from the keychain. Useful if you don't have the certificate on the keychain (e.g., CI machines). Downloadable from the Apple website.
- `APPLE_CERTIFICATE_PASSWORD`: the password for the .p12 certificate. Available in the 1Password account.
- `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID`: the Apple account email, app-specific password, and our team ID. Only required to notarize the app.

For more detailed explanations, refer to [this link](https://tauri.app/v1/guides/distribution/sign-macos). 

### Tauri 2.0 Release candidate

The project is currently using Tauri 2.0 releace candidate. It should be switched to stable once it is released.

### Mobile Builds

Tauri 2.0 supports building for mobile platforms quite easily. However, this feature has not been implemented yet. Check the Tauri documentation for more information. At the time of writing, the documentation for mobile builds is not complete.

### Sidecars

The companion app embeds a version of squeezelite, which is used for music playback. The binaries are located at `/src-tauri/bin/`. There is a binary for each architecture that the companion builds for. The Tauri builder selects the correct file based on the filename and only bundles the one for the current architecture. 

For more information, see [this link](https://v2.tauri.app/develop/sidecar/).

## Prerequisites

Before you begin, please ensure that you have the following installed:

- Node.js
- Yarn
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

## Getting Started

To contribute to the Music Assistant Companion, follow these steps:

1. Fork the repository on GitHub.
2. Clone your forked repository to your local machine including the frontend submodule. `git clone --recurse-submodules [github link]`
3. Install the project dependencies by running `yarn install`.
4. Start the development server by running `yarn tauri dev`.

## Making Changes

When making changes, please follow these guidelines:

- Create a new branch for your changes.
- Make your changes and ensure that the code passes all tests.
- Commit your changes with a descriptive commit message.
- Push your changes to your forked repository.
- Submit a pull request to the main repository.

## Reporting Issues

If you encounter any issues or have suggestions for improvement, please open an issue on the GitHub repository. Provide a clear and detailed description of the problem or suggestion.
