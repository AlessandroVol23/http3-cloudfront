import { useState } from 'react'
import './App.css'

interface ChunkInfo {
  chunk: Blob
  index: number
  totalChunks: number
  fileName: string
  fileId: string
}

interface UploadProgress {
  totalChunks: number
  completedChunks: number
  failedChunks: number
  percentage: number
}

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadKey, setUploadKey] = useState<string>('')
  const [downloading, setDownloading] = useState(false)
  const [downloadKey, setDownloadKey] = useState<string>('')
  const [downloadStatus, setDownloadStatus] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string>('')
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)

  // Get environment variables - SST injects these directly with VITE_ prefix for browser access
  const bucketName = import.meta.env.VITE_UPLOAD_BUCKET_NAME
  const cloudFrontUrl = import.meta.env.VITE_CLOUDFRONT_URL

  // Chunk size: 5MB
  const CHUNK_SIZE = 5 * 1024 * 1024

  // Debug: log environment variables
  console.log('Environment variables:', {
    VITE_UPLOAD_BUCKET_NAME: import.meta.env.VITE_UPLOAD_BUCKET_NAME,
    VITE_CLOUDFRONT_URL: import.meta.env.VITE_CLOUDFRONT_URL,
    allEnvVars: import.meta.env
  })

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setUploadStatus('')
      setUploadProgress(null)
      // Auto-generate a key if none is provided
      if (!uploadKey) {
        setUploadKey(`${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`)
      }
    }
  }

  const handleKeyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUploadKey(event.target.value)
  }

  const handleDownloadKeyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDownloadKey(event.target.value)
  }

  const createFileChunks = (file: File): ChunkInfo[] => {
    const chunks: ChunkInfo[] = []
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
    const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, file.size)
      const chunk = file.slice(start, end)

      chunks.push({
        chunk,
        index: i,
        totalChunks,
        fileName: file.name,
        fileId
      })
    }

    return chunks
  }

  const uploadChunk = async (chunkInfo: ChunkInfo): Promise<void> => {
    const formData = new FormData()
    formData.append('file', chunkInfo.chunk, `${chunkInfo.fileName}.chunk.${chunkInfo.index}`)
    formData.append('bucketName', bucketName || '')
    formData.append('chunkIndex', chunkInfo.index.toString())
    formData.append('totalChunks', chunkInfo.totalChunks.toString())
    formData.append('fileName', chunkInfo.fileName)
    formData.append('fileId', chunkInfo.fileId)

    // Use the upload key in the URL
    const uploadUrl = `${cloudFrontUrl}/upload/${encodeURIComponent(uploadKey)}`
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Chunk ${chunkInfo.index} failed: ${response.status} - ${errorText}`)
    }

    return response.json()
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadStatus('Please select a file first')
      return
    }

    if (!uploadKey.trim()) {
      setUploadStatus('Please provide an upload key')
      return
    }

    if (!cloudFrontUrl) {
      setUploadStatus('CloudFront URL not configured')
      return
    }

    setUploading(true)
    setUploadStatus('Preparing upload...')

    try {
      // Create chunks
      const chunks = createFileChunks(selectedFile)
      
      console.log(`File will be split into ${chunks.length} chunks of ~${(CHUNK_SIZE / 1024 / 1024).toFixed(1)}MB each`)
      
      // Initialize progress
      const progress: UploadProgress = {
        totalChunks: chunks.length,
        completedChunks: 0,
        failedChunks: 0,
        percentage: 0
      }
      setUploadProgress(progress)
      setUploadStatus(`Uploading ${chunks.length} chunks in parallel...`)

      // Upload all chunks in parallel
      const uploadPromises = chunks.map(async (chunkInfo) => {
        try {
          await uploadChunk(chunkInfo)
          
          // Update progress
          setUploadProgress(prev => {
            if (!prev) return prev
            const newCompleted = prev.completedChunks + 1
            const newPercentage = Math.round((newCompleted / prev.totalChunks) * 100)
            return {
              ...prev,
              completedChunks: newCompleted,
              percentage: newPercentage
            }
          })
          
          console.log(`Chunk ${chunkInfo.index + 1}/${chunkInfo.totalChunks} uploaded successfully`)
        } catch (error) {
          // Update failed count
          setUploadProgress(prev => {
            if (!prev) return prev
            return {
              ...prev,
              failedChunks: prev.failedChunks + 1
            }
          })
          throw error
        }
      })

      // Wait for all chunks to complete
      await Promise.all(uploadPromises)

      setUploadStatus(`Upload successful! All ${chunks.length} chunks uploaded.`)
      console.log('All chunks uploaded successfully')
      
      // Auto-populate download key with the upload key for easy testing
      setDownloadKey(uploadKey)
      
    } catch (error) {
      console.error('Upload error:', error)
      setUploadStatus(`Upload error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async () => {
    if (!downloadKey.trim()) {
      setDownloadStatus('Please enter a key to download')
      return
    }

    if (!cloudFrontUrl) {
      setDownloadStatus('CloudFront URL not configured')
      return
    }

    setDownloading(true)
    setDownloadStatus('Downloading...')

    try {
      const downloadUrl = `${cloudFrontUrl}/download/${encodeURIComponent(downloadKey)}`
      
      const response = await fetch(downloadUrl, {
        method: 'GET',
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('File not found')
        }
        const errorText = await response.text()
        throw new Error(`Download failed: ${response.status} - ${errorText}`)
      }

      // Get the filename from the Content-Disposition header or use the key
      const disposition = response.headers.get('Content-Disposition')
      let filename = downloadKey.split('/').pop() || downloadKey
      
      if (disposition && disposition.includes('filename=')) {
        const filenameMatch = disposition.match(/filename="([^"]*)"/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }

      // Create a blob from the response
      const blob = await response.blob()
      
      // Create a download link and trigger the download
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      setDownloadStatus('Download successful!')
      
    } catch (error) {
      console.error('Download error:', error)
      setDownloadStatus(`Download error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setDownloading(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  const getEstimatedChunks = (file: File): number => {
    return Math.ceil(file.size / CHUNK_SIZE)
  }

  return (
    <div className="app">
      <h1>Chunked File Upload</h1>
      
      <div className="upload-container">
        <div className="file-input-container">
          <input
            type="file"
            onChange={handleFileSelect}
            disabled={uploading}
            id="file-input"
          />
          <label htmlFor="file-input" className="file-input-label">
            {selectedFile ? selectedFile.name : 'Choose a file'}
          </label>
        </div>

        <div className="key-input-container">
          <label htmlFor="upload-key" className="key-input-label">
            Upload Key (will be used as S3 key):
          </label>
          <input
            type="text"
            id="upload-key"
            value={uploadKey}
            onChange={handleKeyChange}
            disabled={uploading}
            placeholder="e.g., documents/my-file.pdf or images/photo-2024.jpg"
            className="key-input"
          />
          <small className="key-input-hint">
            This key will be used directly as the S3 object key. Use forward slashes (/) to create folder-like structure.
          </small>
        </div>

        {selectedFile && (
          <div className="file-info">
            <p><strong>Selected file:</strong> {selectedFile.name}</p>
            <p><strong>Size:</strong> {formatFileSize(selectedFile.size)}</p>
            <p><strong>Type:</strong> {selectedFile.type}</p>
            <p><strong>Upload Key:</strong> {uploadKey || 'Not set'}</p>
            <p><strong>Will be split into:</strong> {getEstimatedChunks(selectedFile)} chunks of ~{(CHUNK_SIZE / 1024 / 1024).toFixed(1)}MB each</p>
          </div>
        )}

        {uploadProgress && (
          <div className="progress-container">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${uploadProgress.percentage}%` }}
              ></div>
            </div>
            <div className="progress-text">
              {uploadProgress.completedChunks}/{uploadProgress.totalChunks} chunks uploaded ({uploadProgress.percentage}%)
              {uploadProgress.failedChunks > 0 && (
                <span className="failed-chunks"> - {uploadProgress.failedChunks} failed</span>
              )}
            </div>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!selectedFile || !uploadKey.trim() || uploading}
          className="upload-button"
        >
          {uploading ? 'Uploading...' : 'Upload File'}
        </button>

        {uploadStatus && (
          <div className={`status ${uploadStatus.includes('successful') ? 'success' : 'error'}`}>
            {uploadStatus}
          </div>
        )}
      </div>

      <div className="download-container">
        <h2>Download File</h2>
        
        <div className="key-input-container">
          <label htmlFor="download-key" className="key-input-label">
            Download Key:
          </label>
          <input
            type="text"
            id="download-key"
            value={downloadKey}
            onChange={handleDownloadKeyChange}
            disabled={downloading}
            placeholder="e.g., documents/my-file.pdf or images/photo-2024.jpg"
            className="key-input"
          />
          <small className="key-input-hint">
            Enter the exact S3 key of the file you want to download.
          </small>
        </div>

        <button
          onClick={handleDownload}
          disabled={!downloadKey.trim() || downloading}
          className="download-button"
        >
          {downloading ? 'Downloading...' : 'Download File'}
        </button>

        {downloadStatus && (
          <div className={`status ${downloadStatus.includes('successful') ? 'success' : 'error'}`}>
            {downloadStatus}
          </div>
        )}
      </div>

      <div className="config-info">
        <h3>Configuration</h3>
        <p><strong>Bucket:</strong> {bucketName || 'Not configured'}</p>
        <p><strong>CloudFront URL:</strong> {cloudFrontUrl || 'Not configured'}</p>
        <p><strong>Chunk Size:</strong> {(CHUNK_SIZE / 1024 / 1024).toFixed(1)} MB</p>
        <p><strong>Status:</strong> {import.meta.env.VITE_UPLOAD_BUCKET_NAME ? 'SST Running' : 'Using Test Values'}</p>
        
        <h4>HTTP/3 Information</h4>
        <p><strong>Browser HTTP/3 Support:</strong> {navigator.userAgent.includes('Chrome') ? 'Likely Supported' : 'Check manually'}</p>
        <p><strong>To verify HTTP/3 usage:</strong></p>
        <ol style={{textAlign: 'left', fontSize: '0.8rem', marginLeft: '1rem'}}>
          <li>Open browser DevTools (F12)</li>
          <li>Go to Network tab</li>
          <li>Upload a file</li>
          <li>Check the "Protocol" column (or right-click headers to show it)</li>
          <li>Look for "h3" or "HTTP/3" in the protocol column</li>
          <li>With chunked uploads, you'll see multiple parallel requests!</li>
        </ol>
      </div>
    </div>
  )
}

export default App
