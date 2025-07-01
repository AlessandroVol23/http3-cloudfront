const express = require("express");

const app = express();

app.post("/upload", (req, res) => {
  res.send("hello world");
});

app.listen(8080, "0.0.0.0"); 