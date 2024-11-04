const axios = require("axios");
const cheerio = require("cheerio");

// URL of the webpage to scrape
// Replace with the actual URL of the webpage you want to scrape

// Function to fetch match link for a given match ID
async function getMatchLink(matchId, game) {
  if (!matchId) {
    throw new Error("Error: match ID is required.");
  }
  const webpageUrl = `https://www.fancode.com/${game}/schedule`;
  try {
    const response = await axios.get(webpageUrl);
    const html = response.data;
    const $ = cheerio.load(html);

    // Find the link associated with the match ID
    let matchLink = $(`a[href*="${matchId}"]`).attr("href");

    if (matchLink) {
      // Construct the full URL if necessary
      if (!matchLink.startsWith("http")) {
        matchLink = "https://www.fancode.com" + matchLink;
      }

      return matchLink; // Return the link
    } else {
      return "No match link found for the given match ID."; // Informative message if no link is found
    }
  } catch (error) {
    console.error("Error fetching webpage:", error.message);
    throw error;
  }
}

// Export the function so it can be used in other files
module.exports = getMatchLink;
