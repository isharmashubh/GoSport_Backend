const { Builder, By, until } = require("selenium-webdriver");
const fs = require("fs");
const config = JSON.parse(fs.readFileSync("config.json", "utf8"));
const email = config.email;
const password = config.password;
async function extractM3U8Links(matchLink) {
  let driver;
  try {
    driver = await new Builder().forBrowser("chrome").build();

    // Navigate to the match link
    await driver.get(matchLink);

    // Sleep to allow the page to load
    await sleep(3000);

    // Click the Login button
    try {
      const loginButton = await driver.findElement(
        By.css('span[data-analytics*="LoginButtonClicked"]')
      );
      await loginButton.click();
    } catch (error) {
      console.error("Failed to click the Login button:", error.message);
    }

    // Wait for and click the Google login icon
    await sleep(3000);
    try {
      const googleLoginIcon = await driver.findElement(
        By.css(
          'img[src="/fc-web/1724415142272/build/desktop/client/images/googleLogocd64e1c5e13a274a8a91.png"]'
        )
      );
      await googleLoginIcon.click();
    } catch (error) {
      console.error("Failed to click the Google login icon:", error.message);
    }

    // Store the original window handle
    const originalWindowHandle = await driver.getWindowHandle();

    // Switch to the new tab/window that opens
    const handles = await driver.getAllWindowHandles();
    await driver.switchTo().window(handles[1]);

    // Wait for the email input field and fill it out
    const emailField = await driver.wait(
      until.elementLocated(By.css('input[type="email"]')),
      10000
    );

    try {
      await emailField.sendKeys(email);
    } catch (error) {
      console.error("Failed to enter email address:", error.message);
    }

    // Wait for and click the 'Next' button
    const nextButton = await driver.wait(
      until.elementLocated(By.xpath('//button[.//span[text()="Next"]]')),
      10000
    );

    try {
      await nextButton.click();
    } catch (error) {
      console.error("Failed to click the 'Next' button:", error.message);
    }

    // Wait for the password input field and fill it out
    await sleep(3000);
    const passwordField = await driver.wait(
      until.elementLocated(By.css('input[type="password"][name="Passwd"]')),
      10000
    );

    try {
      await passwordField.sendKeys(password);
    } catch (error) {
      console.error("Failed to enter password:", error.message);
    }

    // Locate and click the 'Next' button after entering the password
    const nextPasswordButton = await driver.wait(
      until.elementLocated(By.xpath('//button[.//span[text()="Next"]]')),
      10000
    );

    try {
      await nextPasswordButton.click();
    } catch (error) {
      console.error(
        "Failed to click the 'Next' button after entering password:",
        error.message
      );
    }

    // Wait for the login popup to close
    await driver.wait(async () => {
      const handles = await driver.getAllWindowHandles();
      return handles.length === 1;
    }, 30000);

    // Switch back to the original window handle
    await driver.switchTo().window(originalWindowHandle);

    // Open a new tab with the match link
    await driver.switchTo().newWindow("tab");
    await driver.get(matchLink);

    // Wait for 30 seconds to capture network requests
    await sleep(30000);

    // Fetch and print all network requests from the browser
    const resources = await driver.executeScript(
      'return window.performance.getEntriesByType("resource")'
    );

    // Extract the first .m3u8 link found
    const m3u8Link = resources
      .map((resource) => resource.name)
      .find((link) => link.endsWith("1756808.m3u8"));

    if (m3u8Link) {
      // Print only the m3u8 link to the console
      console.log(m3u8Link);
    } else {
      // Print an empty string if no link is found
      console.log("");
    }
  } catch (error) {
    console.error(`Error extracting m3u8 link: ${error.message}`);
    // Print an empty string in case of an error
    console.log("");
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
  // Print an empty string in case of an error
  console.log("");
});
