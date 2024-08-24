const axios = require("axios");
const cheerio = require("cheerio");

// URL of the webpage to scrape
const webpageUrl = "https://www.fancode.com/cricket/schedule"; // Replace with the URL of your webpage

// Get match ID from command-line argument
const matchId = process.argv[2];

axios
  .get(webpageUrl)
  .then((response) => {
    const html = response.data;
    const $ = cheerio.load(html);

    // Find the link associated with the match ID
    let matchLink = $(`a[href*="${matchId}"]`).attr("href");

    if (matchLink) {
      // Construct the full URL if necessary
      matchLink = "https://www.fancode.com" + matchLink;

      console.log(matchLink); // Output the link
    } else {
      console.log(""); // No link found
    }
  })
  .catch((error) => {
    console.error("Error fetching webpage", error);
  });
