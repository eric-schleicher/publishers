var Q = require('q');

var Publishers = {
    "s3": {
        checkFile: function (localfile, s3Params) {
            var that = this;
            //verify a client
            if (!that.s3client) {
                return Q.reject(new Error("No Active S3 Client, make sure to call 'createClient' with your credenatials"));
            }

            return Q.promise(function (resolvePromise, rejectPromise) {
                //here we're just getting the list from the bucket that will be used
                var listParams = {
                    "s3Params": {
                        "Bucket": s3Params.Bucket,
                        "Prefix": s3Params.Key
                    }
                };
                var searchResult =false
                var bucketList = that.s3client.listObjects(listParams);

                bucketList.on('error', function (err) {
                    rejectPromise(err);
                });
                bucketList.on('data', function (data) {
                    //inspect the result to see if the file we're looking for is present
                    try{
                        if (data && data.Contents.length){
                            if (data.Contents[0].Key === s3Params.Key) {
                                debugger;
                                searchResult=true;
                            }
                        }

                        if (typeof that.log==='function'){
                            that.log("progress", bucketList.progressAmount, bucketList.progressTotal);
                        }
                        else{
                            console.log("progress", bucketList.progressAmount, bucketList.progressTotal);
                        }
                    }
                    catch(e){
                        rejectPromise(e);
                    }
                });
                bucketList.on('end', function () {
                    //if we got here, we didn't find it.
                    try{

                        resolvePromise(searchResult);
                    }
                    catch(e){
                        debugger;
                    }
                });

            })

        },
        upload: function (localFile, s3Params, force) {
            var that = this;
            //verify a client
            if (!that.s3client) {
                return Q.reject(new Error("No Active S3 Client, make sure to call 'createClient' with your credenatials"));
            }

            if (force === undefined) {
                force = false;
            }

            //1) check the file exists in the s3bucket
            try {
                return that.checkFile(localFile, s3Params)
                    .then(function (fileExistsAlready) {
                        if ((fileExistsAlready && force === true)|| !fileExistsAlready) {
                            return
                        }
                        else {
                            return Q.reject(new Error("The requested for upload already exists an force option not used"));
                        }
                    })
                    .then(function () {
                        var params = {
                            localFile: localFile,
                            s3Params: s3Params
                        };

                        return Q.promise(function (resolvePromise, rejectPromise) {
                            var uploader = that.s3client.uploadFile(params);

                            uploader.on('error', function (err) {
                                rejectPromise(err);
                            });
                            uploader.on('progress', function () {
                                if (typeof that.log ==='function'){
                                    that.log("progress", uploader.progressMd5Amount, uploader.progressAmount, uploader.progressTotal);
                                }
                                else{
                                    console.log("progress", uploader.progressMd5Amount, uploader.progressAmount, uploader.progressTotal)
                                }
                            });
                            uploader.on('end', function () {
                                resolvePromise({"local": localFile, "remote":"https://" + s3Params.Bucket + ".s3.amazonaws.com/" + s3Params.Key});

                            });

                        })

                    });
            }
            catch (e) {
                return Q.reject(e);
            }
        },
        createClient: function (accessKey, secretAccessKey) {
            try {
                if (!this.s3) {
                    this.s3 = require('s3');
                }

                if (!this.s3Client) {
                    this.s3client = this.s3.createClient({
                        maxAsyncS3: 20,     // this is the default
                        s3RetryCount: 3,    // this is the default
                        s3RetryDelay: 1000, // this is the default
                        multipartUploadThreshold: 20971520, // this is the default (20 MB)
                        multipartUploadSize: 15728640, // this is the default (15 MB)
                        s3Options: {
                            accessKeyId: accessKey,
                            secretAccessKey: secretAccessKey
                            // any other options are passed to new AWS.S3()
                            // See: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Config.html#constructor-property
                        }
                    });
                }

                return this;
            }
            catch (e) {
                throw e
            }
        },
        samplePublishOptions: function(){
            return {
                "method": "s3",
                "destination": {
                    Bucket: [s3Credentials.targetBucket].join("/")
                    //Key: filename.split(path.sep).pop()
                    // other options supported by putObject, except Body and ContentLength.
                    // See: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property
                },
                "forceOverwrite":true,
                "bucketSubfolder":thisHost,
                "credentials": {
                    accessKey: s3Credentials.accessKey,
                    secretAccessKey: s3Credentials.secretAccessKey
                },
                cleanUpOnSuccess:true
            };
        }
    }
};

module.exports  = Publishers;