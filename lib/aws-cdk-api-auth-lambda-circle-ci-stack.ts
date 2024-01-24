import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export class AwsCdkApiAuthLambdaCircleCiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
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
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "index.handler",
        timeout: cdk.Duration.seconds(30),
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
        timeout: cdk.Duration.seconds(30),
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