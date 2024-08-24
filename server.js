const express = require("express");
const fs = require("fs");
const { exec } = require("child_process");

const app = express();
const port = 3000;

// Serve static files from the 'public' folder
app.use(express.static("public"));
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
  // Call extractMatchLink.js before sending the file
  exec("node extractMatchLink.js", (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing extractMatchLink.js: ${error}`);
      return;
    }
    if (stderr) {
      console.error(`stderr: ${stderr}`);
      return;
    }
    console.log(`stdout: ${stdout}`);

    // Send the fetchdata.json file
    fs.readFile("public/fetchdata.json", "utf8", (err, data) => {
      if (err) {
        res.status(500).send("Error reading fetchdata.json");
        return;
      }
      res.json(JSON.parse(data));
    });
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
