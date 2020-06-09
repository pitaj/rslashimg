
const url = require('url');
const fs = require('fs');
const path = require('path');

const reddit = require('redwrap');
const sharp = require('sharp');
const request = require('request');
const Progress = require('progress');
const MultiProgress = require('multi-progress')(Progress);
const async = require('async');

const log = (...args) => console.log(...args);

function download(dir, images, next) {
  const multi = new MultiProgress(process.stderr);

  async.map(images, (imageURL, cb) => {
    const pat = path.join(dir, path.basename(imageURL.pathname));
    const stream = fs.createWriteStream(pat);

    function err(error) {
      log('Failed to retrieve image', url.format(imageURL));
      log(error);
    }

    stream.on('error', err);

    request
      .get(url.format(imageURL))
      .on('response', (res) => {
        const size = parseInt(res.headers['content-length'], 10);

        const bar = multi.newBar('  downloading [:bar] :percent :etas', {
          complete: '=',
          incomplete: ' ',
          width: 30,
          total: size,
        });

        res.on('data', (chunk) => {
          if (bar.tick) {
            bar.tick(chunk.length);
          }
        });

        res.on('end', () => {
          cb(null, pat);
        });
      })
      .on('error', err)
      .pipe(stream);
  }, next);
}

function imageSize(imageFile, next) {
  sharp(imageFile).metadata((err, data) => {
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

const rslashimg = {
  getRealURL: {
    'imgur.com': (types, img) => {
      if (
        img.pathname.includes('/a/')
        || img.pathname.includes('/gallery/')
      ) {
        return false;
      }

      return rslashimg.getRealURL['i.imgur.com'](types, {
        ...img,
        host: 'i.imgur.com',
        pathname: `${img.pathname}.jpg`,
      });
    },
    'i.imgur.com': (types, img) => ({
      ...img,
      protocol: 'http:',
      search: '',
    }),
    default(types, img) {
      const type = path.extname(img.pathname).replace('.', '');
      if (!types.includes(type) || img.protocol === 'https:') {
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
  scrape(options, next) {
    reddit.r(options.subreddit).sort(options.sort).limit(options.number)
      .exe((err, data) => {
        if (err) {
          next(err);
          return;
        }

        const childrenData = data.data.children.map((child) => child.data.url);

        next(null, childrenData);
      });
  },
  pull(options, cb) {
    log('\n\n');

    async.waterfall([
      (next) => rslashimg.scrape(options, next),
      (images, next) => {
        if (!images || !images.length) {
          next(new Error('No images selected'));
          return;
        }

        const urls = images.map((imageUrl) => {
          const parsed = url.parse(imageUrl);
          const method = rslashimg.getRealURL[parsed.hostname] || rslashimg.getRealURL.default;
          return method(options.types, parsed);
        }).filter(Boolean);

        log('\nDownloading %d images to %s', urls.length, options.dir);

        next(null, urls);
      },
      (images, next) => fs.mkdir(options.dir, { recursive: true }, (err) => next(err, images)),
      (images, next) => download(options.dir, images, next),
      (paths, next) => {
        log('\nDownload of all images finished');

        if (options.width > 0 && options.height > 0) {
          log('\nValidating image resolutions');
          async.map(paths, imageSize, (err, sizes) => {
            if (err) {
              next(err);
              return;
            }
            paths.forEach((p, index) => {
              if (
                sizes[index].width < options.width
                || sizes[index].height < options.height
              ) {
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
    ], (err) => {
      if (err) {
        console.error(err);
        if (cb) { cb(err); }
        return;
      }
      log('\nDone. Enjoy your images!');
      if (cb) { cb(); }
    });
  },
};

module.exports = rslashimg;
