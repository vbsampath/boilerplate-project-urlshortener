require('dotenv').config();
const express = require('express');
const cors = require('cors');
const dns = require('dns');
let bodyParser = require('body-parser');
const app = express();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// Basic Configuration
const port = process.env.PORT || 3000;
const protocolRegex = /^https?:\/\/(.*)/i;
const hostnameRegex = /^([a-z0-9\-_]+\.)+[a-z0-9\-_]+/i;

const urlSchema = new mongoose.Schema({
  url: String,
  index: Number
});
const counterSchema = new mongoose.Schema({
  counter: {type: Number, default: 1}
});
var counterModel = mongoose.model('Counter', counterSchema, 'counter');
var urlModel = mongoose.model('Url', urlSchema, 'url');

app.use(cors());

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Your first API endpoint
app.get('/api/hello', function(req, res) {
  res.json({ greeting: 'hello API' });
});

function increaseCounter(done) {
  counterModel.findOneAndUpdate({}, {$inc: {counter: 1}}, function(err, data) {
    if(err) return;
    if (data) {
      done(data.counter);
    } else {
      let firstCounter = new counterModel();
      firstCounter.save(function(err) {
        if(err) return;
        counterModel.findOneAndUpdate({}, {$inc: {counter: 1}}, function(err, data) {
          if(err) return;
          done(data.counter);
        })
      })
    }
  });
}
app.post("/api/shorturl", function(req, res) {
  let url = req.body.url;
  const protocolMatch = url.match(protocolRegex);
  // console.log('protocolMatch', protocolMatch);
  if (!protocolMatch) {
    return res.json({ error: "invalid url" });
  }
  
  // for dns matching
  const hostAndQuery = protocolMatch[1];
  const hostnameMatch = hostAndQuery.match(hostnameRegex);

  if(hostnameMatch) {
    dns.lookup(hostnameMatch[0], function(err) {
      if(err) return res.json({ error: "invalid url" });
      else {
        urlModel.findOne({url: url}, function(err, searchedUrl) {
          if(err) return;
          if(searchedUrl) {
            let result = {original_url: searchedUrl.url, short_url: searchedUrl.index};
            res.json(result);
          } else {
            increaseCounter(function(counter) {
              let newUrl = urlModel({
                url: url,
                index: counter
              });
              newUrl.save(function(err) {
                if(err) return;
                let result = {original_url: url, short_url: counter};
                res.json(result);
              })
            })
          }
        })
      }
    })
  }
});

app.get("/api/shorturl/:urlIndex", function(req, res) {
  let urlIndex = req.params.urlIndex;
  if(!parseInt(urlIndex)) res.json({error: "Invalid Short Url"});
  urlModel.findOne({index: urlIndex}, function(err, data) {
    if(err) return;
    if(data) res.redirect(data.url);
    else {
      res.json({error: "No url found"});
    }
  });
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
