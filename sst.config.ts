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
    const { cloudfront } = await import("./infra/cloudfront");
    const { distribution } = await import("./infra/cf3");
    return {
      cloudfront: cloudfront.url,
      distribution: distribution.domainName,
    };
  },
});
