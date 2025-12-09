use discord_rich_presence::{activity::{self, StatusDisplayType}, DiscordIpc, DiscordIpcClient};
use serde_json;
use std::time::{SystemTime, UNIX_EPOCH};
use tungstenite::connect;
use url::Url;

// Discord client id for MASS application
const CLIENT_ID: &str = "1107294634507518023";

// Struct for storing data about songs.
struct Song {
    name: String,
    artist: String,
    artist_url: String,
    artist_image: String,
    album: String,
    album_image: String,
    end: i64,
    started: i64,
    provider_url: String,
}

// Function for running the Discord rich presence
pub fn start_rpc(mass_ws: String) {
    // Create the Discord RPC client
    let mut client = DiscordIpcClient::new(CLIENT_ID);

    // Connect to the Discord Rich Presence socket
    if let Err(e) = client.connect() {
        eprintln!(
            "Failure while connecting to Discord RPC socket: {}. Is Discord running?",
            e
        );
        return;
    }

    // Connect to MASS socket
    let (mut socket, _response) = match connect(Url::parse(&mass_ws).unwrap().as_str()) {
        Ok(connection) => connection,
        Err(e) => {
            eprintln!("Can't connect to the Music Assistant server: {}. Make sure the server is running and the webserver is exposed from the settings", e);
            return;
        }
    };

    // Continuously update the status
    loop {
        // Read the WebSocket message
        let msg = match socket.read() {
            Ok(msg) => msg,
            Err(e) => {
                eprintln!("Error reading message from Music Assistant server: {}. Make sure you are on the latest version of Music Assistant server and companion app", e);
                continue;
            }
        };

        // Parse the response to text
        let msg_text = match msg.to_text() {
            Ok(text) => text,
            Err(e) => {
                eprintln!("Couldn't convert response to text: {}. Make sure you are on the latest version of Music Assistant server and companion app", e);
                continue;
            }
        };

        // Parse to JSON. If it fails, skip this iteration
        let msg_json: serde_json::Value = match serde_json::from_str(msg_text) {
            Ok(json) => json,
            Err(_) => continue,
        };

        // If it isn't a queue update, ignore it
        if msg_json["event"] != "queue_updated" {
            continue;
        }

        // let displayname = msg_json["data"]["display_name"]
        //     .as_str()
        //     .unwrap_or("")
        //     .to_string();

        // Stop Discord RPC if not playing
        if msg_json["data"]["state"].as_str().unwrap_or("") != "playing" {
            if let Err(e) = client.clear_activity() {
                eprintln!("Couldn't clear activity: {}. Please open an issue on the Music Assistant companion repository if the Discord activity is acting weird", e);
            }
            continue;
        }

        // Get the current item
        let current_item = &msg_json["data"]["current_item"];
        let media_item = &current_item["media_item"];
        let metadata = &media_item["metadata"];

        // If no track is playing, clear Discord activity
        if current_item.is_null() {
            if let Err(e) = client.clear_activity() {
                eprintln!("Couldn't clear activity: {}. Please open an issue on the Music Assistant companion repository if the Discord activity is acting weird", e);
            }
            continue;
        }

        // Get duration details
        let already_played = (msg_json["data"]["elapsed_time"]
            .as_f64()
            .unwrap_or(0.0)
            .round() as i64)
            * 1000;
        let duration = media_item["duration"].as_i64().unwrap_or(0) * 1000;

        // Get current time for timestamps
        let current_time = match SystemTime::now().duration_since(UNIX_EPOCH) {
            Ok(duration) => duration.as_millis() as i64,
            Err(e) => {
                eprintln!("Time error: {}", e);
                continue;
            }
        };

        // Create the current song struct
        let current_song = Song {
            name: media_item["name"].as_str().unwrap_or("").to_string(),
            album: media_item["album"]["name"]
                .as_str()
                .unwrap_or("")
                .to_string(),
            album_image: metadata["images"][0]["path"]
                .as_str()
                .unwrap_or("")
                .to_string(),
            artist: media_item["artists"][0]["name"]
                .as_str()
                .unwrap_or("")
                .to_string(),
            artist_url: media_item["artists"][0]["provider_mappings"][0]["url"]
                .as_str()
                .unwrap_or("")
                .to_string(),
            provider_url: media_item["provider_mappings"][0]["url"]
                .as_str()
                .unwrap_or("")
                .to_string(),
            artist_image: media_item["artists"][0]["metadata"]["images"][0]["path"]
                .as_str()
                .unwrap_or("")
                .to_string(),
            started: current_time,
            end: current_time + (duration - already_played),
        };

        // The assets of the activity
        let assets = activity::Assets::new()
            .small_image(&current_song.artist_image)
            .small_text(&current_song.artist)
            .large_image(&current_song.album_image)
            .large_text(&current_song.album);

        // The timestamps of the activity
        let timestamps = activity::Timestamps::new()
            .start(current_song.started)
            .end(current_song.end);

        // The buttons of the activity
        let buttons = if current_song.provider_url.contains("https://") {
            vec![
                activity::Button::new(
                    "Download companion",
                    "https://music-assistant.io/companion-app/",
                ),
                activity::Button::new("Open in browser", &current_song.provider_url),
            ]
        } else {
            vec![activity::Button::new(
                "Download companion",
                "https://music-assistant.io/companion-app/",
            )]
        };

        // Construct the final payload
        // state = artist name, details = track name
        // status_display_type = Details shows "Listening to <track name>" in member list
        let mut payload = activity::Activity::new()
            .state(&current_song.artist)
            .details(&current_song.name)
            .assets(assets)
            .buttons(buttons)
            .timestamps(timestamps)
            .status_display_type(StatusDisplayType::Details);

        // Add URLs if available (clickable links in Discord)
        if current_song.provider_url.contains("https://") {
            payload = payload.details_url(&current_song.provider_url);
        }
        if current_song.artist_url.contains("https://") {
            payload = payload.state_url(&current_song.artist_url);
        }

        // Set the activity
        if let Err(e) = client.set_activity(payload) {
            eprintln!("Failure updating status: {}. Please open an issue on the Music Assistant companion repository if the Discord activity is acting weird", e);
        }
    }
}
