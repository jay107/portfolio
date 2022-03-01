const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const { append } = require("vary");
const bodyparser = require("body-parser");
const dotenv = require("dotenv");
const { stringify } = require("querystring");
const port = 5000;

const app = express();

dotenv.config();

const msgSchema = new mongoose.Schema({
    name: String,
    email: String,
    topic: String,
    msg: String
});

const msgCons = mongoose.model("MSG", msgSchema);

mongoose.connect(process.env.DB, {
    useNewUrlParser: true, 
    useUnifiedTopology: true
}).then(() => app.listen(port, () => {
    console.log(`app is running on port ${port}, and app is connected to dbongo`)
})).catch(error => console.log(error))

app.use(bodyparser.json());

app.use(bodyparser.urlencoded({
    extended: true
}));

app.get("/", (req, res) => {
    res.send("hello from backend !")
});

app.post("/login", (req, res) => {
    var msg = new msgCons(req.body);

    msg.save().then(res.status(200).json({message: "message saved successfully.."})).catch(err => {
        res.status(400).json({ error: "something went wrong.."});
    })
});

