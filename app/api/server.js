const express = require("express");

const app = express();

console.log("initialize server");

app.post("/upload", (req, res) => {
  console.log("upload");
  res.send("hello world");
});

app.listen(8080, "0.0.0.0"); 