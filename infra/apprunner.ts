import { uploadBucket } from "./upload-bucket";

// Update this where the repository is located
const REPOSITORY_URL = "https://github.com/AlessandroVol23/http3-cloudfront";

// The connection to establish a connection between AppRunner and GitHub
// ⚠️ Handshake needs to be done manually
// If you have an existing connection you can also reuse it
export const githubConnection = new aws.apprunner.Connection("connectionResource", {
    connectionName: "github-source-connection",
    providerType: "GITHUB",
});

// IAM role for App Runner instance (runtime permissions)
const appRunnerInstanceRole = new aws.iam.Role("apprunner-instance-role", {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: {
            Service: "tasks.apprunner.amazonaws.com"
        },
        Action: "sts:AssumeRole"
      },
    ],
  }),
});

// Policy to allow access to S3 bucket
const s3Policy = new aws.iam.Policy("apprunner-s3-policy", {
  policy: uploadBucket.arn.apply(bucketArn =>
    JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: [
            "s3:GetObject",
            "s3:PutObject",
            "s3:DeleteObject",
          ],
          Resource: `${bucketArn}/*`,
        },
        {
          Effect: "Allow",
          Action: ["s3:ListBucket"],
          Resource: bucketArn,
        },
      ],
    })
  ),
});

// Attach the S3 policy to the instance role
new aws.iam.RolePolicyAttachment("apprunner-s3-policy-attachment", {
  role: appRunnerInstanceRole.name,
  policyArn: s3Policy.arn,
});

export const apprunnerService = new aws.apprunner.Service("http3-streaming-api", {
    serviceName: "streaming-3-api",
    instanceConfiguration: {
        instanceRoleArn: appRunnerInstanceRole.arn,
    },
    sourceConfiguration: {
        authenticationConfiguration: {
            connectionArn: githubConnection.arn,
        },
        codeRepository: {
            sourceDirectory: "app/api",
            repositoryUrl: REPOSITORY_URL,
            sourceCodeVersion: {
                type: "BRANCH",
                value: "main"
            },
            codeConfiguration: {
                configurationSource: "API",
                codeConfigurationValues: {
                    runtime: "NODEJS_18",
                    buildCommand: "npm install",
                    startCommand: "npm run start",
                    port: "8080",
                }
            }
        },

    }, 
});