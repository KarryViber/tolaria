use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::SystemTime;

use crate::hidden_command;

const SOFFICE_CANDIDATES: &[&str] = &[
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    "/opt/homebrew/bin/soffice",
    "/usr/local/bin/soffice",
    "/usr/bin/soffice",
    "/usr/lib/libreoffice/program/soffice",
];

fn locate_soffice() -> Result<PathBuf, String> {
    for candidate in SOFFICE_CANDIDATES {
        let path = PathBuf::from(candidate);
        if path.exists() {
            return Ok(path);
        }
    }
    if let Ok(env_path) = std::env::var("SOFFICE") {
        let path = PathBuf::from(env_path);
        if path.exists() {
            return Ok(path);
        }
    }
    Err("LibreOffice (soffice) not found. Install via `brew install --cask libreoffice`.".to_string())
}

fn pptx_cache_dir() -> Result<PathBuf, String> {
    let base = dirs::cache_dir().ok_or_else(|| "Cache dir unavailable".to_string())?;
    let dir = base.join("com.tolaria.app").join("pptx-preview");
    fs::create_dir_all(&dir).map_err(|e| format!("create cache dir: {e}"))?;
    Ok(dir)
}

fn cache_key(path: &Path) -> Result<String, String> {
    let meta = fs::metadata(path).map_err(|e| format!("stat: {e}"))?;
    let mtime_nanos = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|d| d.as_nanos())
        .unwrap_or(0u128);
    let size = meta.len();
    let mut hasher = DefaultHasher::new();
    path.to_string_lossy().hash(&mut hasher);
    size.hash(&mut hasher);
    mtime_nanos.hash(&mut hasher);
    Ok(format!("{:016x}", hasher.finish()))
}

#[tauri::command]
pub async fn pptx_to_pdf(path: String) -> Result<String, String> {
    let input = PathBuf::from(&path);
    if !input.exists() {
        return Err(format!("Input file not found: {}", path));
    }

    let cache_dir = pptx_cache_dir()?;
    let key = cache_key(&input)?;
    let cached = cache_dir.join(format!("{key}.pdf"));

    if cached.exists() {
        return Ok(cached.to_string_lossy().into_owned());
    }

    let soffice = locate_soffice()?;
    let mut command = hidden_command(&soffice);
    command.args([
        "--headless",
        "--norestore",
        "--nofirststartwizard",
        "--convert-to",
        "pdf",
        "--outdir",
        cache_dir.to_string_lossy().as_ref(),
        path.as_str(),
    ]);

    let output = command
        .output()
        .map_err(|e| format!("Failed to spawn soffice: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!(
            "soffice failed (status {:?}): stderr={stderr} stdout={stdout}",
            output.status.code()
        ));
    }

    let stem = input
        .file_stem()
        .ok_or_else(|| "Input file has no stem".to_string())?
        .to_string_lossy()
        .into_owned();
    let produced = cache_dir.join(format!("{stem}.pdf"));
    if !produced.exists() {
        return Err(format!(
            "soffice completed but expected pdf is missing: {}",
            produced.display()
        ));
    }

    fs::rename(&produced, &cached)
        .map_err(|e| format!("Failed to finalize cached pdf: {e}"))?;

    Ok(cached.to_string_lossy().into_owned())
}
