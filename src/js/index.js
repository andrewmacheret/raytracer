"use strict";

var React = require('react');
var ReactDOM = require('react-dom');

var Scene = require('./scene.js');

ReactDOM.render((
    <Scene width="200" height="200" antiAliasing="0" />
  ),
  document.getElementById('content')
);
