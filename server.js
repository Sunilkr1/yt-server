const express = require("express");
const cors = require("cors");
const ytdl = require("@distube/ytdl-core");

const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.json({
    status: "YouTube Music Stream Server Running 🎵",
  });
});

app.get("/stream/:videoId", async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    return res.status(400).json({ error: "videoId required" });
  }

  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    const info = await ytdl.getInfo(url);

    const format = ytdl.chooseFormat(info.formats, {
      quality: "highestaudio",
    });

    if (!format || !format.url) {
      return res.status(404).json({ error: "No audio stream found" });
    }

    res.json({
      url: format.url,
      title: info.videoDetails.title,
      duration: info.videoDetails.lengthSeconds,
      author: info.videoDetails.author.name,
      thumbnail: info.videoDetails.thumbnails[0].url,
    });
  } catch (error) {
    console.log("Stream error:", error.message);

    res.status(500).json({
      error: "Stream fetch failed",
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🎵 Server running on port ${PORT}`);
});
