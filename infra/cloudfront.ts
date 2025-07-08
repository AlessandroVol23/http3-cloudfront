import { apprunnerService } from "./apprunner";
import { getDomain, ROOT_DOMAIN } from "../utils/domain";

// Get the storage subdomain for the current stage
const baseDomain = getDomain($app.stage);
const storageDomain = `storage.${baseDomain}`;


// Create AWS provider for us-east-1 (required for CloudFront certificates)
const usEast1Provider = new aws.Provider("us-east-1-provider", {
  region: "us-east-1",
});

// Create ACM certificate in us-east-1 (required for CloudFront)
const certificate = new aws.acm.Certificate("storage-certificate", {
  domainName: storageDomain,
  validationMethod: "DNS",
}, {
  provider: usEast1Provider,
});

// Get the hosted zone for the domain
const hostedZone = aws.route53.getZone({
  name: ROOT_DOMAIN, 
  privateZone: false,
});

// Create Route 53 validation records
const certificateValidationRecords = certificate.domainValidationOptions.apply(options => 
  options.map(option => 
    new aws.route53.Record(`cert-validation-${option.domainName}`, {
      name: option.resourceRecordName,
      type: option.resourceRecordType,
      records: [option.resourceRecordValue],
      zoneId: hostedZone.then(zone => zone.zoneId),
      ttl: 60,
    })
  )
);

// Wait for certificate validation
const certificateValidation = new aws.acm.CertificateValidation("storage-certificate-validation", {
  certificateArn: certificate.arn,
  validationRecordFqdns: certificateValidationRecords.apply(records => 
    records.map(record => record.fqdn)
  ),
}, {
  provider: usEast1Provider,
});

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
  
  // Add custom domain aliases
  aliases: [storageDomain],
  
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
    // Use the created ACM certificate
    acmCertificateArn: certificateValidation.certificateArn,
    sslSupportMethod: "sni-only",
    minimumProtocolVersion: "TLSv1.2_2021",
  },

}, {
  // CloudFront distribution depends on certificate validation
  dependsOn: [certificateValidation],
});

// Create Route 53 alias record for the custom domain
const aliasRecord = new aws.route53.Record("storage-alias", {
  name: storageDomain,
  type: "A",
  zoneId: hostedZone.then(zone => zone.zoneId),
  aliases: [{
    name: cfDistribution.domainName,
    zoneId: cfDistribution.hostedZoneId,
    evaluateTargetHealth: false,
  }],
});

// Export the CloudFront domain name and custom domain
export const distributionDomainName = cfDistribution.domainName;
export const distributionId = cfDistribution.id;
export const customDomainName = storageDomain;
export const certificateArn = certificate.arn;
