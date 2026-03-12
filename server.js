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

const YT_DLP_PATH = path.join(__dirname, "yt-dlp");

const downloadYtDlp = () => {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(YT_DLP_PATH)) {
      return resolve();
    }
    console.log("Downloading yt-dlp...");
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
            console.log("✅ yt-dlp ready");
            resolve();
          });
        })
        .on("error", reject);
    };
    download(
      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp",
    );
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

    // Sirf URL print karo — JSON nahi
    const { stdout } = await execFileAsync(
      YT_DLP_PATH,
      [
        url,
        "--get-url",
        "--no-warnings",
        "--no-check-certificates",
        "--format",
        "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best",
        "--no-playlist",
        "--extractor-args",
        "youtube:player_client=android",
      ],
      {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30000,
      },
    );
    const streamUrl = stdout.trim().split("\n")[0];

    if (streamUrl && streamUrl.startsWith("http")) {
      console.log(`✅ Stream mili: ${videoId}`);
      return res.json({ url: streamUrl });
    }

    return res.status(404).json({ error: "No stream found" });
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
    console.error("yt-dlp download failed:", e);
    process.exit(1);
  });
