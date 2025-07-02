import { uploadBucket } from "./upload-bucket";
import { distribution } from "./cf3";

export const frontend = new sst.aws.StaticSite("frontend", {
  path: "app/frontend-upload-files",
  environment: {
    VITE_UPLOAD_BUCKET_NAME: uploadBucket.name,
    VITE_CLOUDFRONT_URL: distribution.domainName,
  },
});
