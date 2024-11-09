const axios = require("axios");
const { Builder, By, until } = require("selenium-webdriver");
const fs = require("fs");
const path = require("path");
const getMatchLink = require("../extractMatchLink");
const mainFootball = require("../Football/fetchFootballSchedule");
const game = "cricket";
require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const { cricketMatch } = require("../db");
const matchMap = new Map();
let driver;

// Reading credentials from .env
const email = process.env.email;
const password = process.env.password;

console.log(`Email being used is ${email}`);
console.log(`Password we are using is ${password}`);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function fetchingdatadatewise(driver, date) {
  const url = `https://www.fancode.com/graphql?extensions=%7B%22persistedQuery%22%3A%7B%22version%22%3A1%2C%22sha256Hash%22%3A%22552b9a3d8af3f5dc94b8d308d6837f8b300738cf72025d1d91e4949e105ba9ad%22%7D%7D&operation=query&operationName=FetchScheduleData&variables=%7B%22filter%22%3A%7B%22slug%22%3A%22${game}%22%2C%22collectionId%22%3Anull%2C%22dateRange%22%3A%7B%22fromDate%22%3A%22${date}%22%2C%22toDate%22%3A%22${date}%22%7D%2C%22streamingFilter%22%3A%22STREAMING%22%2C%22isLive%22%3Atrue%2C%22tours%22%3A%5B%5D%7D%7D`;

  console.log(`The API I am using to get data is - ${url}`);

  try {
    const response = await axios.get(url);
    console.log(`Fetched data from the API.`);
    // console.log(
    //   `Received response is ${JSON.stringify(response.data, null, 2)}`
    // );

    const jsonData = response.data;
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
             scorecard:
                match?.scorecard?.cricketScore?.description ||
                "No description available",
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
      } catch (error) {
        console.error(`Error processing match ID ${id}:`, error.message);
      }
    }

    // Display the contents of matchMap before proceeding
    // console.log(
    //   `Current data in matchMap for date ${date}:`,
    //   Array.from(matchMap.entries())
    // );
  } catch (error) {
    console.error(`Error fetching data:`, error.message);
  }
}

async function login(driver) {
  console.log("Navigating to the login page...");
  await driver.get("https://www.fancode.com/cricket/schedule");
  await sleep(5000);
  let divElement = await driver.findElement(By.css(".sc-76gbq0-7.jbALtw"));
  await divElement.click();

  await sleep(3000);

  let googleLogo = await driver.findElement(
    By.css('picture img[src*="google-g-logo"]')
  );
  await googleLogo.click();

  await sleep(3000);

  const originalWindowHandle = await driver.getWindowHandle();
  const handles = await driver.getAllWindowHandles();
  await driver.switchTo().window(handles[1]);

  console.log("Entering email address...");
  await driver.findElement(By.css('input[type="email"]')).sendKeys(email);
  await driver
    .findElement(By.xpath('//button[.//span[text()="Next"]]'))
    .click();

  await sleep(3000);

  console.log("Entering password...");
  await driver.findElement(By.css('input[type="password"]')).sendKeys(password);
  await driver
    .findElement(By.xpath('//button[.//span[text()="Next"]]'))
    .click();

  console.log("Waiting for login to complete...");
  await driver.wait(async () => {
    const handles = await driver.getAllWindowHandles();
    return handles.length === 1;
  }, 30000);

  await driver.switchTo().window(originalWindowHandle);
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

async function updateMatches() {
  try {
    // Iterate over each match in matchMap
    for (const [matchId, matchData] of matchMap) {
      // First, find the existing match
      const existingMatch = await cricketMatch.findOne({
        link: matchData.link,
      });

      // Determine the m3u8link to set
      let m3u8linkToSet;
      if (existingMatch) {
        // Only check for m3u8link if existingMatch is not null
        m3u8linkToSet = existingMatch.m3u8link || matchData.m3u8link;
      } else {
        // If no existing match, set to the new m3u8link
        m3u8linkToSet = matchData.m3u8link;
      }

      // Use findOneAndUpdate to update if exists or insert if not
      const result = await cricketMatch.findOneAndUpdate(
        { link: matchData.link }, // Filter by link to find the existing match
        {
          $set: {
            name: matchData.name,
            startTime: matchData.startTime,
            venue: matchData.venue,
            tour: matchData.tour,
            scorecard: matchData.scorecard,
            m3u8link: m3u8linkToSet, // Set determined m3u8link
          },
        },
        { upsert: true, new: true } // upsert creates if doesn't exist, new returns the updated document
      );

      if (result.upserted) {
        console.log(`Added new match: ${matchData.name}`);
      } else {
        console.log(`Updated match: ${result.name}`);
      }
    }

    console.log("All matches processed successfully!");
  } catch (error) {
    console.error("Error updating matches:", error);
  }
}

async function removeMissingMatches() {
  try {
    // Fetch all matches from the database
    const allMatches = await cricketMatch.find();

    // Create a Set of match links from matchMap for comparison
    const matchMapLinks = new Set(
      Array.from(matchMap.values()).map((match) => match.link)
    );

    // Find matches that are in the database but not in matchMap
    const matchesToRemove = allMatches.filter(
      (match) => !matchMapLinks.has(match.link)
    );

    // Delete the matches from the database
    const deletePromises = matchesToRemove.map(async (match) => {
      await cricketMatch.deleteOne({ _id: match._id });
      console.log(`Removed match: ${match.name}`);
    });

    await Promise.all(deletePromises); // Wait for all deletions to complete

    console.log("All extra matches removed successfully!");
  } catch (error) {
    console.error("Error removing missing matches:", error);
  }
}

async function mainCricket() {
  const cricketmatchdataPath = path.join(__dirname, "./cricketmatchdata.json");
  driver = await new Builder().forBrowser("chrome").build();

  console.log(
    `The path from where I am trying to clear the data is: ${cricketmatchdataPath}`
  );

  // Clear the contents of the JSON file, leaving it completely empty
  fs.writeFileSync(cricketmatchdataPath, ""); // Clears with an empty file, no content at all

  console.log("Running fetchschedule.js");
  try {
    await login(driver);

    console.log("Fetching schedule data from the API.");
    const today = getTodayDate();
    console.log(
      `I am passing the date to fetchingdatadatewise function is ${today}`
    );
    await fetchingdatadatewise(driver, today); // Fetch data for today

    // Get yesterday's date
    const yesterday = getYesterdayDate();
    console.log(`Yesterday's date was ${yesterday}`);
    await fetchingdatadatewise(driver, yesterday); // Fetch data for yesterday
    // Convert matchMap to an array
    const matchDataToWrite = Array.from(matchMap.entries()).map(
      ([id, details]) => [id, details]
    );
    // Remove extra matches after updating
    await removeMissingMatches()
      .then(() => {
        console.log("Removing extra matches completed.");
      })
      .catch((err) => {
        console.error("Removing extra matches failed:", err);
      });
    // Update existing matches first
    await updateMatches()
      .then(() => {
        console.log("Updated existing matches.");
      })
      .catch((err) => {
        console.error("Updating matches failed:", err);
      });

    // Write match data to JSON file
    fs.writeFile(
      path.join(__dirname, "cricketmatchdata.json"),
      JSON.stringify(matchDataToWrite, null, 2),
      (err) => {
        if (err) {
          console.error("Error writing data to file:", err);
        } else {
          console.log(
            "Match data successfully written to cricketmatchdata.json"
          );

          // Read and print the contents of cricketmatchdata.json after writing
          fs.readFile(
            path.join(__dirname, "cricketmatchdata.json"),
            "utf-8",
            (err, currentData) => {
              if (err) {
                console.error("Error reading cricketmatchdata.json:", err);
              } else {
                // console.log(
                //   "Current data in cricketmatchdata.json:",
                //   currentData
                // );
              }
            }
          );
        }
      }
    );

    console.log("Calling fetchFootballSchedule");
    await mainFootball(driver);
    console.log("fetchFootballSchedule executed successfully");
  } catch (error) {
    console.error("Error occurred:", error.message);
  } finally {
    if (driver) {
      await driver.quit();
    }
  }
}

function getTodayDate() {
  const today = new Date();
  const offsetIST = 5.5 * 60 * 60 * 1000; // Offset in milliseconds for IST (UTC+5:30)
  const todayIST = new Date(today.getTime() + offsetIST);
  return todayIST.toISOString().split("T")[0]; // Format as YYYY-MM-DD
}
function getYesterdayDate() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1); // Subtract one day
  const offsetIST = 5.5 * 60 * 60 * 1000; // Offset in milliseconds for IST (UTC+5:30)
  const yesterdayIST = new Date(yesterday.getTime() + offsetIST);
  return yesterdayIST.toISOString().split("T")[0]; // Format as YYYY-MM-DD
}

// mainCricket();
module.exports = mainCricket;
