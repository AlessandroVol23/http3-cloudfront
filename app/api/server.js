const express = require("express");
const multer = require("multer");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { v4: uuidv4 } = require("uuid");

const app = express();

console.log("initialize server");

// Get bucket name from environment variable
const BUCKET_NAME = process.env.BUCKET_NAME;

if (!BUCKET_NAME) {
  console.error("BUCKET_NAME environment variable is required");
  process.exit(1);
}

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
});

// Configure multer for memory storage (files will be held in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
});

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

// Middleware to parse JSON (but not form data - multer will handle that)
app.use(express.json());

app.post("/upload", upload.single('file'), async (req, res) => {
  try {
    console.log("=== UPLOAD REQUEST DEBUG ===");
    console.log("Headers received:", JSON.stringify(req.headers, null, 2));
    console.log("Content-Type:", req.headers['content-type']);
    console.log("Content-Length:", req.headers['content-length']);
    console.log("File received:", req.file ? {
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      bufferSize: req.file.buffer ? req.file.buffer.length : 'no buffer'
    } : "NO FILE");
    console.log("Body keys:", Object.keys(req.body));
    console.log("Body:", req.body);
    console.log("=== END DEBUG ===");
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
        debug: {
          headers: req.headers,
          bodyKeys: Object.keys(req.body),
          hasMultipart: req.headers['content-type']?.includes('multipart/form-data')
        }
      });
    }

    // Generate unique filename
    const fileExtension = req.file.originalname.split('.').pop();
    const uniqueFileName = `${uuidv4()}.${fileExtension}`;
    
    // S3 upload parameters
    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: uniqueFileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      Metadata: {
        originalName: req.file.originalname,
        uploadTime: new Date().toISOString(),
      }
    };

    console.log(`Uploading file ${req.file.originalname} as ${uniqueFileName} to bucket ${BUCKET_NAME}`);

    // Upload to S3
    const command = new PutObjectCommand(uploadParams);
    const result = await s3Client.send(command);
    
    console.log("S3 upload successful:", result.ETag);

    // Return success response
    res.json({
      success: true,
      message: "File uploaded successfully",
      data: {
        fileName: uniqueFileName,
        originalName: req.file.originalname,
        size: req.file.size,
        contentType: req.file.mimetype,
        bucket: BUCKET_NAME,
        etag: result.ETag,
        uploadTime: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to upload file",
      details: error.message
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    bucket: BUCKET_NAME
  });
});

app.listen(8080, "0.0.0.0", () => {
  console.log("Server running on http://0.0.0.0:8080");
  console.log(`Configured to upload to S3 bucket: ${BUCKET_NAME}`);
}); 