const puppeteer = require("puppeteer");

async function loginToGoogle() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto("https://play.google.com/");

  // Click the login button (assuming there's a login button on the page)
  await page.click("selector-for-login-button"); // Replace with actual selector

  // Wait for the Google login page to load and display the necessary elements
  await page.waitForSelector("#identifierId");

  // Enter the email
  await page.type("#identifierId", "your-email@gmail.com"); // Replace with your email
  await page.click("#identifierNext"); // Click the next button

  // Wait for the password field
  await page.waitForSelector('input[type="password"]', { visible: true });

  // Enter the password
  await page.type('input[type="password"]', "your-password"); // Replace with your password
  await page.click("#passwordNext"); // Click the next button

  // Wait for navigation after login
  await page.waitForNavigation();

  console.log("Logged in successfully.");

  // Now you can continue with your task, like navigating to the desired page
  await page.goto("https://play.google.com/cricket/schedule");

  // You can also scrape or interact with the page after logging in

  // Close the browser
  await browser.close();
}

loginToGoogle().catch(console.error);
