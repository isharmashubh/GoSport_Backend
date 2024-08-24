const axios = require("axios");
const fs = require("fs");
const { exec } = require("child_process");
const util = require("util");

const execPromise = util.promisify(exec);

function getIndianDate() {
  const now = new Date();
  const istOffset = 5.5 * 60;
  const utcOffset = now.getTimezoneOffset();
  const istDate = new Date(now.getTime() + (istOffset - utcOffset) * 60000);
  return istDate.toISOString().split("T")[0];
}

const today = getIndianDate();
const url = `https://www.fancode.com/graphql?extensions=%7B%22persistedQuery%22%3A%7B%22version%22%3A1%2C%22sha256Hash%22%3A%22552b9a3d8af3f5dc94b8d308d6837f8b300738cf72025d1d91e4949e105ba9ad%22%7D%7D&operation=query&operationName=FetchScheduleData&variables=%7B%22filter%22%3A%7B%22slug%22%3A%22cricket%22%2C%22collectionId%22%3Anull%2C%22dateRange%22%3A%7B%22fromDate%22%3A%22${today}%22%2C%22toDate%22%3A%22${today}%22%7D%2C%22streamingFilter%22%3A%22STREAMING%22%2C%22isLive%22%3Atrue%2C%22tours%22%3A%5B%5D%7D%7D`;

axios
  .get(url)
  .then((response) => {
    fs.writeFile(
      "public/fetchdata.json",
      JSON.stringify(response.data, null, 2),
      (err) => {
        if (err) {
          console.error("Error writing to file", err);
          return;
        }
        console.log("Data written to fetchdata.json");

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
                  link: "",
                  m3u8link: "",
                });
              });
            });
          });

          const fetchLinkForMatches = async (matchIds) => {
            for (const id of matchIds) {
              try {
                const { stdout: link } = await execPromise(
                  `node extractMatchLink.js ${id}`
                );
                const cleanedLink = link.trim();

                const { stdout: m3u8link } = await execPromise(
                  `node extractm3u8Link.js ${cleanedLink}`
                );
                const cleanedM3u8Link = m3u8link.trim();

                if (!cleanedM3u8Link) {
                  console.log("No link found");
                } else {
                  console.log(`The cleaned link is ${cleanedM3u8Link}`);
                }

                if (matchMap.has(id)) {
                  const matchDetails = matchMap.get(id);
                  matchDetails.link = cleanedLink;
                  matchDetails.m3u8link = cleanedM3u8Link;
                  matchMap.set(id, matchDetails);
                }
              } catch (error) {
                console.error(
                  `Error processing match ID ${id}:`,
                  error.message
                );
              }
            }

            fs.writeFile(
              "public/fetchdata.json",
              JSON.stringify(Array.from(matchMap.entries()), null, 2),
              (err) => {
                if (err) {
                  console.error("Error writing to file", err);
                } else {
                  console.log("Data with links written to fetchdata.json");
                }
              }
            );
          };

          fetchLinkForMatches(matches);
        });
      }
    );
  })
  .catch((error) => {
    console.error("Error fetching data", error);
  });
