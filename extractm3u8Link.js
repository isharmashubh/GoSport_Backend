const { Builder, By, until } = require("selenium-webdriver");
const fs = require("fs");
const path = require("path");

async function extractM3U8Links(matchLink) {
  // Hardcoded credentials
  const email = "fancode431@gmail.com";
  const password = "FancodeFancode";

  let driver;
  try {
    driver = await new Builder().forBrowser("chrome").build();

    // Navigate to the match link
    console.log(`Navigating to match link: ${matchLink}`);
    await driver.get(matchLink);

    // Sleep to allow the page to load
    await sleep(3000);

    // Extract and log the HTML content of the page
    const pageHtml = await driver.getPageSource();
    console.log("Page HTML content before login:");

    // Write the HTML content to a file
    const outputPath = path.join(__dirname, "page-content.html");
    fs.writeFileSync(outputPath, pageHtml, "utf8");
    console.log(`Page HTML content has been written to ${outputPath}`);

    // Click the Login button
    try {
      console.log("Clicking on the Login button...");
      const loginButton = await driver.findElement(
        By.css('span[data-analytics*="LoginButtonClicked"]')
      );
      await loginButton.click();
      console.log("Login button clicked successfully.");
    } catch (error) {
      console.error("Failed to click the Login button:", error.message);
    }

    // Wait for and click the Google login icon
    await sleep(3000);
    try {
      console.log("Clicking on the Google login icon...");
      const googleLoginIcon = await driver.findElement(
        By.css(
          'img[src="/fc-web/1724415142272/build/desktop/client/images/googleLogocd64e1c5e13a274a8a91.png"]'
        )
      );
      await googleLoginIcon.click();
      console.log("Google login icon clicked successfully.");
    } catch (error) {
      console.error("Failed to click the Google login icon:", error.message);
    }

    // Store the original window handle
    const originalWindowHandle = await driver.getWindowHandle();

    // Switch to the new tab/window that opens
    const handles = await driver.getAllWindowHandles();
    await driver.switchTo().window(handles[1]);

    // Wait for the email input field and fill it out
    console.log("Waiting for the email input field...");
    const emailField = await driver.wait(
      until.elementLocated(By.css('input[type="email"]')),
      10000
    );

    try {
      console.log("Entering email address...");
      await emailField.sendKeys(email);
      console.log("Email address entered successfully.");
    } catch (error) {
      console.error("Failed to enter email address:", error.message);
    }

    // Wait for and click the 'Next' button
    console.log("Waiting for the 'Next' button...");
    const nextButton = await driver.wait(
      until.elementLocated(By.xpath('//button[.//span[text()="Next"]]')),
      10000
    );

    try {
      console.log("Clicking on the 'Next' button...");
      await nextButton.click();
      console.log("'Next' button clicked successfully.");
    } catch (error) {
      console.error("Failed to click the 'Next' button:", error.message);
    }

    // Wait for the password input field and fill it out
    await sleep(3000);
    console.log("Waiting for the password input field...");
    const passwordField = await driver.wait(
      until.elementLocated(By.css('input[type="password"][name="Passwd"]')),
      10000
    );

    try {
      console.log("Entering password...");
      await passwordField.sendKeys(password);
      console.log("Password entered successfully.");
    } catch (error) {
      console.error("Failed to enter password:", error.message);
    }

    await sleep(3000);

    // Locate and click the 'Next' button after entering the password
    console.log("Waiting for the 'Next' button after entering password...");
    const nextPasswordButton = await driver.wait(
      until.elementLocated(By.xpath('//button[.//span[text()="Next"]]')),
      10000
    );

    try {
      console.log(
        "Clicking on the 'Next' button after entering the password..."
      );
      await nextPasswordButton.click();
      console.log("'Next' button clicked successfully after password entry.");
    } catch (error) {
      console.error(
        "Failed to click the 'Next' button after entering password:",
        error.message
      );
    }

    // Wait for the login popup to close
    console.log("Waiting for login popup to close...");
    await driver.wait(async () => {
      const handles = await driver.getAllWindowHandles();
      return handles.length === 1; // Wait until only one window handle remains
    }, 30000);

    // Switch back to the original window handle
    await driver.switchTo().window(originalWindowHandle);

    // Open a new tab with the match link
    console.log("Opening a new tab with the match link...");
    await driver.switchTo().newWindow("tab");
    await driver.get(matchLink);

    // Wait for 30 seconds to capture network requests
    console.log("Waiting for 30 seconds to capture network requests...");
    await sleep(30000);

    // Fetch and print all network requests from the browser
    const resources = await driver.executeScript(
      'return window.performance.getEntriesByType("resource")'
    );

    console.log("Network requests captured:");
    const m3u8Link = resources
      .map((resource) => resource.name)
      .find((link) => link.endsWith("1756808.m3u8"));

    if (m3u8Link) {
      console.log("Captured m3u8 link:");
      console.log(m3u8Link);
    } else {
      console.log("No m3u8 link ending with '1756808.m3u8' found.");
    }
  } catch (error) {
    console.error(`Error extracting network links: ${error.message}`);
  } finally {
    if (driver) {
      await driver.quit();
    }
  }
}

// Custom sleep function to wait for a specified time
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Extracting command line arguments
const args = process.argv.slice(2);
const [matchLink] = args;

if (!matchLink) {
  console.error("Error: matchLink is required as an argument.");
  process.exit(1);
}

extractM3U8Links(matchLink).catch((error) => {
  console.error("Error:", error);
});
