# raytracer

A simple html5 ray tracer demo written in React.

Prereqs:
* [Node.js](https://nodejs.org/) and [gulp](http://browserify.org/) on a linux server
 * `npm install -g gulp` to install gulp if you already have Node.js
* A web server (like [Apache](https://httpd.apache.org/)).

Installation steps:
* `git clone <clone url>`
* `cd raytracer/`
* `npm install` - this will install required packages as specified in [package.json](package.json)
* Modify the scene in [app.properties](app.properties) as needed
* `gulp build` - this will build all required files to the `build/` directory

Test it:
* Open `build/index.html` in a browser.
 * For testing purposes, if you don't have a web server, running `python -m SimpleHTTPServer` in the `build/` directory and navigating to [http://localhost:8000](http://localhost:8000) should do the trick.
* By default you should see a beatiful 500x500 scene in 3d.
* To troubleshoot, look for javascript errors in the browser console.

