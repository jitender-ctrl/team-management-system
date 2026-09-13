// Uploaded files (chat attachments, avatars) are served from the API
// server's origin (not the /api prefix), e.g.
// VITE_API_URL=http://localhost:5000/api -> file host http://localhost:5000
const FILE_ORIGIN = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "");

export function fileUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${FILE_ORIGIN}${path}`;
}

export function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
