import { apprunnerService } from "./apprunner";

export const cfDistribution = new aws.cloudfront.Distribution("http3-distribution", {
  origins: [{
    domainName: apprunnerService.serviceUrl,
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
  
  // TODO: As fallback I'd also activate http
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

});

// Export the CloudFront domain name
export const distributionDomainName = cfDistribution.domainName;
export const distributionId = cfDistribution.id;
