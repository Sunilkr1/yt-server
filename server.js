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

    const download = (downloadUrl) => {
      https
        .get(downloadUrl, (response) => {
          if (response.statusCode === 301 || response.statusCode === 302) {
            return download(response.headers.location);
          }
          response.pipe(file);
          file.on("finish", () => {
            file.close();
            fs.chmodSync(YT_DLP_PATH, "755");
            console.log("✅ yt-dlp downloaded");
            resolve();
          });
        })
        .on("error", reject);
    };

    download(url);
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

    const { stdout, stderr } = await execFileAsync(
      YT_DLP_PATH,
      [
        url,
        "--dump-single-json",
        "--no-warnings",
        "--no-check-certificates",
        "--prefer-free-formats",
        "--no-playlist",
        "--add-header",
        "referer:youtube.com",
        "--add-header",
        `user-agent:Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36`,
      ],
      {
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer
        timeout: 30000,
      },
    );

    if (!stdout || stdout.trim() === "") {
      console.error("Empty stdout, stderr:", stderr);
      return res.status(500).json({ error: "Empty response from yt-dlp" });
    }

    let info;
    try {
      info = JSON.parse(stdout.trim());
    } catch (parseErr) {
      console.error("JSON parse error, stdout length:", stdout.length);
      console.error("First 500 chars:", stdout.substring(0, 500));
      return res.status(500).json({ error: "JSON parse failed" });
    }

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
      console.log(`✅ Stream mili: ${videoId} | ${best.ext} | ${best.abr}kbps`);
      return res.json({ url: best.url, format: best.ext, bitrate: best.abr });
    }

    return res.status(404).json({ error: "No audio stream found" });
  } catch (e) {
    console.error(`❌ Error:`, e.message);
    return res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;

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
