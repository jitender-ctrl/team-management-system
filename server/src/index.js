require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json());
app.use(morgan("dev"));

// Serve uploaded chat/task files. In production behind a CDN/object store,
// swap this for a redirect to the real asset URL — controllers only ever
// hand back a URL, so nothing else needs to change.
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
// Deliberately outside the /api auth tree at a distinct prefix — no token
// required, since this is the client-facing read-only portal.
app.use("/api/portal", require("./routes/public.routes"));
app.use("/api", require("./routes"));

// Central error fallback
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
