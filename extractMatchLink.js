const axios = require("axios");
const cheerio = require("cheerio");

// URL of the webpage to scrape
const webpageUrl = "https://www.fancode.com/cricket/schedule"; // Replace with the actual URL of the webpage you want to scrape

// Get match ID from command-line argument
const matchId = process.argv[2];
// Check if match ID is provided
if (!matchId) {
  console.error("Error: match ID is required as a command-line argument.");
  process.exit(1); // Exit with error code
}

axios
  .get(webpageUrl)
  .then((response) => {
    const html = response.data;
    const $ = cheerio.load(html);

    // Find the link associated with the match ID
    let matchLink = $(`a[href*="${matchId}"]`).attr("href");

    if (matchLink) {
      // Construct the full URL if necessary
      if (!matchLink.startsWith("http")) {
        matchLink = "https://www.fancode.com" + matchLink;
      }

      console.log(matchLink); // Output the link
    } else {
      console.log("No match link found for the given match ID."); // Informative message if no link is found
    }
  })
  .catch((error) => {
    console.error("Error fetching webpage:", error.message);
  });
