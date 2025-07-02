import { distribution } from "./cf3";

export const frontend = new sst.aws.StaticSite("frontend", {
  path: "app/frontend-upload-files",
  environment: {
    VITE_CLOUDFRONT_URL: $interpolate`https://${distribution.domainName}`,
  },
});
