/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "streaming-3",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
    };
  },
  async run() {
    const { uploadBucket } = await import("./infra/upload-bucket");
    await import("./infra/apprunner");
    const { cfDistribution } = await import("./infra/cloudfront");
    const { frontend } = await import("./infra/frontend");
    return {
      distribution: cfDistribution.domainName,
      uploadBucket: uploadBucket.name,
      frontend: frontend.url,
    };
  },
});
