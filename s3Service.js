const { S3 } = require('aws-sdk');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require('@aws-sdk/client-s3');

const uuid = require('uuid').v4;

exports.s3Uploadv2 = async (files) => {
  const s3 = new S3();

  const params = files.map((file) => ({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: `uploads/${uuid()}-${file.originalname}`,
    Body: file.buffer,
  }));

  //s3.upload(param).promise()
  return await Promise.all(params.map((param) => s3.upload(param).promise()));
};

exports.s3Uploadv3 = async (files, folder) => {
  const s3client = new S3Client();

  const params = files.map((file) => ({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: `${folder}/${file.originalname}`,
    Body: file.buffer,
  }));

  // s3client.send(new PutObjectCommand(param))
  return await Promise.all(
    params.map((param) => s3client.send(new PutObjectCommand(param)))
  );
};

exports.s3PresignedV3 = async (name) => {
  const s3client = new S3Client();
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: name,
    // ContentType: `image/png`,
  });
  return await getSignedUrl(s3client, command, { expiresIn: 1 * 60 });
};
