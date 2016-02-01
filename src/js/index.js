"use strict";

var React = require('react');
var ReactDOM = require('react-dom');

var Scene = require('./scene.js');

ReactDOM.render((
    <Scene width="500" height="500" />
  ),
  document.getElementById('content')
);
