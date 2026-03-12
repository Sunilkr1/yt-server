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

/* ---------- Update yt-dlp ---------- */

const updateYtDlp = async () => {
  try {
    console.log("Updating yt-dlp...");
    await execFileAsync(YT_DLP_PATH, ["-U"]);
    console.log("✅ yt-dlp updated");
  } catch (e) {
    console.log("yt-dlp update skipped");
  }
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
    "--extractor-args",
    "youtube:player_client=android",
  ];

  const { stdout, stderr } = await execFileAsync(YT_DLP_PATH, args, {
    maxBuffer: 10 * 1024 * 1024,
    timeout: 30000,
  });

  if (stderr) console.log("STDERR:", stderr);

  const streamUrl = stdout.trim().split("\n")[0];

  if (streamUrl && streamUrl.startsWith("http")) {
    return streamUrl;
  }

  return null;
};

/* ---------- Routes ---------- */

app.get("/", (req, res) => {
  res.json({ status: "TrendBeats Stream Server Running ✅" });
});

app.get("/stream/:videoId", async (req, res) => {
  const { videoId } = req.params;

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
      console.log(`Format ${format} failed`);
    }
  }

  console.log("❌ All formats failed");

  res.status(404).json({ error: "No stream found" });
});

/* ---------- Start Server ---------- */

const PORT = process.env.PORT || 3000;

downloadYtDlp()
  .then(updateYtDlp)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🎵 Server running on ${PORT}`);
    });
  })
  .catch((e) => {
    console.error("Setup failed:", e);
  });
