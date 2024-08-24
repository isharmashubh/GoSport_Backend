const express = require("express");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const app = express();
const port = 3000;

// Serve static files from the 'public' folder
app.use(express.static("public"));

// Serve static files from the root directory
app.use(express.static(__dirname));

// Execute fetchSchedule.js once when the server starts
exec("node fetchSchedule.js", (error, stdout, stderr) => {
  if (error) {
    console.error(`Error executing fetchSchedule.js: ${error}`);
    return;
  }
  if (stderr) {
    console.error(`stderr: ${stderr}`);
    return;
  }
  console.log(`fetchSchedule.js executed successfully: ${stdout}`);
});

// Route to get fetchdata.json
app.get("/fetchdata.json", (req, res) => {
  // Execute extractMatchLink.js before sending the file
  exec("node extractMatchLink.js", (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing extractMatchLink.js: ${error}`);
      res.status(500).send("Error executing extractMatchLink.js");
      return;
    }
    if (stderr) {
      console.error(`stderr: ${stderr}`);
    }
    console.log(`extractMatchLink.js executed successfully: ${stdout}`);

    // Send the fetchdata.json file
    fs.readFile(
      path.join(__dirname, "public", "fetchdata.json"),
      "utf8",
      (err, data) => {
        if (err) {
          console.error(`Error reading fetchdata.json: ${err}`);
          res.status(500).send("Error reading fetchdata.json");
          return;
        }
        res.json(JSON.parse(data));
      }
    );
  });
});

// Serve index.html from the 'public' folder for the root URL
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Serve directlyfile.html from the 'public' folder
app.get("/directlyfile.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "directlyfile.html"));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
