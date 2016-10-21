var Q = require('q');
var fs = require('fs');
var path = require('path');

var s3publishers = require("./publishers").s3;
var thisPublisher;
var s3Config;


function makeManyFiles(number) {
    try {
        var filename = "testfile";
        var files = [];

        for (var i = 0; i < number; i++) {
            var thisFilePromise = Q.promise(function (resolvePromise, rejectPromise) {
                try {
                    var thisFileName = filename + "-" + (i + 1) + ".txt";
                    var thisFilePath = path.resolve("files/" + thisFileName);
                    fs.writeFile(thisFilePath, "this is the content in file: " + thisFileName, 'utf-8', function (err, data) {
                        if (err) {
                            rejectPromise(err)
                        }
                        else {
                            resolvePromise({filename: thisFileName, filepath: thisFilePath});
                        }
                    });
                }
                catch (e) {
                    rejectPromise(e);
                }
            });

            files.push(thisFilePromise);
        }

        return Q.all(files)
            .then(function (files) {
                return files
            })
            .catch(function (err) {
                return Q.reject(err);
            })
    }
    catch (e) {
        return Q.reject(e);
    }
}

function getTestConfiguration() {
    return Q.promise(function (resolvePromise, rejectPromise) {
        try {
            fs.readFile('s3.json', 'utf-8', function (err, data) {
                if (err) {
                    rejectPromise(err)
                }
                else {
                    try {
                        s3Config = JSON.parse(data);
                        resolvePromise(true)
                    }
                    catch (e) {
                        rejectPromise(e);
                    }
                }
            })
        }
        catch (e) {
            rejectPromise(e);
        }
    });
}

function test_listBucketContents(bucket, prefix) {
    try {
        return thisPublisher.listObjects(bucket, prefix)
    }
    catch (e) {
        return Q.reject(e);
    }
}

function test_createAndUploadManyFiles(number, bucket, prefix, force) {
    try {
        return makeManyFiles(Math.min(number, 100))
            .then(function (testFiles) {
                //now lets upload the files
                try {
                    var uploadPromises = testFiles.map(function (file) {
                        return thisPublisher.upload(file.filepath, bucket, [prefix, file.filename].join("/"), force)
                            .catch(function (err) {
                                return Q.reject(err)
                            })
                    });

                    return Q.all(uploadPromises);
                }
                catch (e) {
                    return Q.reject(e)
                }
            })
            .catch(function (err) {
                return Q.reject(err);
            });
    }
    catch (e) {
        return Q.reject(e);
    }
}

function test_getASingleFileAsStream(bucket, key) {
    try {
        return thisPublisher.downloadStream(bucket, key)
    }
    catch (e) {
        return Q.reject(e);
    }
}

function runTest() {
    try {
        getTestConfiguration()
            .then(function (loadedConfig) {
                if (loadedConfig) {
                    thisPublisher = s3publishers.createClient(
                        s3Config.accessKey,
                        s3Config.secretAccessKey
                    );
                    return test_getASingleFileAsStream(s3Config.targetBucket, "Bullets2Bandages/c66181cb69e4410888a1cbdb79ef0712.json")
                    // return test_listBucketContents(s3Config.targetBucket,"Bullets2Bandages")
                    // return test_createAndUploadManyFiles(50, s3Config.targetBucket,"DumpingGround", true)
                        .then(function (result) {
                            debugger;
                            return result;
                            console.log(result);
                        })
                        .catch(function (err) {
                            return Q.reject(err);
                        })
                }
                else {
                    return Q.reject(new Error("Couldn't Run tests"));
                }
            })
            .catch(function (err) {
                console.error(err.message);
            })
            .finally(function () {
                console.log("Test Chain complete");
                // process.exit(0)
            })
            .done();
    }
    catch (e) {
        debugger;
        console.log(e);
    }

}


runTest();

