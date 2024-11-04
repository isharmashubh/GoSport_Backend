const express = require("express");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const mongoose = require("mongoose");

const app = express();
const port = 3005;

// Serve static files from the 'public' folder
app.use(express.static("public"));

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(
      "mongodb+srv://admin:1122334455@cluster0.qybtm.mongodb.net/Fancode"
    );
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
}

// Execute fetchSchedule.js once when the server starts
async function executeFetchSchedule() {
  console.log("Calling fetchSchedule.js");
  exec("node fetchSchedule.js", (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing fetchSchedule.js: ${error}`);
      return;
    }
    if (stderr) {
      console.error(`stderr: ${stderr}`);
    }
    console.log(`fetchSchedule.js executed successfully: ${stdout}`);
  });
}

// Initialize the server
async function startServer() {
  await connectDB();
  await executeFetchSchedule();
}

startServer().catch((err) => console.error("Error starting server:", err));
