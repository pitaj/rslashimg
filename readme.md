# `/r/img`

A utility for downloading pictures linked to posts on reddit.

## CLI

`rslashimg` is the CLI command, run `npm i -g rslashimg` to use it in the command line

#### Examples:

    $ rslashimg earthporn

Downloads images attached to the top 25 posts of the `/r/earthporn` subreddit to the current directory. Handy for making a wallpaper gallery.

#### Usage:

    $ rslashimg <subreddit> [options]

`subreddit` is a required parameter specifying the subreddit to scrape for images

#### Options

|  Command          |  Description                            | Default
| ----------------- | --------------------------------------- | ------------
| `-n`, `--number`  | Number of posts to scrape for images    | `25`
| `-w`, `--width`   | Minimum width of images to download     | `1920`
| `-h`, `--height`  | Minimum height of images to download    | `1080`
| `-t`, `--types`   | Types of images to download             | `"png,jpg"`
| `-s`, `--sort`    | Sort subreddit by filter (see below)    | `hot`
| `-d`, `--dir`     | Directory to save images to             | current dir


**Filters**

- hot
- new
- controversial
- top
