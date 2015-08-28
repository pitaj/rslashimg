"use strict";

var url = require("url");
var fs = require("fs");
var path = require("path");

var reddit = require('redwrap');
var request = require("request");
var gm = require('gm').subClass({ imageMagick: true });
var MultiProgress = require("multi-progress");

var log;

function download(dir, images, next){

  var multi = MultiProgress(process.stderr);

  asyncMap(images, function(image, index, cb){
    var imageURL = image;

    var pat = path.join(dir, imageURL.pathname);

    var stream = fs.createWriteStream( pat );
    stream.on("error", err);

    function err(error){
      log("Failed to retrieve image", url.format(imageURL));
      log(error);
    }

    request
      .get(url.format(imageURL))
      .on('response', function(res){

        var size = parseInt(res.headers['content-length'], 10);

        var bar = multi.newBar('  downloading [:bar] :percent :etas', {
          complete: '=',
          incomplete: ' ',
          width: 30,
          total: size
        });

        res.on('data', function(chunk){
          if(bar.tick){
            bar.tick(chunk.length);
          }
        });

        res.on("end", function(){
          cb(null, pat);
        });
      })
      .on("error", err)
      .pipe(stream);
  }, next);

}

function asyncMap(arr, fn, next){
  var output = [];
  var length = output.length = arr.length;

  var count = 0;

  var push = function(err, data){
    var index = this;
    if(err){
      push = function(){};
      return next(err);
    }

    output[index] = data;
    count += 1;

    if(count >= length){
      next(null, output, arr);
    }
  };

  arr.forEach(function(item, index){
    fn(item, index, push.bind(index));
  });
}

function asyncWaterfall(arr, cb){
  var index = 0;

  function next(err){
    if(err){
      return cb(err);
    }

    index += 1;

    if(index >= arr.length){
      return cb.apply(null, arguments);
    }

    var args = Array.prototype.slice.call(arguments, 1);
    args.push(next);

    arr[index].apply(null, args);
  }

  arr[index](next);
}

function imageSize(imageFile, index, next){
  gm(imageFile).size({}, next);
}

var rslashimg = {
  getRealURL: {
    "imgur.com": function(img) {
      img.host = "i.imgur.com";
      img.pathname += ".jpg";
      if(img.pathname.indexOf("/a/") > -1 ||
        img.pathname.indexOf("/gallery/") > -1){
        return false;
      }
      return rslashimg.getRealURL["i.imgur.com"](img);
    },
    "i.imgur.com": function(img){
      img.protocol = "http:";
      img.search = "";
      return img;
    },
    default: function(img){
      var types = rslashimg.defaults.types.split(",");
      var type = types.filter(function(type){
        return img.pathname.indexOf(type) > -1;
      })[0];
      if(!type || img.protocol === "https:"){
        return false;
      }
      return img;
    }
  },
  defaults: {
    number: 25,
    width: 1920,
    height: 1080,
    types: "png,jpg",
    sort: "hot",
    dir: "./",
    // subreddit: "earthporn", // is a required option
  },
  scrape: function(options, next){
    reddit.r(options.subreddit).sort(options.sort).exe(function(err, data){
      if(err){
        return next(err);
      }

      data = data.data.children.map(function(child){
        return child.data.url;
      });

      next(null, data);
    });
  },
  pull: function(options, cb){

    cb = cb || function(){};

    if(!options.subreddit){
      console.error("subreddit is a necessary parameter");
      return false;
    }

    Object.keys(rslashimg.defaults).forEach(function(key){
      if( options[key] === undefined || isNaN(parseInt(options[key])) !== isNaN(parseInt(rslashimg.defaults[key]))){
        options[key] = rslashimg.defaults[key];
      }
    });

    if(!({
      "hot": true,
      "new": true,
      "controversial": true,
      "top": true
    })[options.sort]){
      options.sort = rslashimg.defaults.sort;
    }

    console.log("\n\n");

    asyncWaterfall([
      rslashimg.scrape.bind(null, options),
      function(images, next){
        if(!images || !images.length){
          return next( Error("Not images selected") );
        }

        images = images.map(function(imageURL){
          imageURL = url.parse(imageURL);
          var getURL = rslashimg.getRealURL[imageURL.hostname] || rslashimg.getRealURL.default;
          return getURL(imageURL);

        }).filter(function(imageURL){
          return imageURL;
        });

        log("\nDownloading %d images to %s", images.length, options.dir);

        next(null, images);
      },
      download.bind(null, options.dir),
      function(paths, images, next){
        log("\nDownload of all images finished");

        if(options.width > 0 && options.height > 0){
          log("\nValidating image resolutions");
          asyncMap(paths, imageSize, function(err, sizes, paths){
            if(err){
              return next(err);
            }
            paths.forEach(function(path, index){
              if(sizes[index].width < options.width ||
                sizes[index].height < options.height){
                log("Deleted ", path);
                fs.unlinkSync(path);
              }
            });
            next();
          });
        } else {
          next();
        }
      }

    ], function(err){
      if(err){
        console.error(err);
        return cb(err);
      }
      log("\nDone. Enjoy your images!");
      cb();
    });

  }
};

log = rslashimg.log || console.log.bind(console);

module.exports = rslashimg;
