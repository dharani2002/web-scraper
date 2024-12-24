import puppeteer from "puppeteer";
import { Parser } from "json2csv";
import fs from "fs";
import nodeSchedule from "node-schedule";

const baseUrl = "https://books.toscrape.com/catalogue/category/books/mystery_3/";

const book_data = [];

async function getBooks(url) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    try {
        await page.goto(url, { waitUntil: "networkidle2" });

        // Extract books data from the current page
        const books = await page.evaluate(() => {
            const bookElements = document.querySelectorAll("article");
            const booksArray = [];

            bookElements.forEach((book) => {
                const title = book.querySelector("h3 a")?.textContent || "N/A";
                const price = book.querySelector(".price_color")?.textContent || "N/A";
                const stock = book.querySelector(".availability")?.textContent.trim() || "N/A";

                booksArray.push({ title, price, stock });
            });

            return booksArray;
        });

        book_data.push(...books); // Append data to the global array
        console.log(`Scraped ${books.length} books from ${url}`);

        // Check if a "Next" button exists and get the next page's URL
        const nextPage = await page.evaluate(() => {
            const nextButton = document.querySelector(".next a");
            return nextButton ? nextButton.getAttribute("href") : null;
        });

        if (nextPage) {
            const nextPageUrl = new URL(nextPage, url).href; // Resolve the full URL
            console.log(`Navigating to next page: ${nextPageUrl}`);
            await page.goto(nextPageUrl, { waitUntil: "networkidle2" }); // Navigate to the next page
            await getBooks(nextPageUrl); // Recursively scrape the next page
        }
    } catch (error) {
        console.error(`Error scraping ${url}:`, error.message);
    } finally {
        await browser.close();
    }
}
//save the book data array into csv
function saveAsCSV(data, fileName) {
    try {
        const parser = new Parser(); // Create a new JSON to CSV parser
        const csv = parser.parse(data); // Convert JSON to CSV
        fs.writeFileSync(fileName, csv); // Save CSV to file
        console.log(`Data successfully saved to ${fileName}`);
    } catch (error) {
        console.error("Error saving data to CSV:", error.message);
    }
}

// Start scraping
// getBooks(`${baseUrl}index.html`).then(() => {
//     console.log("Scraping complete. Total books:", book_data.length);
//     console.log(book_data);
//     saveAsCSV(book_data, "books.csv");
// });

//schedule jobs
function scheduleScraper() {
    // Schedule the task to run every day at midnight
    nodeSchedule.scheduleJob("* * * * *", async () => {
        console.log("Starting scheduled scraping...");
        book_data.length = 0; // Clear previous data
        await getBooks(`${baseUrl}index.html`);
        saveAsCSV(book_data, "./public/temp/books.csv");
        console.log("Scheduled scraping completed!");
    });

    console.log("Scraper scheduled to run every minute.");
}

scheduleScraper();
