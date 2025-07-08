import { cfDistribution } from "./cloudfront";

export const frontend = new sst.aws.StaticSite("frontend", {
  path: "app/frontend-upload-files",
  build: {
    command: "npm run build",
    output: "dist",
  },
  environment: {
    // Assuming we only have one alias here. But I'm pretty sure typically this is shared in another way not via the CF Alias.
    VITE_CLOUDFRONT_URL: $interpolate`https://${cfDistribution.aliases[0]}`,
  },
});
