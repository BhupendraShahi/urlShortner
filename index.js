require("dotenv").config();
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const mongoose = require("mongoose");
const ShortUrl = require("./models/shortUrl");
const app = express();
require("./auth");

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: false }));

app.use(session({ secret: "cats", resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

function isLoggedIn(req, res, next) {
  req.user ? next() : res.sendStatus(401);
}

app.get("/", (req, res) => {
  res.render("login");

});

app.get("/protected", async (req, res) => {
  const shortUrls = await ShortUrl.find();
  res.render("index", { shortUrls: shortUrls });
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["email", "profile"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    successRedirect: "/protected",
    failureRedirect: "/auth/google/failure",
  })
);

app.get("/auth/google/failure", (req, res) => {
  res.render("login");
});

app.get("/logout", (req, res) => {
  req.logout(req.user, err => {
    if(err) return next(err);
    res.redirect("/");
  });
});

app.post("/shortUrls", async (req, res) => {
  // checking if the url is already present in the database
  const check = await ShortUrl.findOne({ full: req.body.fullUrl });

  //if url is not present, create one.
  //note* if we want different shortened url for the already present Full url,
  //remove the above code and then remove the if condition below
  if (check == null) {
    await ShortUrl.create({ full: req.body.fullUrl });
  } 

  res.redirect("/protected");
});

app.get("/:shortUrl", async (req, res) => {
  //finding the shortened url in the database
  //and re-directing the corresponding full url
  const shortUrl = await ShortUrl.findOne({ short: req.params.shortUrl });
  if (shortUrl == null) return res.sendStatus(404);

  //incrementing the click and saving in the database
  shortUrl.clicks++;
  shortUrl.save();

  res.redirect(shortUrl.full);
});

//delete data older than 30 days
//if the data is accessed in ast 30 days it will stay for additional 30 days
//any data which has't been accessed in last 30 days will be deleted
//this will run every day once
async function deleteOldDocument() {
  const date = new Date();
  date.setDate(date.getDate()-30);

  await ShortUrl.deleteMany({"updatedAt": {$lt: date}});

  setTimeout(async ()=>{
      await deleteOldDocument();
  }, 86400000);
};

deleteOldDocument();

app.listen(4000 || process.env.PORT, () =>
  console.log("listening on port: 4000")
);
