var Q = require('q');
var path = require('path');
var fs = require('fs');
var verbose = false;

var Publishers = {
    "s3": {
        setVerbose: function (newValue) {
            verbose = newValue ? true : false;
        },
        checkFile: function (bucket, key) {
            console.info("checking existence of file:", key, "in bucket:", bucket);
            var self = this;
            return self.listObjects(bucket, key)
                .then(function (results) {
                    return results.length ? true : false;
                })
        },
        listObjects: function (bucket, prefix) {
            var self = this;
            //verify a client

            if (!self.s3client) {
                return Q.reject(new Error("No Active S3 Client, make sure to call 'createClient' with your credenatials"));
            }

            var params = {
                s3Params: {
                    "Bucket": bucket,
                    "Prefix": prefix
                }
            };

            var results;
            var numPages = 0;

            return Q.promise(function (resolvePromise, rejectPromise) {
                //go ahead and get the list of the folder's content
                var listEmitter = self.s3client.listObjects(params);

                listEmitter.on("end", function () {
                    console.info("listObjects complete with ", numPages + 1, "pages of data");
                    resolvePromise(results);
                });

                listEmitter.on('error', function (err) {
                    rejectPromise(err);
                });

                listEmitter.on('data', function (data) {
                    if (numPages === 0) {
                        results = data.Contents;
                        numPages++
                    }
                    else {
                        results = results.concat(data.Contents);
                    }
                });

            });
        },
        upload: function (localFile, bucket, key, force) {
            var self = this;
            //verify a client
            if (!self.s3client) {
                return Q.reject(new Error("No Active S3 Client, make sure to call 'createClient' with your credenatials"));
            }

            //if force isn't present, coerce it to be boolean false.
            force = force || false;

            try {
                var shouldUpload = true;
                if (force === false) {
                    return self.checkFile(bucket, key)
                        .then(function (alreadyExists) {
                            if (!force && alreadyExists) {
                                shouldUpload = false;
                                return Q.reject(new Error("Settings prevent upload of file ('force=false')"));
                            }
                            else {
                                return uploadFile();
                            }
                        })
                }
                else {
                    return uploadFile();
                }


                function uploadFile() {
                    console.info("File being uploaded to bucket:", bucket, "(", key, ")");
                    var params = {
                        localFile: localFile,
                        s3Params: {
                            Bucket: bucket,
                            Key: key
                        }
                    };

                    return Q.promise(function (resolvePromise, rejectPromise) {
                        var uploader = self.s3client.uploadFile(params);

                        uploader.on('error', function (err) {
                            rejectPromise(err);
                        });
                        uploader.on('progress', function () {
                            if (verbose) {
                                if (typeof self.log === 'function') {
                                    self.log("progress", uploader.progressMd5Amount, uploader.progressAmount, uploader.progressTotal);
                                }
                                else {
                                    console.log("progress", uploader.progressMd5Amount, uploader.progressAmount, uploader.progressTotal)
                                }
                            }
                        });

                        uploader.on('end', function () {
                            console.info("File Upload Completed for ", bucket + "/" + key);
                            resolvePromise({
                                "url": "https://" + bucket + ".s3.amazonaws.com/" + key,
                                "Bucket": bucket,
                                "Key": key
                            });

                        });

                    })

                }
            }
            catch (e) {
                return Q.reject(e);
            }
        },
        download: function (bucket, key, localFile) {
            var self = this;
            //verify a client
            if (!self.s3client) {
                return Q.reject(new Error("No Active S3 Client, make sure to call 'createClient' with your credenatials"));
            }

            localFile = path.resolve(localFile);
            return Q.promise(function (resolvePromise, rejectPromise) {
                try {
                    fs.stat(localFile, function (err, fileStats) {
                        if (err && err.code === "ENOENT") {
                            resolvePromise(false);
                        }
                        else if (err) {
                            rejectPromise(err)
                        }
                        else {
                            resolvePromise(fileStats);
                        }
                    })
                }
                catch (e) {
                    rejectPromise(e);
                }
            })
                .then(function (fileStat) {
                    if (!fileStat) {
                        //he file doesn't exist
                        var params = {
                            localFile: localFile,
                            s3Params: {
                                Bucket: bucket, //"s3 bucket name",
                                Key: key, //"some/remote/file",
                                // other options supported by getObject
                                // See: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#getObject-property
                            }
                        };
                        return Q.promise(function (resolvePromise, rejectPromise) {
                            try {
                                var downloader = self.s3client.downloadFile(params);
                                downloader.on('error', function (err) {
                                    console.error("unable to download:", err.stack);
                                    rejectPromise(err);
                                });
                                downloader.on('progress', function () {
                                    if (verbose) {
                                        console.log("progress", downloader.progressAmount, downloader.progressTotal);
                                    }
                                });
                                downloader.on('end', function () {
                                    console.log("done downloading file (" + key + ") from", bucket, ".  it's located here: ", localFile);
                                    resolvePromise(localFile);
                                });
                            }
                            catch (e) {
                                rejectPromise(e);
                            }
                        });
                    }
                    else {
                        //the file exists; what should we do
                        debugger;
                    }
                });
        },
        downloadStream: function (bucket, key) {
            try {

            }
            catch (e) {

            }
            var self = this;
            //verify a client
            if (!self.s3client) {
                return Q.reject(new Error("No Active S3 Client, make sure to call 'createClient' with your credenatials"));
            }

            return Q.promise(function (resolvePromise, rejectPromise) {
                var thatStream = self.s3client.downloadStream({Bucket: bucket, Key: key});
                streamResult = "";

                thatStream.on("error", function (err) {
                    rejectPromise(err)
                });

                thatStream.on("readable", function () {
                    try {
                        console.log("readable", readable++);
                        var chunk = thatStream.read();
                        if (chunk !== null) {
                            streamResult += chunk.toString();
                        }
                    }
                    catch (e) {
                        rejectPromise(e);
                    }
                });

                thatStream.on("end", function () {
                    resolvePromise(streamResult)
                });
            });
        },
        createClient: function (accessKey, secretAccessKey) {
            var self = this;
            try {
                if (!self.s3) {
                    self.s3 = require('s3');
                }

                if (!self.s3Client) {
                    self.s3client = self.s3.createClient({
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

                return self;
            }
            catch (e) {
                throw e
            }
        }

    }
};

module.exports = Publishers;