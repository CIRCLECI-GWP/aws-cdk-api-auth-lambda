"use strict";

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
var fs = require('fs');
const { stringify } = require('csv-stringify/sync');
AWS.config.update({ region: 'us-east-1' });

var ddb = new AWS.DynamoDB();
const s3 = new AWS.S3();

const TABLE_NAME = process.env.TABLE_NAME;
const BUCKET_NAME = process.env.BUCKET_NAME;

exports.handler = async function (event) {
  try {
    const uploadedObjectKey = generateDataAndUploadToS3();
    const eventBody = JSON.parse(event["body"]);
    const jobId = eventBody["jobId"];
    
    var params = {
      TableName: TABLE_NAME,
      Item: {
        jobId: { S: jobId },
        reportFileName: { S: uploadedObjectKey },
      },
    };

    // Call DynamoDB to add the item to the table
    await ddb.putItem(params).promise();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "success",
        jobId: jobId,
        objectKey: uploadedObjectKey,
      }),
    };
  } catch (error) {
    throw Error(`Error in backend: ${error}`);
  }
};

const generateDataAndUploadToS3 = () => {
  var filePath = "/tmp/test_user_data.csv";
  const objectKey = `${uuidv4()}.csv`;
  writeCsvToFileAndUpload(filePath, objectKey);
  return objectKey;
};

const uploadFile = (fileName, objectKey) => {
  // Read content from the file
  const fileContent = fs.readFileSync(fileName);

  // Setting up S3 upload parameters
  const params = {
    Bucket: BUCKET_NAME,
    Key: objectKey,
    Body: fileContent,
  };

  // Uploading files to the bucket
  s3.upload(params, function (err, data) {
    if (err) {
      throw err;
    }
    console.log(`File uploaded successfully. ${data.Location}`);
  });
  return objectKey;
};

function writeCsvToFileAndUpload(filePath, objectKey) {
    var data = getCsvData();
    var output = stringify(data);

    fs.writeFileSync(filePath, output);
    // we will add the uploadFile method later
    uploadFile(filePath, objectKey);
}

function getCsvData() {
    return [
      ['1', '2', '3', '4'],
      ['a', 'b', 'c', 'd']
    ];
}