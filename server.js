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
const COOKIES_PATH = path.join(__dirname, "cookies.txt");

/* ---------- Download yt-dlp ---------- */

const downloadYtDlp = () => {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(YT_DLP_PATH)) return resolve();

    console.log("Downloading yt-dlp...");

    const file = fs.createWriteStream(YT_DLP_PATH);

    const download = (url) => {
      https
        .get(url, (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            return download(res.headers.location);
          }

          res.pipe(file);

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

/* ---------- Cookies Setup ---------- */

const setupCookies = () => {
  const base64 = process.env.YT_COOKIES_BASE64;

  if (base64) {
    const buf = Buffer.from(base64, "base64");
    fs.writeFileSync(COOKIES_PATH, buf);
    console.log("✅ Cookies loaded");
    return true;
  }

  console.log("⚠️ No cookies provided");
  return false;
};

/* ---------- Get Stream URL ---------- */

const getStreamUrl = async (videoId, format) => {
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  const args = [
    url,
    "--get-url",
    "--no-warnings",
    "--no-check-certificates",
    "--format",
    format,
    "--no-playlist",
  ];

  if (fs.existsSync(COOKIES_PATH)) {
    args.push("--cookies", COOKIES_PATH);
  }

  try {
    const { stdout, stderr } = await execFileAsync(YT_DLP_PATH, args, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30000,
    });

    if (stderr) {
      console.log("STDERR:", stderr);
    }

    const streamUrl = stdout.trim().split("\n")[0];

    if (streamUrl && streamUrl.startsWith("http")) {
      return streamUrl;
    }

    return null;
  } catch (error) {
    console.log("STDERR:", error.stderr);
    throw error;
  }
};

/* ---------- Routes ---------- */

app.get("/", (req, res) => {
  res.json({
    status: "TrendBeats Stream Server Running ✅",
  });
});

app.get("/stream/:videoId", async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    return res.status(400).json({ error: "videoId required" });
  }

  const formats = ["bestaudio/best", "bestaudio", "best"];

  for (const format of formats) {
    try {
      console.log(`Trying format: ${format} for ${videoId}`);

      const url = await getStreamUrl(videoId, format);

      if (url) {
        console.log(`✅ Stream found with ${format}`);

        return res.json({
          url,
          format,
        });
      }
    } catch (e) {
      console.warn(`Format ${format} failed:`, e.message.split("\n")[0]);
      continue;
    }
  }

  console.error(`❌ All formats failed for: ${videoId}`);

  return res.status(404).json({
    error: "No stream found",
  });
});

/* ---------- Start Server ---------- */

const PORT = process.env.PORT || 3000;

downloadYtDlp()
  .then(() => {
    setupCookies();

    app.listen(PORT, () => {
      console.log(`🎵 TrendBeats Server running on port ${PORT}`);
    });
  })
  .catch((e) => {
    console.error("Setup failed:", e);
    process.exit(1);
  });
