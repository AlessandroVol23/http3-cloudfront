const express = require("express");

const app = express();

console.log("initialize server");

// Add CORS middleware to allow requests from any origin
app.use((req, res, next) => {
  // Allow all origins for now (you can restrict this later)
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

// Middleware to parse JSON and form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post("/upload", (req, res) => {
  console.log("upload request received");
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);
  
  // For now, just return success response
  res.json({
    success: true,
    message: "File upload endpoint working",
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

app.listen(8080, "0.0.0.0", () => {
  console.log("Server running on http://0.0.0.0:8080");
}); 