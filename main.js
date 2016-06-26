var path = require('path');

var rslashimg = require('./library');
var program = require('commander');

var subreddit;

function toInt(num) {
  return parseInt(num, 10);
}
function split(str) {
  return str.split(',');
}
function fullPath(relative) {
  return path.resolve(process.cwd(), relative);
}

program
  .version('1.1.0')
  .arguments('<subreddit>')
  .action(function (sub) {
    subreddit = sub;
  });
program
  .description('Download pictures linked to posts from reddit')
  .option('-n, --number <number>', 'Number of posts to scrape for images', toInt, 25)
  .option('-w, --width <width>', 'Minimum width of images to download', toInt, 1920)
  .option('-h, --height <height>', 'Minimum height of images to download', toInt, 1080)
  .option('-t, --types <types>', 'Types of images to download', split, ['png', 'jpg'])
  .option('-s, --sort <sort>', 'Sort subreddit by filter', /^(hot|new|controversial|top)$/i, 'hot')
  .option('-d, --dir <dir>', 'Directory to save the images to', fullPath, process.cwd())
  .parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
} else {
  rslashimg.pull({
    subreddit: subreddit,
    sort: program.sort,
    dir: program.dir,
    width: program.width,
    height: program.height,
    number: program.number,
    types: program.types,
  });
}

// if (!program.args.length) program.help();
