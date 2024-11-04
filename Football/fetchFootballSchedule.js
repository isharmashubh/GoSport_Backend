const axios = require("axios");
const { Builder, By, until } = require("selenium-webdriver");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const util = require("util");
const getMatchLink = require("../extractMatchLink");
const game = "football";
require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const execPromise = util.promisify(exec);
const { footballMatch } = require("../db");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function fetchingdatadatewise(driver, date) {
  const url = `https://www.fancode.com/graphql?extensions=%7B%22persistedQuery%22%3A%7B%22version%22%3A1%2C%22sha256Hash%22%3A%22552b9a3d8af3f5dc94b8d308d6837f8b300738cf72025d1d91e4949e105ba9ad%22%7D%7D&operation=query&operationName=FetchScheduleData&variables=%7B%22filter%22%3A%7B%22slug%22%3A%22${game}%22%2C%22collectionId%22%3Anull%2C%22dateRange%22%3A%7B%22fromDate%22%3A%22${date}%22%2C%22toDate%22%3A%22${date}%22%7D%2C%22streamingFilter%22%3A%22STREAMING%22%2C%22isLive%22%3Atrue%2C%22tours%22%3A%5B%5D%7D%7D`;

  console.log(`The API I am using to get data is - ${url}`);

  try {
    const response = await axios.get(url);
    console.log(`Fetched data from the API.`);
    console.log(
      `Received response is ${JSON.stringify(response.data, null, 2)}`
    );

    const jsonData = response.data;
    const matchMap = new Map();
    const liveMatches = []; // Array to store only LIVE matches

    jsonData.data.fetchScheduleData.edges.forEach((edge) => {
      edge.tours.forEach((tour) => {
        tour.matches.forEach((match) => {
          if (match.status === "LIVE") {
            // Check if the match is live
            liveMatches.push(match.id);
            matchMap.set(match.id, {
              name: match.name,
              startTime: match.startTime,
              venue: match.venue,
              tour: tour.tour.name,
              link: "",
              m3u8link: "",
            });
          }
        });
      });
    });

    console.log("Match IDs and details prepared. Extracting m3u8 links.");
    for (const id of liveMatches) {
      try {
        const link = await getMatchLink(id, game); // Call the function directly with id
        console.log("Match link:", link);
        const cleanedLink = link.trim();
        if (cleanedLink) {
          const matchDetails = matchMap.get(id);
          matchDetails.link = cleanedLink;
          matchMap.set(id, matchDetails);
        }

        console.log(`Processing match link ${cleanedLink}.`);
        const m3u8Link = await extractM3U8Links(driver, cleanedLink, id); // Assuming `driver` is defined in scope

        if (m3u8Link) {
          const matchDetails = matchMap.get(id);
          matchDetails.m3u8link = m3u8Link;
          matchMap.set(id, matchDetails);
        }
        console.log(
          `I have fetcheddata of date:- ${date} and written it inside footballmatchdata.json`
        );
      } catch (error) {
        console.error(`Error processing match ID ${id}:`, error.message);
      }
    }
    console.log("I am writing data in footballmatchdata.json from matchmap");
    // Read existing data
    let existingData = [];
    try {
      existingData = JSON.parse(
        fs.readFileSync("../Football/footballmatchdata.json", "utf8")
      );
    } catch (error) {
      console.warn("No existing data found. Starting fresh.");
    }

    // Convert matchMap to an array and merge with existing data
    const updatedData = [...existingData, ...Array.from(matchMap.entries())];

    // Write the combined data back to footballmatchdata.json
    fs.writeFileSync(
      "../Football/footballmatchdata.json",
      JSON.stringify(updatedData, null, 2)
    );
    console.log("Appended new match data to footballmatchdata.json.");
  } catch (error) {
    console.error(`Error fetching data:`, error.message);
  }
}

async function extractM3U8Links(driver, matchLink, matchid) {
  console.log(`Opening a new tab for match link: ${matchLink}`);
  const originalWindowHandle = await driver.getWindowHandle();

  // Open a new tab
  await driver.executeScript("window.open('');");
  const handles = await driver.getAllWindowHandles();
  await driver.switchTo().window(handles[handles.length - 1]);

  await driver.get(matchLink);

  console.log("Waiting for 8 seconds to capture network requests...");
  await sleep(8000);

  const resources = await driver.executeScript(
    'return window.performance.getEntriesByType("resource")'
  );

  console.log("Network requests captured:");

  // Find the .ts link that matches the desired pattern
  const tsLink = resources
    .map((resource) => resource.name)
    .find((link) => {
      // Check if the link matches the pattern with the matchid and ends with .ts
      const tsPattern = new RegExp(
        `https://dai\\.fancode\\.com/primary/${matchid}_english.*\\.ts`
      );
      return tsPattern.test(link);
    });

  let modifiedLink = null;

  if (tsLink) {
    console.log("Captured .ts link:");
    console.log(tsLink);

    // Replace everything after the last slash with '1080p.m3u8'
    const lastSlashIndex = tsLink.lastIndexOf("/");
    modifiedLink = tsLink.substring(0, lastSlashIndex + 1) + "1080p.m3u8";

    console.log("Modified link:");
    console.log(modifiedLink);
  } else {
    console.log("No .ts link matching the pattern found.");
  }

  // Close the current tab
  await driver.close();
  await driver.switchTo().window(originalWindowHandle);

  return modifiedLink || "";
}

async function importData() {
  return new Promise(async (resolve, reject) => {
    try {
      // Read and parse the JSON data
      const data = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, "../Football/footballmatchdata.json")
        )
      );

      // Check if data is empty
      if (!data || data.length === 0) {
        console.log("No Match Available to Import");
        return resolve(); // Exit the function
      }

      console.log("Printing match details here :-----");
      console.log(data); // Log the entire data object for better visibility

      // Use Promise.all to handle all match promises concurrently
      const matchPromises = data.map(async (match) => {
        const matchDetails = match[1]; // Extracting match details
        const existingMatch = await footballMatch.findOne({
          link: matchDetails.link,
        });

        if (existingMatch) {
          // If the match exists, check if m3u8link is empty
          if (!existingMatch.m3u8link) {
            // Update the m3u8link if it's empty
            existingMatch.m3u8link = matchDetails.m3u8link;
            await existingMatch.save();
            console.log(`Updated m3u8link for match: ${matchDetails.name}`);
          } else {
            console.log(`Match already exists, skipping: ${matchDetails.name}`);
          }
        } else {
          // Create and save a new match instance
          const newMatch = new footballMatch({
            name: matchDetails.name,
            startTime: matchDetails.startTime,
            venue: matchDetails.venue,
            tour: matchDetails.tour,
            link: matchDetails.link,
            m3u8link: matchDetails.m3u8link,
          });
          await newMatch.save();
          console.log(`Inserted new match: ${matchDetails.name}`);
        }
      });

      await Promise.all(matchPromises); // Wait for all promises to complete
      console.log(`All matches imported successfully!`);
      resolve();
    } catch (error) {
      console.error("Error importing data:", error);
      reject(error);
    }
  });
}

async function removeMissingMatches() {
  try {
    // Read and parse the JSON data from footballmatchdata.json
    const data = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../Football/footballmatchdata.json")
      )
    );

    // Extract match links from the JSON data for comparison
    const existingMatchLinks = new Set(data.map((match) => match[1].link));

    // Fetch all matches from the database
    const allMatches = await footballMatch.find();

    // Find matches that are in the database but not in the JSON file
    const matchesToRemove = allMatches.filter(
      (match) => !existingMatchLinks.has(match.link)
    );

    // Delete the matches from the database
    const deletePromises = matchesToRemove.map(async (match) => {
      await footballMatch.deleteOne({ _id: match._id });
      console.log(`Removed match: ${match.name}`);
    });

    await Promise.all(deletePromises); // Wait for all deletions to complete

    console.log("All missing matches removed successfully!");
  } catch (error) {
    console.error("Error removing missing matches:", error);
  }
}

async function mainFootball(driver) {
  //   let driver;
  const footballmatchdataPath = path.join(
    __dirname,
    "../Football/footballmatchdata.json"
  );

  console.log(`${footballmatchdataPath}`);

  fs.writeFileSync(footballmatchdataPath, JSON.stringify([])); // Clears as an empty array
  console.log("Running fetchFootballschedule.js");
  try {
    console.log("Fetching schedule data from the API.");
    const today = getTodayDate();
    console.log(
      `I am passing the date to fetchingdatadatewise function is ${today}`
    );
    await fetchingdatadatewise(driver, today); // Fetch data for today

    // Get yesterday's date
    const yesterdayDate = new Date(); // Create a new date object for today
    yesterdayDate.setDate(yesterdayDate.getDate() - 1); // Subtract one day
    const yesterday = yesterdayDate.toISOString().split("T")[0]; // Format as YYYY-MM-DD
    console.log(`Yesterday's date was ${yesterday}`);
    await fetchingdatadatewise(driver, yesterday); // Fetch data for yesterday

    await removeMissingMatches()
      .then(() => {
        console.log("Removing extra matches completed.");
      })
      .catch((err) => {
        console.error("Removing extra matches failed:", err);
      });
    await importData()
      .then(() => {
        console.log("Data import completed.");
      })
      .catch((err) => {
        console.error("Import failed:", err);
      });
    console.log("Data with links written to footballmatchdata.json");
  } catch (error) {
    console.error("Error occurred:", error.message);
  }
}

function getTodayDate() {
  const today = new Date();
  return today.toISOString().split("T")[0]; // Format as YYYY-MM-DD
}

module.exports = mainFootball;
