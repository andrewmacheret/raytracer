"use strict";

var React = require('react');
var ReactDOM = require('react-dom');

var Scene = require('./scene.js');

ReactDOM.render((
    <div id="content">
      <Scene width={200} height={200} antiAliasing={1} />
    </div>
  ),
  document.getElementById('content')
);
