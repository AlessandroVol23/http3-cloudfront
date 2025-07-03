import { cfDistribution } from "./cloudfront";

export const frontend = new sst.aws.StaticSite("frontend", {
  path: "app/frontend-upload-files",
  build: {
    command: "npm run build",
    output: "dist",
  },
  environment: {
    VITE_CLOUDFRONT_URL: $interpolate`https://${cfDistribution.domainName}`,
  },
});
