const express = require("express");
const cors = require("cors");
const ytdlp = require("yt-dlp-exec");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "TrendBeats Stream Server Running ✅" });
});

app.get("/stream/:videoId", async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) return res.status(400).json({ error: "videoId required" });

  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    const info = await ytdlp(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      addHeader: ["referer:youtube.com", "user-agent:Mozilla/5.0"],
    });

    const formats = info.formats ?? [];

    // Sirf real audio formats — mhtml/image exclude karo
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

    // Video+audio combined — fallback
    const combined = formats
      .filter(
        (f) =>
          f.url &&
          f.acodec !== "none" &&
          f.ext !== "mhtml" &&
          f.ext !== "jpg" &&
          f.ext !== "png",
      )
      .sort((a, b) => (b.abr ?? 0) - (a.abr ?? 0));

    const best = audioOnly[0] ?? combined[0];

    if (best?.url) {
      console.log(
        `✅ Stream mili: ${videoId} | format: ${best.ext} | bitrate: ${best.abr}`,
      );
      return res.json({ url: best.url, format: best.ext, bitrate: best.abr });
    }

    return res.status(404).json({ error: "No audio stream found" });
  } catch (e) {
    console.error(`❌ Error:`, e.message);
    return res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎵 TrendBeats Server running on port ${PORT}`);
});
