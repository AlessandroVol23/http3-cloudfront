import { uploadBucket } from "./upload-bucket";



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

export const service = new aws.apprunner.Service("example", {
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
            repositoryUrl: "https://github.com/AlessandroVol23/http3-cloudfront",
            sourceCodeVersion: {
                type: "BRANCH",
                value: "main"
            },
            codeConfiguration: {
                configurationSource: "API",
                codeConfigurationValues: {
                    runtime: "NODEJS_18",
                    buildCommand: "cd app/api && npm install",
                    startCommand: "cd app/api && npm start",
                    port: "8080",
                }
            }
        },

    },
    
});


// // App Runner service
// export const appRunnerService = new aws.apprunner.Service("api-service", {
//   serviceName: "streaming-3-api",
//   sourceConfiguration: {
//     autoDeploymentsEnabled: false,
//     codeRepository: {
//         // TODO: Make dynamic
//       repositoryUrl: "https://github.com/AlessandroVol23/http3-cloudfront", // Update this with your actual repository
//       sourceCodeVersion: {
//         type: "BRANCH",
//         value: "main",
//       },
//       codeConfiguration: {
//         configurationSource: "API",
//         codeConfigurationValues: {
//           runtime: "NODEJS_18",
//           buildCommand: "cd app/api && npm install",
//           startCommand: "cd app/api && npm start",
//           runtimeEnvironmentVariables: uploadBucket.name.apply(bucketName => ({
//             NODE_ENV: "production",
//             PORT: "8080",
//             AWS_REGION: "us-east-1",
//             BUCKET_NAME: bucketName,
//           })),
//           port: "8080",
//         },
//       },
//     },
//   },
//   instanceConfiguration: {
//     cpu: "0.25 vCPU",
//     memory: "0.5 GB",
//     instanceRoleArn: appRunnerInstanceRole.arn,
//   },
//   healthCheckConfiguration: {
//     protocol: "HTTP",
//     path: "/health",
//     interval: 20,
//     timeout: 5,
//     healthyThreshold: 2,
//     unhealthyThreshold: 5,
//   },
// });

// // Export the App Runner service URL
// export const appRunnerUrl = appRunnerService.serviceUrl;