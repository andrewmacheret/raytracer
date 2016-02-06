"use strict";

var React = require('react');
var ReactDOM = require('react-dom');

var ProgressBar = React.createClass({
  propTypes: {
    text: React.PropTypes.string.isRequired,
    start: React.PropTypes.number.isRequired,
    end: React.PropTypes.number.isRequired,
    customProp: function(props, propName, componentName) {
      if (props.start >= props.end) {
        return new Error('Start must be before end (start=' + start + ' end=' + end + ')');
      }
    }
  },

  getDefaultProps: function() {
    return {
      start: 0,
      end: 0
    }
  },

  getInitialState: function() {
    return {
      progress: this.props.start,
      show: true
    };
  },

  validateProgress: function(progress) {
    if (progress < this.props.start || progress > this.props.end) {
      throw 'Progress must be between ' + this.props.start + ' and ' + this.props.end + ' (inclusive)';
    }
  },

  updateProgress: function(progress) {
    this.validateProgress(progress);
    this.setState({
      progress: progress,
      show: this.state.show
    });
  },

  show: function() {
    this.setState({
      progress: this.state.progress,
      show: true
    });
  },

  hide: function() {
    this.setState({
      progress: this.state.progress,
      show: false
    });
  },

  render: function() {
    var percent = 100 * ((this.state.progress - this.props.start) / (this.props.end - this.props.start));
    var display = this.state.show ? 'block' : 'none';
    return (
      <div className="progress-bar-wrapper" style={{display: display}}>
        <div className="progress-bar-text">{this.props.text}</div>
        <div className="progress-bar">
          <div style={{width: percent + '%'}}></div>
        </div>
      </div>
    );
  }
});

module.exports = ProgressBar;
