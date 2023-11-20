const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');


// Base URL of the website
const baseUrl = 'http://mis.molwa.gov.bd/freedom-fighter-list';

// Division IDs and other filters (modify as needed)
const divisionIds = [1,2,3,4,5,6,7,9]; // Add more division IDs as needed
const filters = {
    district_id: '',
    thana_id: '',
    name: '',
    prove_type: '',
    gazette_no: '',
};

function writeRowToCSV(fileName, rowData) {
    const csvData = rowData.join(',') + '\n';
    fs.appendFileSync(fileName, csvData);
}

async function getTotalPages(divisionId) {
    try {
        // Construct the URL for the first page to extract pagination information
        const url = `${baseUrl}?division_id=${divisionId}&page=1&${new URLSearchParams(filters).toString()}`;

        // Fetch the webpage content using Axios
        const response = await axios.get(url);
        const html = response.data;

        // Load the HTML content into Cheerio
        const $ = cheerio.load(html);

        // Find the pagination list
        const paginationList = $('.pagination li'); 

        // Find the last page link (2nd element from the end)
        const lastPageLink = paginationList.eq(-2).find('a').attr('href'); // Extract the page number from the last page link
        const urlParams = new URLSearchParams(lastPageLink.split('?')[1]);
        // Get the value of the "page" parameter
        const lastPageNumber = urlParams.get('page');
        // const lastPageNumber = lastPageLink ? Number(lastPageLink.split('=')[1]) : 1;
        // console.log(lastPageNumber);

        return lastPageNumber;
    } catch (error) {
        console.error(`Error for division ${divisionId}:`, error);
        return 1; // Default to 1 page if an error occurs
    }
}

async function scrapePage(divisionId, pageNumber) {
    try {
        // console.log('Scrapping ...');
        // Construct the URL with the desired division ID and page number
        const url = `${baseUrl}?division_id=${divisionId}&page=${pageNumber}&${new URLSearchParams(filters).toString()}`;

        // Fetch the webpage content using Axios
        const response = await axios.get(url);
        const html = response.data;

        // Load the HTML content into Cheerio
        const $ = cheerio.load(html);

        // Find the table you want to extract data from (you may need to inspect the page's HTML to determine the table's structure)
        const table = $('table').eq(0); // Change the index (0) if there are multiple tables on the page

        // Loop through table rows and extract data from the previous columns and the 10th column link
        for (const row of table.find('tr').get()) {
            // Extract data from previous columns (columns 1-9)
            const columns = $(row).find('td');
            const rowData = [];

            // Loop through columns 1-9 (indices 0-8)
            for (let colIndex = 0; colIndex < 9; colIndex++) {
                const columnText = columns.eq(colIndex).text().trim();
                rowData.push(columnText);
            }

            // Extract the link from the 10th column (you can customize this part)
            const linkColumn = columns.eq(9); // 10th column (index 0-9)
            const link = linkColumn.find('a').attr('href');

            // Extract the image path from the details page
            const detailsLink = link; // Assuming the link points to the details page
            if (detailsLink) {
                rowData.push(detailsLink);
                const detailsResponse = await axios.get(detailsLink);
                const detailsHtml = detailsResponse.data;
                const $details = cheerio.load(detailsHtml);

                // Find the image path under the specified <div> structure
                const imagePath = $details('.panel-body .row .col-md-2 .thumbnail').attr('src');

                if(imagePath){
                    const fileName = path.basename(imagePath);
                    const destination = path.join(__dirname, 'images', 'division_'+divisionId, path.basename(detailsLink), fileName);
                    downloadImage(imagePath, destination)
                    .then(() => console.log('Image Saved to storage'))
                    .catch(err => console.error('Error:', err));
                }
                rowData.push(imagePath);
            }

            // Output both the extracted data and the link
            if (rowData.length > 0){
                console.log(`Division ${divisionId} - Page ${pageNumber} Data:`, rowData.join(' | '));
                const csvFileName = `division_${divisionId}_data.csv`;
                writeRowToCSV(csvFileName, rowData);
            } // Separate columns with '|'
            // console.log('Link:', link);
            // console.log(''); // Add a line break between rows
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

async function scrapeAllPagesForDivision(divisionId) {
    try {
        // Determine the total number of pages (you may need to extract this from the pagination structure)
        // const totalPages = await getTotalPages(divisionId);
        const totalPages = await getTotalPages(divisionId); 

        // Loop through all pages and scrape data for the division
        if (totalPages){
            // console.log(totalPages)
            for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
                // console.log(pageNumber);
                await scrapePage(divisionId, pageNumber);
            }
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

async function downloadImages(url, destination) {
    try {
      const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
      });
  
      const writer = fs.createWriteStream(destination);
  
      response.data.pipe(writer);
  
      return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    } catch (error) {
      console.error('Error downloading the image:', error);
      throw error;
    }
}

async function downloadImage(url, destination) {
    try {
      // Ensure the destination directory exists
      const dir = path.dirname(destination);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
  
      const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
      });
  
      const writer = fs.createWriteStream(destination);
  
      response.data.pipe(writer);
  
      return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    } catch (error) {
      console.error('Error downloading the image:', error);
      throw error;
    }
}

(async () => {
    // Your code here
    
    for (const divisionId of divisionIds) { 
        await scrapeAllPagesForDivision(divisionId);
    } 
})();
