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
    const { distribution } = await import("./infra/cf3");
    const { uploadBucket } = await import("./infra/upload-bucket");
    const { frontend } = await import("./infra/frontend");
    const { appRunnerService, appRunnerUrl } = await import("./infra/apprunner");
    return {
      distribution: distribution.domainName,
      uploadBucket: uploadBucket.name,
      frontend: frontend.url,
      appRunnerService: appRunnerUrl,
    };
  },
});
