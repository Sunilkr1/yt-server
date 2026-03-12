const express = require("express");
const cors = require("cors");
const { execFile } = require("child_process");
const { promisify } = require("util");
const https = require("https");
const fs = require("fs");
const path = require("path");

const execFileAsync = promisify(execFile);
const app = express();
app.use(cors());
app.use(express.json());

const YT_DLP_PATH = path.join(__dirname, "yt-dlp");

// yt-dlp download karo agar nahi hai
const downloadYtDlp = () => {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(YT_DLP_PATH)) {
      console.log("yt-dlp already exists");
      return resolve();
    }
    console.log("Downloading yt-dlp...");
    const url =
      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";
    const file = fs.createWriteStream(YT_DLP_PATH);
    https
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          https
            .get(response.headers.location, (res) => {
              res.pipe(file);
              file.on("finish", () => {
                file.close();
                fs.chmodSync(YT_DLP_PATH, "755");
                console.log("✅ yt-dlp downloaded");
                resolve();
              });
            })
            .on("error", reject);
        } else {
          response.pipe(file);
          file.on("finish", () => {
            file.close();
            fs.chmodSync(YT_DLP_PATH, "755");
            console.log("✅ yt-dlp downloaded");
            resolve();
          });
        }
      })
      .on("error", reject);
  });
};

app.get("/", (req, res) => {
  res.json({ status: "TrendBeats Stream Server Running ✅" });
});

app.get("/stream/:videoId", async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) return res.status(400).json({ error: "videoId required" });

  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    const { stdout } = await execFileAsync(YT_DLP_PATH, [
      url,
      "--dump-single-json",
      "--no-warnings",
      "--no-check-certificates",
      "--prefer-free-formats",
      "--add-header",
      "referer:youtube.com",
      "--add-header",
      "user-agent:Mozilla/5.0",
    ]);

    const info = JSON.parse(stdout);
    const formats = info.formats ?? [];

    const audioOnly = formats
      .filter(
        (f) =>
          f.url &&
          f.vcodec === "none" &&
          f.acodec !== "none" &&
          f.ext !== "mhtml" &&
          (f.ext === "m4a" || f.ext === "webm" || f.ext === "mp4"),
      )
      .sort((a, b) => (b.abr ?? 0) - (a.abr ?? 0));

    const combined = formats
      .filter(
        (f) =>
          f.url && f.acodec !== "none" && f.ext !== "mhtml" && f.ext !== "jpg",
      )
      .sort((a, b) => (b.abr ?? 0) - (a.abr ?? 0));

    const best = audioOnly[0] ?? combined[0];

    if (best?.url) {
      console.log(`✅ Stream mili: ${videoId}`);
      return res.json({ url: best.url, format: best.ext, bitrate: best.abr });
    }

    return res.status(404).json({ error: "No audio stream found" });
  } catch (e) {
    console.error(`❌ Error:`, e.message);
    return res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;

// Pehle yt-dlp download karo, phir server start karo
downloadYtDlp()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🎵 TrendBeats Server running on port ${PORT}`);
    });
  })
  .catch((e) => {
    console.error("Failed to download yt-dlp:", e);
    process.exit(1);
  });
