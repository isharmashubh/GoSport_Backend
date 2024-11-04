// backend/db.js
const mongoose = require("mongoose");
require("dotenv").config();
// mongoose.connect("mongodb://localhost:27017/paytm");

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

// Create a Schema for Users
const matchSchema = new mongoose.Schema({
  name: String,
  startTime: String,
  venue: String,
  tour: String,
  scorecard: String,
  link: String,
  m3u8link: String,
});

const Match = mongoose.model("Match", matchSchema);

module.exports = {
  Match,
};
