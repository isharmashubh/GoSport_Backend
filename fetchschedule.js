const axios = require("axios");
const fs = require("fs");
const { exec } = require("child_process");

function getIndianDate() {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60; // IST offset in minutes
  const utcOffset = now.getTimezoneOffset(); // Current timezone offset in minutes
  const istDate = new Date(now.getTime() + (istOffset - utcOffset) * 60000);
  return istDate.toISOString().split("T")[0];
}

// Get today's date in YYYY-MM-DD format
const today = getIndianDate();

// Construct the URL with today's date
const url = `https://www.fancode.com/graphql?extensions=%7B%22persistedQuery%22%3A%7B%22version%22%3A1%2C%22sha256Hash%22%3A%22552b9a3d8af3f5dc94b8d308d6837f8b300738cf72025d1d91e4949e105ba9ad%22%7D%7D&operation=query&operationName=FetchScheduleData&variables=%7B%22filter%22%3A%7B%22slug%22%3A%22cricket%22%2C%22collectionId%22%3Anull%2C%22dateRange%22%3A%7B%22fromDate%22%3A%22${today}%22%2C%22toDate%22%3A%22${today}%22%7D%2C%22streamingFilter%22%3A%22STREAMING%22%2C%22isLive%22%3Atrue%2C%22tours%22%3A%5B%5D%7D%7D`;

axios
  .get(url)
  .then((response) => {
    // Write fetched data to fetchdata.json
    fs.writeFile(
      "public/fetchdata.json",
      JSON.stringify(response.data, null, 2),
      (err) => {
        if (err) {
          console.error("Error writing to file", err);
          return;
        }
        console.log("Data written to fetchdata.json");

        // Read data from fetchdata.json
        fs.readFile("public/fetchdata.json", "utf8", (err, data) => {
          if (err) {
            console.error("Error reading from file", err);
            return;
          }

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
                  link: "", // Initialize with an empty string
                  m3u8link: "",
                });
              });
            });
          });

          // Function to fetch link for each match ID
          const fetchLinkForMatches = (matchIds) => {
            let completed = 0;

            matchIds.forEach((id) => {
              exec(`node extractMatchLink.js ${id}`, (error, stdout) => {
                if (error) {
                  console.error(
                    `Error executing extractMatchLink.js for ID ${id}`,
                    error
                  );
                  return;
                }
                const link = stdout.trim();

                exec(
                  `node extractm3u8Link.js ${link},${id}`,
                  (error, stdout) => {
                    if (error) {
                      console.error(
                        `Error executing extractm3u8Link.js for ID ${id}`,
                        error
                      );
                      return;
                    }
                    const m3u8link = stdout.trim();
                    if (matchMap.has(id)) {
                      const matchDetails = matchMap.get(id);
                      matchDetails.link = link;
                      matchDetails.m3u8link = m3u8link;
                      matchMap.set(id, matchDetails);
                    }

                    completed++;
                    // Check if all match links have been processed
                    if (completed === matchIds.length) {
                      // Save the updated map to fetchdata.json
                      fs.writeFile(
                        "public/fetchdata.json",
                        JSON.stringify(Array.from(matchMap.entries()), null, 2),
                        (err) => {
                          if (err) {
                            console.error("Error writing to file", err);
                          } else {
                            console.log(
                              "Data with links written to fetchdata.json"
                            );
                          }
                        }
                      );
                    }
                  }
                );
              });
            });
          };

          // Fetch links for all match IDs
          fetchLinkForMatches(matches);
        });
      }
    );
  })
  .catch((error) => {
    console.error("Error fetching data", error);
  });
