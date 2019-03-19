const express = require("express");
const app = express();
const multer = require("multer");
const ejs = require("ejs");
const bodyparser = require("body-parser");
const port = process.env.Port || 3000;
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Document = require("./models/Document");
const keys = require('./config/keys')

let finData = "";
let fName = "";

//Middleware for body-parser
app.use(
    bodyparser.urlencoded({
        extended: false
    })
);
app.use(bodyparser.json());

//MongoDb connection
mongoose
    .connect(keys.mongoURI)
    .then(() => {
        console.log("MongoDB is connected");
    })
    .catch(() => {
        console.log("error in mongoose connection");
    });

//Storage Config for Multer
const storage = multer.diskStorage({
    destination: "./uploads/",
    filename: function (req, file, cb) {
        cb(null, file.fieldname + "-" + Date.now());
    }
});

//Upload config for Multer
const upload = multer({
    storage,
    fileFilter: function (req, file, cb) {
        if (file.mimetype != "text/html") {
            cb(new Error("It is not a html document"));
        } else {
            return cb(null, true);
        }
    }
}).single("upload");

//Set View Engine as EJS
app.set("view engine", "ejs");

app.get("/", (req, res) => {
    res.render("index", {
        msg: "",
        doc: ""
    });
});

//remove all html document if any
fs.readdir("./uploads", (err, files) => {
    if (err) throw err;

    for (const file of files) {
        fs.unlink(path.resolve(__dirname, `./uploads/${file}`), err => {
            if (err) throw err;
        });
    }
});

app.post("/profile", (req, res) => {
    upload(req, res, err => {
        if (err) {
            res.render("index", {
                msg: err
            });
        } else {
            if (typeof req.file == "undefined") {
                res.render("index", {
                    msg: "No file"
                });
            } else {
                fName = req.file.filename;
                fs.readFile(
                    path.resolve(__dirname, `./uploads/${fName}`),
                    (err, data) => {
                        if (err) {
                            console.log(err);
                        }
                        finData = data.toString("utf8");
                        finData = finData.replace(/<[^>]*>/g, "").trim();

                        //saving in MongoDB
                        Document.findOne({
                                name: fName
                            })
                            .then(doc => {
                                if (doc) {
                                    res.render("index", {
                                        msg: "Document name is already there"
                                    });
                                } else {
                                    new Document({
                                            name: fName,
                                            data: finData
                                        })
                                        .save()
                                        .then(() => {
                                            res.render("index", {
                                                msg: `sucess ${fName} is saved`
                                            });
                                        })
                                        .catch(err => console.log(err));
                                }
                            })
                            .catch(err => console.log("error while saving in MongoDB"));
                    }
                );
            }
        }
    });
});

app.get("/vf", (req, res) => {
    res.render("vf", {
        data: [],
        num: "",
        limit: "",
        count: 0
    });
});

app.get("/mf", (req, res) => {
    res.render("mf", {
        msg: ""
    });
});

app.get("/displayFile", (req, res) => {
    res.render("displayFile", {
        msg: []
    });
});

app.post("/modify", (req, res) => {
    if (!req.body) {
        res.render("mf", {
            msg: "Error: Wrong File Name or File is not present"
        });
    }
    let name = req.body.fileName.trim();
    Document.findOne({
        name
    }).then(doc => {
        if (doc) {
            let data;
            doc.data = req.body.stringData;
            doc
                .save()
                .then(doc => {
                    res.render("view", {
                        data: doc.data
                    });
                })
                .catch(() => console.log("error in updating..."));
        } else {
            res.render("mf", {
                msg: "Error: Wrong File Name or File is not present"
            });
        }
    });
});

app.post("/viewDisplay", (req, res) => {
    if (!req.body) {
        res.render("displayFile", {
            msg: "Error: Wrong File Name or File is not present"
        });
    }
    let name = req.body.fileName.trim();
    Document.findOne({
            name
        })
        .then(doc => {
            if (doc) {
                res.render("view", {
                    data: doc.data
                });
            } else {
                res.render("displayFile", {
                    msg: "Error: Wrong File Name or File is not present"
                });
            }
        })
        .catch(() => {
            res.render("displayFile", {
                msg: "Error: Wrong File Name or File is not present"
            });
        });
});

app.post("/getPageNumber", (req, res) => {
    let pageNumber = "",
        limit = "",
        count = ''
    pageNumber = parseInt(req.body.pageNumber.trim(), 10);
    limit = parseInt(req.body.limit.trim(), 10);
    Document.count()
        .then(tot => {
            count = tot
        })
        .catch(err => console.log(err))

    Document.find()
        .skip(pageNumber > 0 ? (pageNumber - 1) * limit : 0)
        .limit(limit)
        .sort({
            name: -1
        })
        .then(docs => {
            res.render("vf", {
                data: docs,
                num: pageNumber,
                limit,
                count
            });
        });
});

app.listen(port, () => {
    console.log("server is started...");
});