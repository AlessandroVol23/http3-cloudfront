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
    }
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

    const uploadUrl = `${cloudFrontUrl}/upload`
    
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
      
    } catch (error) {
      console.error('Upload error:', error)
      setUploadStatus(`Upload error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setUploading(false)
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

        {selectedFile && (
          <div className="file-info">
            <p><strong>Selected file:</strong> {selectedFile.name}</p>
            <p><strong>Size:</strong> {formatFileSize(selectedFile.size)}</p>
            <p><strong>Type:</strong> {selectedFile.type}</p>
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
          disabled={!selectedFile || uploading}
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
