const axios = require("axios");
const { Builder, By, until } = require("selenium-webdriver");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const util = require("util");

const execPromise = util.promisify(exec);

// Read credentials from config.json
const config = JSON.parse(fs.readFileSync("config.json", "utf8"));
const email = config.email;
const password = config.password;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function login(driver) {
  console.log("Navigating to the login page...");
  await driver.get("https://www.fancode.com/cricket/schedule");
  await sleep(5000);
  let divElement = await driver.findElement(By.css(".sc-76gbq0-7.jbALtw"));
  await divElement.click();

  await sleep(3000);

  // let imageElement = await driver.findElement(
  //   By.css("picture img.sc-rhrvi4-0.cNUpys.sc-1o55c8w-5.kaImfW")
  // );
  // await imageElement.click();

  let googleLogo = await driver.findElement(
    By.css('picture img[src*="google-g-logo"]')
  );
  await googleLogo.click();

  // console.log("Clicking on the Login button...");
  // const loginButton = await driver.findElement(
  //   By.css('span[data-analytics*="LoginButtonClicked"]')
  // );
  // await loginButton.click();

  await sleep(3000);

  // console.log("Clicking on the Google login icon...");
  // const googleLoginIcon = await driver.findElement(
  //   By.css(
  //     'img[src="/fc-web/1724415142272/build/desktop/client/images/googleLogocd64e1c5e13a274a8a91.png"]'
  //   )
  // );
  // await googleLoginIcon.click();

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

async function extractM3U8Links(driver, matchLink) {
  console.log(`Opening a new tab for match link: ${matchLink}`);
  const originalWindowHandle = await driver.getWindowHandle();

  // Open a new tab
  await driver.executeScript("window.open('');");
  const handles = await driver.getAllWindowHandles();
  await driver.switchTo().window(handles[handles.length - 1]);

  await driver.get(matchLink);

  console.log("Extracting and logging the HTML content of the page.");
  const pageHtml = await driver.getPageSource();

  // Check if "Your Free Trial Is Over" is in the page content
  if (
    pageHtml.includes(
      "Your Free Trial Is Over" || pageHtml.includes("Match Abandoned")
    )
  ) {
    console.log(
      "Free trial message detected or match has been abandoned. Closing the tab and skipping this match."
    );
    await driver.close();
    await driver.switchTo().window(originalWindowHandle);
    return "";
  }

  // const outputPath = path.join(__dirname, "page-content.html");
  // fs.writeFileSync(outputPath, pageHtml, "utf8");
  // console.log(`Page HTML content has been written to ${outputPath}`);

  console.log("Waiting for 8 seconds to capture network requests...");
  await sleep(8000);

  const resources = await driver.executeScript(
    'return window.performance.getEntriesByType("resource")'
  );

  console.log("Network requests captured:");

  let m3u8Link = resources
    .map((resource) => resource.name)
    .find((link) => link.endsWith("3289416.m3u8")); // Prioritize 3289416.m3u8
  if (!m3u8Link) {
    m3u8Link = resources
      .map((resource) => resource.name)
      .find((link) => link.endsWith("1756808.m3u8")); // Then check for 1756808.m3u8
  }
  if (!m3u8Link) {
    m3u8Link = resources
      .map((resource) => resource.name)
      .find((link) => link.endsWith("master.m3u8")); // Then check for master.m3u8
  }

  if (!m3u8Link) {
    m3u8Link = resources
      .map((resource) => resource.name)
      .find((link) => link.endsWith("414232.m3u8")); // Finally, check for 414232.m3u8
  }
  if (m3u8Link) {
    console.log("Captured m3u8 link:");
    console.log(m3u8Link);
  } else {
    console.log("No m3u8 link ending with '1756808.m3u8' found.");
  }

  // Close the current tab
  await driver.close();
  await driver.switchTo().window(originalWindowHandle);

  return m3u8Link || "";
}

async function main() {
  let driver;
  try {
    driver = await new Builder().forBrowser("chrome").build();

    await login(driver);

    console.log("Fetching schedule data from the API.");
    const url = `https://www.fancode.com/graphql?extensions=%7B%22persistedQuery%22%3A%7B%22version%22%3A1%2C%22sha256Hash%22%3A%22552b9a3d8af3f5dc94b8d308d6837f8b300738cf72025d1d91e4949e105ba9ad%22%7D%7D&operation=query&operationName=FetchScheduleData&variables=%7B%22filter%22%3A%7B%22slug%22%3A%22cricket%22%2C%22collectionId%22%3Anull%2C%22dateRange%22%3A%7B%22fromDate%22%3A%22${getIndianDate()}%22%2C%22toDate%22%3A%22${getIndianDate()}%22%7D%2C%22streamingFilter%22%3A%22STREAMING%22%2C%22isLive%22%3Atrue%2C%22tours%22%3A%5B%5D%7D%7D`;
    console.log(`The API i am using to get data is  - ${url}`);
    const response = await axios.get(url);
    console.log(`Fetched data from the API.`);

    fs.writeFileSync(
      "public/fetchdata.json",
      JSON.stringify(response.data, null, 2)
    );
    console.log("Data written to fetchdata.json");

    const data = fs.readFileSync("public/fetchdata.json", "utf8");
    console.log("Read data from fetchdata.json.");

    const jsonData = JSON.parse(data);
    const matchMap = new Map();
    const matches = [];

    jsonData.data.fetchScheduleData.edges.forEach((edge) => {
      edge.tours.forEach((tour) => {
        tour.matches.forEach((match) => {
          matches.push(match.id);
          matchMap.set(match.id, {
            name: match.name,
            startTime: match.startTime,
            venue: match.venue,
            tour: tour.tour.name,
            scorecard: match.scorecard.cricketScore.description,
            link: "",
            m3u8link: "",
          });
        });
      });
    });

    console.log("Match IDs and details prepared. Extracting m3u8 links.");
    for (const id of matches) {
      try {
        const { stdout: link } = await execPromise(
          `node extractMatchLink.js ${id}`
        );
        const cleanedLink = link.trim();
        if (cleanedLink) {
          const matchDetails = matchMap.get(id);
          matchDetails.link = cleanedLink;
          matchMap.set(id, matchDetails);
        }

        console.log(`Processing match link ${cleanedLink}.`);
        const m3u8Link = await extractM3U8Links(driver, cleanedLink);

        if (m3u8Link) {
          const matchDetails = matchMap.get(id);
          matchDetails.m3u8link = m3u8Link;
          matchMap.set(id, matchDetails);
        }
      } catch (error) {
        console.error(`Error processing match ID ${id}:`, error.message);
      }
    }

    fs.writeFileSync(
      "public/fetchdata.json",
      JSON.stringify(Array.from(matchMap.entries()), null, 2)
    );
    console.log("Data with links written to fetchdata.json");
  } catch (error) {
    console.error("Error occurred:", error.message);
  } finally {
    if (driver) {
      await driver.quit();
    }
  }
}

function getIndianDate() {
  const now = new Date();
  const istOffset = 0 * 60;
  const utcOffset = now.getTimezoneOffset();
  const istDate = new Date(now.getTime() + istOffset * 60000);
  return istDate.toISOString().split("T")[0];
}

main().catch((error) => {
  console.error("Error:", error);
});
