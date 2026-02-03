// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn save_project(path: String, contents: String) -> Result<(), String> {
    std::fs::write(path, contents).map_err(|error| error.to_string())
}

#[tauri::command]
fn load_project(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![save_project, load_project])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
