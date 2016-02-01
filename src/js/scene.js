"use strict";

var React = require('react');
var ReactDOM = require('react-dom');

var $ = require('jquery');
var reader = require('properties-reader');

var Vector = require('./vector.js');

var Color = require('./color.js');

var Scene = React.createClass({
  componentWillMount: function() {
    $.get('app.properties').done(function(responseText) {
      var properties = reader().read(responseText);
      this.loadScene(properties);
    }.bind(this));
  },

  loadScene: function(properties) {
    var scene = {
      depth: parseFloat(properties.get('scene.depth')),
      sky: Color.parse(properties.get('scene.sky')),

      camera: {
        position: new Vector(
          parseFloat(properties.get('scene.camera.position.x')),
          parseFloat(properties.get('scene.camera.position.y')),
          parseFloat(properties.get('scene.camera.position.z'))
        ),
        direction: new Vector(
          parseFloat(properties.get('scene.camera.direction.x')),
          parseFloat(properties.get('scene.camera.direction.y')),
          parseFloat(properties.get('scene.camera.direction.z'))
        ).normalized(),
        field: (Math.PI / 180) * parseFloat(properties.get('scene.camera.field'))
      },
      objects: [],
      lights: []
    };

    for (var i = 1; ; i++) {
      var prefix = 'scene.object.' + i + '.';
      var objectType = properties.get(prefix + 'type');
      if (!objectType) {
        break;
      }

      var object;
      switch (objectType) {
        case 'light':
          object = {
            color: Color.parse(properties.get(prefix + 'color')),
            center: new Vector(
              parseFloat(properties.get(prefix + 'center.x')),
              parseFloat(properties.get(prefix + 'center.y')),
              parseFloat(properties.get(prefix + 'center.z'))
            ),
            radius: parseFloat(properties.get(prefix + 'radius')),
            strength: parseFloat(properties.get(prefix + 'strength'))
          };
          break;

        case 'sphere':
          object = {
            diffuse: parseFloat(properties.get(prefix + 'diffuse')),
            reflect: parseFloat(properties.get(prefix + 'reflect')),
            color: Color.parse(properties.get(prefix + 'color')),
            center: new Vector(
              parseFloat(properties.get(prefix + 'center.x')),
              parseFloat(properties.get(prefix + 'center.y')),
              parseFloat(properties.get(prefix + 'center.z'))
            ),
            radius: parseFloat(properties.get(prefix + 'radius'))
          };
          break;

        case 'plane':
          object = {
            diffuse: parseFloat(properties.get(prefix + 'diffuse')),
            reflect: parseFloat(properties.get(prefix + 'reflect')),
            color: Color.parse(properties.get(prefix + 'color')),
            normal: new Vector(
              parseFloat(properties.get(prefix + 'normal.x')),
              parseFloat(properties.get(prefix + 'normal.y')),
              parseFloat(properties.get(prefix + 'normal.z'))
            ).normalized(),
            point: new Vector(
              parseFloat(properties.get(prefix + 'point.x')),
              parseFloat(properties.get(prefix + 'point.y')),
              parseFloat(properties.get(prefix + 'point.z'))
            )
          };
          break;

        default:
          throw 'Unsupported object type: ' + objectType;
      }

      object.type = objectType;
      if (object.type == 'light') {
        scene.lights.push(object);
      } else {
        scene.objects.push(object);
      }
    };

    this.setState({
      scene: scene
    });
  },

  createImage: function(context, scene) {
    var image = context.createImageData(this.props.width, this.props.height);


    var z = 0;
    for (var y = 0; y < this.props.height; y++) {
      for (var x = 0; x < this.props.width; x++) {
        var index = (y * this.props.height + x) * 4;
        var color = this.getColor(x, y);
        image.data[index + 0] = color.r;
        image.data[index + 1] = color.g;
        image.data[index + 2] = color.b;
        image.data[index + 3] = color.a;
      }
      console.log(new Date(), x, y);
    }

    return image;
  },

  getColor: function(x, y) {
    var trueUp = new Vector(0, 0, 1);
    var camera = this.state.scene.camera;
    var h = (this.props.width / 2) / Math.tan(camera.field / 2)
    var xM = this.props.width / 2 - x;
    var yM = this.props.height / 2 - y;

    var right = trueUp.crossProduct(camera.direction).normalized();
    var down = camera.direction.crossProduct(right).normalized();

    // get the point that represents the location on the camera's image
    var rayPoint = camera.position
      .add(camera.direction.multiply(h))
      .add(right.multiply(xM))
      .add(down.multiply(yM));

    // get the direction to the point from the camera
    var rayDirection = rayPoint.subtract(camera.position).normalized();

    // we now have the ray start (camera position) and the ray direction
    // generate a path tree
    var pathTree = this.getPathTree(camera.position, rayDirection, this.state.scene.depth);

    // determine the color of the path tree
    return this.getColorFromPathTree(pathTree);
  },

  getColorIntensitiesFromPathTree: function(pathTree, distance) {
    var colorIntensities = [];

    if (pathTree == null) {
      colorIntensities.push({color: this.state.scene.sky, intensity: 1});
      return colorIntensities;
    }

    var newDistance = distance + pathTree.distance;

    if (pathTree.reflection) {
      this.getColorIntensitiesFromPathTree(pathTree.reflection, newDistance).forEach(function(colorIntensitiy) {
        colorIntensities.push({
          color: colorIntensitiy.color.filterColor(pathTree.object.color),
          intensity: colorIntensitiy.intensity * pathTree.object.reflect
        });
      }.bind(this));
    }

    if (pathTree.diffusions) {
      pathTree.diffusions.forEach(function(diffusion) {
        var diffusionColorIntensities = this.getColorIntensitiesFromPathTree(diffusion, newDistance);
        diffusionColorIntensities.forEach(function(colorIntensitiy) {
          colorIntensities.push({
            color: colorIntensitiy.color.filterColor(pathTree.object.color),
            intensity: colorIntensitiy.intensity * pathTree.object.diffuse
          });
        }.bind(this));
      }.bind(this));
    }

    if (pathTree.object.type == 'light') {
      colorIntensities.push({
        color: pathTree.object.color,
        intensity: pathTree.strength / Math.pow(newDistance / pathTree.object.strength, 2)
      });
    }

    return colorIntensities;
  },

  getColorFromPathTree: function(pathTree) {
    var colorIntensities = this.getColorIntensitiesFromPathTree(pathTree, 0);
    
    // combine the colors with the intensities
    var colors = colorIntensities.map(function(colorIntensitiy) {
      return colorIntensitiy.color.multiply(colorIntensitiy.intensity);
    }.bind(this));

    // add all the colors together (this is the inverse of the subtraction of the inverse colors)
    var finalColor = colors.reduce(function(result, color) {
      return result.filterColor(color.invert());
    }.bind(this), Color.WHITE).invert();
    
    return finalColor.normalized();
  },

  getPathTree: function(rayPosition, rayDirection, depth) {
    if (depth <= 0) return null;

    var closest = null;

    this.state.scene.lights.forEach(function(object) {
      var l = object.center.subtract(rayPosition);
      var lMag = l.magnitude();
      var tca = rayDirection.dotProduct(l);
      if (tca <= 0) return;
      if (lMag <= tca) return;
      var d = Math.sqrt(lMag * lMag - tca * tca);
      if (object.radius <= d) return;
      var thc = Math.sqrt(object.radius * object.radius - d * d);
      var t0 = tca - thc;
      var t1 = tca + thc;
      var newRayPosition = rayPosition.add(rayDirection.multiply(t0));
      var strength = (t1 - t0) / (2 * object.radius);

      var n = newRayPosition.subtract(object.center).normalized();
      var newRayDirection = rayDirection.subtract(n.multiply(2 * rayDirection.dotProduct(n))).normalized();

      var distance = rayPosition.distance(newRayPosition);
      
      if (closest == null || distance < closest.distance) {
        closest = {
          object: object,
          distance: distance,
          position: newRayPosition,
          reflectionDirection: newRayDirection,
          normalDirection: n,
          strength: strength
        };
      }
    });

    this.state.scene.objects.forEach(function(object) {
      switch(object.type) {
        case 'sphere':
          var l = object.center.subtract(rayPosition);
          var lMag = l.magnitude();
          var tca = rayDirection.dotProduct(l);
          if (tca <= 0) break;
          if (lMag <= tca) break;
          var d = Math.sqrt(lMag * lMag - tca * tca);
          if (object.radius <= d) break;
          var thc = Math.sqrt(object.radius * object.radius - d * d);
          var t0 = tca - thc;
          var newRayPosition = rayPosition.add(rayDirection.multiply(t0));

          var n = newRayPosition.subtract(object.center).normalized();
          var newRayDirection = rayDirection.subtract(n.multiply(2 * rayDirection.dotProduct(n))).normalized();

          var distance = rayPosition.distance(newRayPosition);
          
          if (closest == null || distance < closest.distance) {
            closest = {
              object: object,
              distance: distance,
              position: newRayPosition,
              reflectionDirection: newRayDirection,
              normalDirection: n
            };
          }

          break;

        case 'plane':
          var denom = -rayDirection.dotProduct(object.normal);
          if (denom <= 0) break;
          var t = -(object.point.subtract(rayPosition)).dotProduct(object.normal) / denom;
          if (t <= 0) break;
          var newRayPosition = rayPosition.add(rayDirection.multiply(t));
          var newRayDirection = rayDirection.subtract(object.normal.multiply(2 * rayDirection.dotProduct(object.normal))).normalized();

          var distance = rayPosition.distance(newRayPosition);
          
          if (closest == null || distance < closest.distance) {
            closest = {
              object: object,
              distance: distance,
              position: newRayPosition,
              reflectionDirection: newRayDirection,
              normalDirection: object.normal
            };
          }

          break;
      }
    });
  
    if (!closest) { 
      return null;
    }

    if (closest.object.type != 'light') {
      closest.diffusions = this.getDiffusions(closest.position, closest.normalDirection);

      closest.reflection = this.getPathTree(closest.position, closest.reflectionDirection, depth - 1);

      //closest.refraction = this.getPath(closest.position, closest.refractionDirection, depth - 1);
    }

    return closest;
  },

  getDiffusions: function(rayPosition, rayDirection) {
    var diffusions = [];

    this.state.scene.lights.forEach(function(object) {
      var l = object.center.subtract(rayPosition);
      var percent = rayDirection.dotProduct(l.normalized());
      if (percent <= 0) return;

      // TODO: make sure there's nothing in the path vector l (nothing in the path of the light)

      diffusions.push({
        object: object,
        distance: l.magnitude(),
        position: object.center,
        strength: percent
      });
    });

    return diffusions;
  },

  getInitialState: function() {
    return {
    };
  },

  render: function() {
    return (
      <canvas width={this.props.width} height={this.props.height} />
    );
    
  },

  componentDidMount: function() {
    this.renderCanvas();
  },

  componentDidUpdate: function() {
    this.renderCanvas();
  },

  renderCanvas: function() {
    var canvas = ReactDOM.findDOMNode(this);
    var context = canvas.getContext('2d');

    // make sure we're ready to draw the camera and the scene
    if (this.state.scene) {
      var image = this.createImage(context, this.state.scene);

      context.putImageData(image, 0, 0);
    }
  }
});

module.exports = Scene;
