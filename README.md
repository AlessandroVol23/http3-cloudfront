# HTTP/3 File Upload with CloudFront and App Runner

A demonstration application showcasing **HTTP/3 chunked file uploads** using AWS CloudFront, App Runner, and a React frontend. This project demonstrates how to leverage HTTP/3's performance benefits for parallel file uploads while working around App Runner's HTTP/1.1 limitations.

## What This Application Does

This application enables **high-performance file uploads** by:
- **Chunking large files** into smaller pieces (5MB each)
- **Uploading chunks in parallel** using HTTP/3's multiplexing capabilities
- **Automatic protocol translation** from HTTP/3 to HTTP/1.1 for backend compatibility
- **Real-time progress tracking** for each chunk upload

## Architecture Overview

```
[React Frontend] --HTTP/3--> [CloudFront] --HTTP/1.1--> [App Runner] --> [S3 Bucket]
```

### Infrastructure Components

#### 1. **S3 Bucket** (`infra/upload-bucket.ts`)
Stores all uploaded file chunks.

```typescript
export const uploadBucket = new sst.aws.Bucket("upload-bucket");
```

#### 2. **App Runner Service** (`infra/apprunner.ts`)
- **Runtime**: Node.js 18 Express API
- **Protocol**: HTTP/1.1 only (App Runner limitation)
- **Function**: Receives file chunks and uploads them to S3
- **IAM Permissions**: Full S3 access for the upload bucket

```typescript
export const apprunnerService = new aws.apprunner.Service("http3-streaming-api", {
    serviceName: "streaming-3-api",
    sourceConfiguration: {
        codeRepository: {
            sourceDirectory: "app/api",
            codeConfiguration: {
                configurationValues: {
                    runtime: "NODEJS_18",
                    buildCommand: "npm install",
                    startCommand: "npm run start",
                    port: "8080",
                    runtimeEnvironmentVariables: {
                        BUCKET_NAME: uploadBucket.name,
                    }
                }
            }
        }
    }
});
```

#### 3. **CloudFront Distribution** (`infra/cloudfront.ts`)
- **HTTP/3 Support**: Enabled for fastest upload speeds
- **Protocol Translation**: HTTP/3 → HTTP/1.1 to App Runner
- **Caching**: Disabled (TTL=0) for dynamic upload requests
- **Headers**: Forwards all necessary headers for file uploads

```typescript
export const cfDistribution = new aws.cloudfront.Distribution("http3-distribution", {
    httpVersion: "http3",
    defaultCacheBehavior: {
        allowedMethods: ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"],
        compress: false,
        minTtl: 0,
        defaultTtl: 0, // No caching
        maxTtl: 0,
        forwardedValues: {
            headers: [
                "Content-Type", "Content-Length", "Authorization",
                "Content-Disposition", "Content-Transfer-Encoding"
            ]
        }
    }
});
```

#### 4. **React Frontend** (`app/frontend-upload-files/`)
- **Chunking**: Splits files into 5MB chunks
- **Parallel Uploads**: Uses `Promise.all()` for concurrent chunk uploads
- **Progress Tracking**: Real-time progress bar and chunk status
- **HTTP/3 Detection**: Instructions for verifying HTTP/3 usage

```typescript
// File chunking logic
const createFileChunks = (file: File): ChunkInfo[] => {
    const chunks: ChunkInfo[] = []
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
    
    for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, file.size)
        chunks.push({
            chunk: file.slice(start, end),
            index: i,
            totalChunks,
            fileName: file.name
        })
    }
    return chunks
}

// Parallel upload
const uploadPromises = chunks.map(chunkInfo => uploadChunk(chunkInfo))
await Promise.all(uploadPromises)
```

## How It Works

1. **File Selection**: User selects a file in the React frontend
2. **Chunking**: File is split into 5MB chunks
3. **Parallel Upload**: All chunks uploaded simultaneously via HTTP/3
4. **Protocol Translation**: CloudFront converts HTTP/3 to HTTP/1.1
5. **S3 Storage**: App Runner receives chunks and stores them in S3
6. **Progress Tracking**: Real-time updates show chunk completion status

## Common Problems & Solutions

### Problem 1: App Runner HTTP/3 Limitation
**Issue**: App Runner only supports HTTP/1.1, not HTTP/3 or HTTP/2.

**Solution**: Use CloudFront as a protocol translator:
- Client → CloudFront: HTTP/3 (fast, multiplexed)
- CloudFront → App Runner: HTTP/1.1 (compatible)

### Problem 2: Header Forwarding
**Issue**: CloudFront doesn't forward all headers by default.

**Solution**: Explicitly configure header forwarding in CloudFront:
```typescript
forwardedValues: {
    headers: [
        "Content-Type", "Content-Length", "Authorization",
        "Content-Disposition", "Content-Transfer-Encoding"
    ]
}
```

### Problem 3: CORS for Browser Uploads
**Issue**: Browser blocks cross-origin requests.

**Solution**: Configure CORS in the Express API:
```javascript
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
});
```

### Problem 4: Node.js Version Limitations in Pulumi
**Issue**: Pulumi's AWS provider has outdated Node.js runtime options for App Runner, only supporting up to Node.js 18.

**Current Limitation**: While AWS App Runner supports Node.js 22, Pulumi's type definitions only include:
- `NODEJS_12`, `NODEJS_14`, `NODEJS_16`, `NODEJS_18`

**Workaround**: Use Node.js 18 for now:
```typescript
codeConfigurationValues: {
    runtime: "NODEJS_18", // Would prefer NODEJS_22 but not supported yet
    buildCommand: "npm install",
    startCommand: "npm run start",
    port: "8080"
}
```

**Status**: [Issue opened](https://github.com/pulumi/pulumi-aws/issues/5648) with Pulumi to update Node.js runtime options.

## Testing HTTP/3

### Method 1: Browser DevTools
1. Open DevTools (F12) → Network tab
2. Upload a file through the React frontend
3. Look for "h3" or "HTTP/3" in the Protocol column
4. You'll see multiple parallel requests for chunked uploads

### Method 2: Command Line Testing
```bash
# Install HTTP/3 client
brew install cloudflare-quiche

# Test HTTP/3 connection
quiche-client --method POST https://your-cloudfront-url.cloudfront.net/upload

# Detailed output
quiche-client --method POST --dump-json https://your-cloudfront-url.cloudfront.net/upload
```

## Deployment

```bash
# Deploy all infrastructure
sst deploy

# The deployment will output:
# - CloudFront URL (HTTP/3 enabled)
# - App Runner URL (HTTP/1.1 only)
# - S3 Bucket name
```

## Performance Benefits

- **HTTP/3 Multiplexing**: Upload multiple chunks simultaneously without head-of-line blocking
- **Reduced Latency**: QUIC protocol eliminates multiple round trips
- **Better Mobile Performance**: UDP-based transport handles poor network conditions better
- **Parallel Processing**: Multiple chunks processed concurrently by App Runner

## Key Files

- `app/api/server.js` - Express API with chunked upload handling
- `app/frontend-upload-files/src/App.tsx` - React frontend with chunking logic
- `infra/cloudfront.ts` - CloudFront configuration with HTTP/3 support
- `infra/apprunner.ts` - App Runner service configuration