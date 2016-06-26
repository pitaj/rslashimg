'use strict';

var url = require('url');
var fs = require('fs');
var path = require('path');

var reddit = require('redwrap');
var sharp = require('sharp');
var request = require('request');
var MultiProgress = require('multi-progress');
var async = require('async');

var rslashimg;
var log;

function download(dir, images, next) {
  var multi = new MultiProgress(process.stderr);

  async.map(images, function (imageURL, cb) {
    var pat = path.join(dir, path.basename(imageURL.pathname));
    var stream = fs.createWriteStream(pat);

    function err(error) {
      log('Failed to retrieve image', url.format(imageURL));
      log(error);
    }

    stream.on('error', err);

    request
      .get(url.format(imageURL))
      .on('response', function (res) {
        var size = parseInt(res.headers['content-length'], 10);

        var bar = multi.newBar('  downloading [:bar] :percent :etas', {
          complete: '=',
          incomplete: ' ',
          width: 30,
          total: size,
        });

        res.on('data', function (chunk) {
          if (bar.tick) {
            bar.tick(chunk.length);
          }
        });

        res.on('end', function () {
          cb(null, pat);
        });
      })
      .on('error', err)
      .pipe(stream);
  }, next);
}

function imageSize(imageFile, next) {
  sharp(imageFile).metadata(function (err, data) {
    if (err) {
      next(err);
      return;
    }
    next(null, {
      width: data.width,
      height: data.height,
    });
  });
}

rslashimg = {
  getRealURL: {
    'imgur.com': function (types, img) {
      img.host = 'i.imgur.com';
      img.pathname += '.jpg';
      if (img.pathname.indexOf('/a/') > -1 ||
        img.pathname.indexOf('/gallery/') > -1) {
        return false;
      }
      return rslashimg.getRealURL['i.imgur.com'](types, img);
    },
    'i.imgur.com': function (types, img) {
      img.protocol = 'http:';
      img.search = '';
      return img;
    },
    default: function (types, img) {
      var type = path.extname(img.pathname).replace('.', '');
      if (types.indexOf(type) < 0 || img.protocol === 'https:') {
        return false;
      }
      return img;
    },
  },
  defaults: {
    number: 25,
    width: 1920,
    height: 1080,
    types: ['png', 'jpg'],
    sort: 'hot',
    dir: './',
    // subreddit: 'earthporn', // is a required option
  },
  scrape: function (options, next) {
    reddit.r(options.subreddit).sort(options.sort).limit(options.number)
    .exe(function (err, data) {
      if (err) {
        next(err);
        return;
      }

      data = data.data.children.map(function (child) {
        return child.data.url;
      });

      next(null, data);
    });
  },
  pull: function (options, cb) {
    cb = cb || function () {};
    log('\n\n');

    async.waterfall([
      rslashimg.scrape.bind(null, options),
      function (images, next) {
        if (!images || !images.length) {
          next(new Error('No images selected'));
          return;
        }

        images = images.map(function (imageURL) {
          var getURL;
          imageURL = url.parse(imageURL);
          getURL = rslashimg.getRealURL[imageURL.hostname] || rslashimg.getRealURL.default;
          return getURL(options.types, imageURL);
        }).filter(function (imageURL) {
          return imageURL;
        });

        log('\nDownloading %d images to %s', images.length, options.dir);

        next(null, images);
      },
      download.bind(null, options.dir),
      function (paths, next) {
        log('\nDownload of all images finished');

        if (options.width > 0 && options.height > 0) {
          log('\nValidating image resolutions');
          async.map(paths, imageSize, function (err, sizes) {
            if (err) {
              next(err);
              return;
            }
            paths.forEach(function (p, index) {
              if (sizes[index].width < options.width ||
                  sizes[index].height < options.height) {
                log('Deleted ', p);
                fs.unlinkSync(p);
              }
            });
            next();
          });
        } else {
          next();
        }
      },
    ], function (err) {
      if (err) {
        console.error(err);
        cb(err);
        return;
      }
      log('\nDone. Enjoy your images!');
      cb();
    });
  },
};

log = rslashimg.log || console.log.bind(console);

module.exports = rslashimg;
