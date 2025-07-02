// Minimal CloudFront distribution for POST forwarding with no caching
// Origin: AWS App Runner at nrfzytm7by.us-east-1.awsapprunner.com
// TODO: Make apprunner dynamic + rename

export const distribution = new aws.cloudfront.Distribution("streaming-3-http3-distribution", {
  origins: [{
    domainName: "nrfzytm7by.us-east-1.awsapprunner.com",
    originId: "apprunner-origin",
    customOriginConfig: {
      httpPort: 80,
      httpsPort: 443,
      originProtocolPolicy: "https-only",
      originSslProtocols: ["TLSv1.2"],
    },
  }],
  
  enabled: true,
  comment: "CloudFront distribution with HTTP/3 support - no caching, POST forwarding",
  
  // Enable HTTP/3 and HTTP/2 support
  httpVersion: "http3",
  
  defaultCacheBehavior: {
    targetOriginId: "apprunner-origin",
    viewerProtocolPolicy: "redirect-to-https",
    allowedMethods: [
      "DELETE",
      "GET", 
      "HEAD",
      "OPTIONS",
      "PATCH",
      "POST",
      "PUT",
    ],
    cachedMethods: [
      "GET",
      "HEAD",
    ],
    forwardedValues: {
      queryString: true,
      // Forward specific headers instead of "*" to avoid Host header issues
      headers: [
        "Accept",
        "Accept-Charset", 
        "Accept-Datetime",
        "Accept-Encoding",
        "Accept-Language",
        "Authorization",
        "Content-Type",
        "Content-Length",
        "User-Agent",
        "X-Forwarded-For",
        "X-Forwarded-Proto",
        // Additional headers for file uploads
        "Content-Disposition",
        "Content-Transfer-Encoding",
        "X-Requested-With",
        "Cache-Control",
        "Origin",
        "Referer",
      ],
      cookies: {
        forward: "all",
      },
    },
    compress: false, // Disable compression for faster POST forwarding
    minTtl: 0,
    defaultTtl: 0, // No caching
    maxTtl: 0, // No caching
  },
  
  restrictions: {
    geoRestriction: {
      restrictionType: "none",
    },
  },
  
  viewerCertificate: {
    cloudfrontDefaultCertificate: true,
  },
  
  tags: {
    Name: "streaming-3-minimal-forwarding",
    Project: "streaming-3",
  },
});

// Export the CloudFront domain name
export const distributionDomainName = distribution.domainName;
export const distributionId = distribution.id;
