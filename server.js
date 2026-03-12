const express = require("express");
const cors = require("cors");
const ytdl = require("ytdl-core");

const app = express();
app.use(cors());

/* ---------- Home Route ---------- */
app.get("/", (req, res) => {
  res.json({
    status: "YouTube Music Stream Server Running 🎵",
  });
});

/* ---------- Stream Route ---------- */
app.get("/stream/:videoId", async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) return res.status(400).json({ error: "videoId required" });

  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    // YouTube video info
    const info = await ytdl.getInfo(url);

    // Best audio format select karo
    const format = ytdl.chooseFormat(info.formats, { quality: "highestaudio" });

    if (!format || !format.url) {
      return res.status(404).json({ error: "No audio stream found" });
    }

    // Response me URL bhejo
    res.json({
      url: format.url,
      quality: format.audioBitrate,
      mimeType: format.mimeType,
      title: info.videoDetails.title,
      author: info.videoDetails.author.name,
      duration: info.videoDetails.lengthSeconds,
    });
  } catch (error) {
    console.log("Stream error:", error.message);
    res.status(500).json({ error: "Failed to get stream" });
  }
});

/* ---------- Start Server ---------- */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🎵 Server running on port ${PORT}`);
});
