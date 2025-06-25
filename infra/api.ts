// Simplified domain configuration
const ROOT_DOMAIN = 'volpee.de' // TODO: Change this to your domain

function getDomain(stage: string): string {
  const baseDomain = {
    production: ROOT_DOMAIN,
    dev: `dev.${ROOT_DOMAIN}`
    // I've added the substring here because my stage (alessandrovolpicella) results in a too long domain name - even if it is still within the AWS limit
  }[stage] ?? `${stage.substring(0, 8)}.dev.${ROOT_DOMAIN}`
  
  return baseDomain
}

const api = new sst.aws.ApiGatewayV2("MyApi", {
  // I would recommend using access logs - you can override them using transform but first check if they are sufficient
  accessLog: {
    retention: "1 month",
  },
  cors: {
    allowMethods: ['POST'],
    allowOrigins: [getDomain($app.stage), `www.${getDomain($app.stage)}`]
  },
  domain: `api.${getDomain($app.stage)}`
});

api.route("POST /", {
  handler: "packages/functions/src/api.handler",
  memory: "1024 MB",
  timeout: "10 seconds",
  runtime: "nodejs22.x"
});

export default api;
