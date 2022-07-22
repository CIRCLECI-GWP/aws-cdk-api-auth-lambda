import {
  Stack,
  StackProps,
  aws_s3 as s3,
  aws_dynamodb as dynamodb,
  aws_lambda as lambda,
  aws_apigateway as apigateway,
  Duration
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class AwsCdkApiAuthLambdaCircleCiStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // we will add all the constructs here
    // replace bucket name with a unique name
    const circleCiGwpBucket = new s3.Bucket(this, "CircleCIGwpAuthExampleBucket", {
      bucketName: "circle-ci-gwp-auth-new-example-bucket",
    });

    const circleCiGwpTable = new dynamodb.Table(this, "CircleCIGwpAuthExampleTable", {
      tableName: "CircleCIGwpAuthNewExampleTable",
      partitionKey: { name: "jobId", type: dynamodb.AttributeType.STRING },
    });

    const circleCiGwpLambda = new lambda.Function(
      this,
      "CircleCiGwpProcessJobLambda",
      {
        runtime: lambda.Runtime.NODEJS_14_X,
        handler: "index.handler",
        timeout: Duration.seconds(30),
        code: lambda.Code.fromAsset("lambda/processJob/"),
        environment: {
          TABLE_NAME: circleCiGwpTable.tableName,
          BUCKET_NAME: circleCiGwpBucket.bucketName
        },
      }
    );

    circleCiGwpBucket.grantPut(circleCiGwpLambda);
    circleCiGwpTable.grantReadWriteData(circleCiGwpLambda);

    const circleCiAuthLambda = new lambda.Function(
      this,
      "CircleCiAuthLambda",
      {
        runtime: lambda.Runtime.NODEJS_14_X,
        handler: "index.handler",
        timeout: Duration.seconds(30),
        code: lambda.Code.fromAsset("lambda/authorizer/"),
      }
    );

    const circleCiAuthorizer = new apigateway.TokenAuthorizer(this, 'CircleCIGWPAuthorizer', {
      handler: circleCiAuthLambda
    });

    const circleCiGwpApi = new apigateway.RestApi(this, "CircleCIGWPAPI", {
      restApiName: "Circle CI GWP API",
      description: "Sample API for Circle CI GWP"
    });

    const jobResource = circleCiGwpApi.root.addResource("jobs");

    const processJobIntegration = new apigateway.LambdaIntegration(
      circleCiGwpLambda
    );

    jobResource.addMethod("POST", processJobIntegration, {
      authorizer: circleCiAuthorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    const circleCiUsagePlan = circleCiGwpApi.addUsagePlan('CircleCiUsagePlan', {
      name: 'CircleCiEasyPlan',
      throttle: {
        rateLimit: 100,
        burstLimit: 2
      }
    });
    
    const circleCiApiKey = circleCiGwpApi.addApiKey('CircleCiApiKey');
    circleCiUsagePlan.addApiKey(circleCiApiKey);
  }
}