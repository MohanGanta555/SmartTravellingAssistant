const axios = require('axios');

const API_KEY = "7190df52790f42829f74483228b09a7f";
const lat = 19.0760;
const lon = 72.8777;

// Testing specific new categories to ensure they are valid
const categoriesToTest = [
  "entertainment.museum",
  "commercial.shopping_mall",
  "entertainment.cinema",
  "natural.mountain", // Checking if this exists
  "entertainment.culture.theatre"
];

const categories = categoriesToTest.join(',');

const radius = 10000;
const limit = 5;

async function testCategories() {
  try {
    console.log("Testing New Geoapify Categories...");
    const url = `https://api.geoapify.com/v2/places`;
    const params = {
      categories,
      filter: `circle:${lon},${lat},${radius}`,
      bias: `proximity:${lon},${lat}`,
      limit,
      apiKey: API_KEY
    };
    
    console.log("Categories:", categories);

    const response = await axios.get(url, { params });
    
    console.log("Status:", response.status);
    console.log("Success! Found", response.data.features.length, "places.");
    if (response.data.features.length > 0) {
      console.log("Sample categories found:", response.data.features[0].properties.categories);
    }
  } catch (error) {
    console.error("Error:", error.message);
    if (error.response) {
      console.error("Response Status:", error.response.status);
      console.error("Response Data:", JSON.stringify(error.response.data, null, 2));
    }
  }
}

testCategories();
