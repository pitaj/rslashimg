"use strict";

var rslashimg = require("./library");

var args = process.argv.splice(2);

args = args.map(function(arg){
  return arg.toLowerCase();
});

function parseArgs(args){
  var opts = {};

  var lone = false, i;

  for(i = 0; i < args.length; i++){
    if(args[i][0] === "-"){
      i++;
    } else {
      lone = args[i];
      break;
    }
  }

  if(lone){
    opts.subreddit = lone;
  }

  var hash = {
    number: ["-n", "--number"],
    width: ["-w", "--width"],
    height: ["-h", "--height"],
    types: ["-t", "--types"],
    sort: ["-s", "--sort"],
    dir: ["-s", "--dir"],
  };

  Object.keys(hash).forEach(function(key){
    var one = hash[key][0], two = hash[key][1];
    args.forEach(function(arg, index){
      if(arg === one || arg === two){
        opts[key] = args[index + 1];
      }
    });
  });

  return opts;
}

rslashimg.pull(parseArgs(args));
