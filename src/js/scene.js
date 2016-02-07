var React = require('react');
var ReactDOM = require('react-dom');

var $ = require('jquery');
var reader = require('properties-reader');

var ProgressBar = require('./progress-bar.js');

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
      sky: {
        color: Color.parse(properties.get('scene.sky.color'))
      },
      ambient: {
        color: Color.parse(properties.get('scene.ambient.color')),
        intensity: parseFloat(properties.get('scene.ambient.intensity'))
      },

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
            refract: parseFloat(properties.get(prefix + 'refract')),
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
            refract: parseFloat(properties.get(prefix + 'refract')),
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

        case 'quad':
          object = {
            diffuse: parseFloat(properties.get(prefix + 'diffuse')),
            reflect: parseFloat(properties.get(prefix + 'reflect')),
            refract: parseFloat(properties.get(prefix + 'refract')),
            color: Color.parse(properties.get(prefix + 'color')),
            inverse: properties.get(prefix + 'inverse'),
            points: [
              new Vector(
                parseFloat(properties.get(prefix + 'point.1.x')),
                parseFloat(properties.get(prefix + 'point.1.y')),
                parseFloat(properties.get(prefix + 'point.1.z'))
              ),
              new Vector(
                parseFloat(properties.get(prefix + 'point.2.x')),
                parseFloat(properties.get(prefix + 'point.2.y')),
                parseFloat(properties.get(prefix + 'point.2.z'))
              ),
              new Vector(
                parseFloat(properties.get(prefix + 'point.3.x')),
                parseFloat(properties.get(prefix + 'point.3.y')),
                parseFloat(properties.get(prefix + 'point.3.z'))
              ),
              new Vector(
                parseFloat(properties.get(prefix + 'point.4.x')),
                parseFloat(properties.get(prefix + 'point.4.y')),
                parseFloat(properties.get(prefix + 'point.4.z'))
              )
            ]
          };

          object.rays = [
            object.points[0].subtract(object.points[1]).normalized(), // forward
            object.points[2].subtract(object.points[1]).normalized(), // backward
            object.points[2].subtract(object.points[3]).normalized(), // forward
            object.points[0].subtract(object.points[3]).normalized()  // backward
          ];
          object.normals = [
            object.rays[0].crossProduct(object.rays[1]).normalized(), // forward x backward
            object.rays[2].crossProduct(object.rays[3]).normalized()  // forward x backward
          ];

          break;

        default:
          throw 'Unsupported object type: ' + objectType;
      }

      object.type = objectType;
      object.index = i;
      if (object.type == 'light') {
        scene.lights.push(object);
      } else {
        scene.objects.push(object);
      }
    }

    this.setState({
      scene: scene
    });
  },

  updateProgress: function(progress) {
    this.refs.progressBar.updateProgress(progress);
  },

  finishProgress: function() {
    this.refs.progressBar.hide();
  },

  createImage: function(context, scene, imageCallback) {
    var width = this.props.width * 2;
    var height = this.props.height * 2;
    var image = context.createImageData(width, height);

    var loop = function(yBase, step) {
      for (var y = yBase; y < yBase + step; y++) {
        if (y >= height) {
          imageCallback(image);

          this.finishProgress();

          return;
        }

        for (var x = 0; x < width; x++) {
          var index = (y * width + x) * 4;
          var color = this.getColor(x, y, width, height);
          image.data[index + 0] = color.r;
          image.data[index + 1] = color.g;
          image.data[index + 2] = color.b;
          image.data[index + 3] = color.a;
        }
      }

      //console.log(new Date(), x, yBase);
      this.updateProgress(index / image.data.length);

      var nextIteration = function() { loop(yBase + step, step); };
      window.setTimeout(nextIteration, 0);
    }.bind(this);

    loop(0, 5);
  },

  getColor: function(x, y, width, height) {
    var trueUp = new Vector(0, 0, 1);
    var camera = this.state.scene.camera;
    var h = (width / 2) / Math.tan(camera.field / 2);
    var xM = width / 2 - x;
    var yM = height / 2 - y;

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
      colorIntensities.push({color: this.state.scene.sky.color, intensity: 1});
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
    colorIntensities.push({color: Color.WHITE, intensity: 0.05});

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

  getLightIntersection: function(light, rayPosition, rayDirection) {
    var l = light.center.subtract(rayPosition);
    var lMag = l.magnitude();
    var tca = rayDirection.dotProduct(l);
    if (tca <= 0) return null;
    if (lMag < tca) return null;
    var d = Math.sqrt(lMag * lMag - tca * tca);
    if (light.radius <= d) return null;
    var thc = Math.sqrt(light.radius * light.radius - d * d);
    var t0 = tca - thc;
    var t1 = tca + thc;
    var newRayPosition = rayPosition.add(rayDirection.multiply(t0));
    var strength = (t1 - t0) / (2 * light.radius);

    var n = newRayPosition.subtract(light.center).normalized();
    var newRayDirection = rayDirection.subtract(n.multiply(2 * rayDirection.dotProduct(n))).normalized();

    var distance = rayPosition.distance(newRayPosition);
    
    return {
      object: light,
      distance: distance,
      position: newRayPosition,
      reflectionDirection: newRayDirection,
      normalDirection: n,
      strength: strength
    };
  },

  getSphereIntersection: function(sphere, rayPosition, rayDirection) {
    var l = sphere.center.subtract(rayPosition);
    var lMag = l.magnitude();
    var tca = rayDirection.dotProduct(l);
    if (tca <= 0) return null;
    if (lMag <= tca) return null;
    var d = Math.sqrt(lMag * lMag - tca * tca);
    if (sphere.radius <= d) return null;
    var thc = Math.sqrt(sphere.radius * sphere.radius - d * d);
    var t0 = tca - thc;
    var newRayPosition = rayPosition.add(rayDirection.multiply(t0));

    var n = newRayPosition.subtract(sphere.center).normalized();
    var newRayDirection = rayDirection.subtract(n.multiply(2 * rayDirection.dotProduct(n))).normalized();

    var distance = rayPosition.distance(newRayPosition);
    
    return {
      object: sphere,
      distance: distance,
      position: newRayPosition,
      reflectionDirection: newRayDirection,
      normalDirection: n
    };
  },

  getPlaneIntersection: function(plane, rayPosition, rayDirection) {
    var denom = rayDirection.dotProduct(plane.normal);
    if (denom >= 0) return null;
    var t = (plane.point.subtract(rayPosition)).dotProduct(plane.normal) / denom;
    if (t <= 0) return null;
    var newRayPosition = rayPosition.add(rayDirection.multiply(t));
    var newRayDirection = rayDirection.subtract(plane.normal.multiply(2 * rayDirection.dotProduct(plane.normal))).normalized();

    var distance = rayPosition.distance(newRayPosition);
    
    return {
      object: plane,
      distance: distance,
      position: newRayPosition,
      reflectionDirection: newRayDirection,
      normalDirection: plane.normal
    };
  },

  getTriangleIntersectionPart: function(points, normal, inverse, rayPosition, rayDirection) {
    var plane = {normal: normal, point: points[0]};
    var intersection = this.getPlaneIntersection(plane, rayPosition, rayDirection);
    if (intersection == null) return null;

    for (var i=0; i<points.length; i++) {
      var point = points[i];
      var lastPoint = points[(i + points.length - 1) % points.length];
      var edge = point.subtract(lastPoint);
      var vector = intersection.position.subtract(lastPoint);
      var cross = edge.crossProduct(vector);
      var determinant = cross.dotProduct(normal);
      if (determinant >= 0) {
        return inverse ? intersection : null;
      }
    }

    return inverse ? null : intersection;
  },

  getQuadIntersection: function(quad, rayPosition, rayDirection) {
    for (var i = 0; i < 2; i++) {
      var points = [];
      points.push(quad.points[(i * 2 + 0) % quad.points.length]); // 0 or 2
      points.push(quad.points[(i * 2 + 1) % quad.points.length]); // 1 or 3
      points.push(quad.points[(i * 2 + 2) % quad.points.length]); // 2 or 0

      var normal = quad.normals[i];
      var intersection = this.getTriangleIntersectionPart(points, normal, quad.inverse, rayPosition, rayDirection);
      if (intersection != null) {
        intersection.object = quad;
        return intersection;
      }
    }
    return null;
  },

  findClosestObject: function(rayPosition, rayDirection) {
    var closest = null;

    this.state.scene.lights.forEach(function(object) {
      var intersection = this.getLightIntersection(object, rayPosition, rayDirection);
      
      if (intersection != null && (closest == null || intersection.distance < closest.distance)) {
        closest = intersection;
      }
    }.bind(this));

    var fnMapping = {
      sphere: 'getSphereIntersection',
      plane: 'getPlaneIntersection',
      quad: 'getQuadIntersection'
    };
    this.state.scene.objects.forEach(function(object) {
      var fn = this[fnMapping[object.type]];
      var intersection = fn(object, rayPosition, rayDirection);
      
      if (intersection != null && (closest == null || intersection.distance < closest.distance)) {
        closest = intersection;
      }
    }.bind(this));

    return closest;
  },

  getPathTree: function(rayPosition, rayDirection, depth) {
    if (depth <= 0) return null;

    var closest = this.findClosestObject(rayPosition, rayDirection);
  
    if (!closest) { 
      return null;
    }

    if (closest.object.type != 'light') {
      closest.diffusions = this.getDiffusions(closest.position, closest.normalDirection);

      closest.reflection = this.getPathTree(closest.position, closest.reflectionDirection, depth - 1);

      //closest.refraction = this.getPathTree(closest.position, closest.refractionDirection, depth - 1);
    }

    return closest;
  },

  getDiffusions: function(rayPosition, rayDirection) {
    var diffusions = [];

    this.state.scene.lights.forEach(function(object) {
      var l = object.center.subtract(rayPosition);
      //var lMag = l.magnitude(); // TODO: did i need this???
      var lNorm = l.normalized();

      var percent = rayDirection.dotProduct(lNorm);
      if (percent <= 0) return;

      var closest = this.findClosestObject(rayPosition, lNorm);
      if (closest == null || closest.object.index != object.index) {
        return;
      }

      // TODO: make sure there's nothing in the path vector l (nothing in the path of the light)

      diffusions.push({
        object: object,
        distance: l.magnitude(),
        position: object.center,
        strength: percent
      });
    }.bind(this));

    return diffusions;
  },

  getInitialState: function() {
    return {
    };
  },

  render: function() {
    return (
      <div className="scene">
        <ProgressBar ref="progressBar" start={0} end={1} text="Loading..." />
        <canvas width={this.props.width} height={this.props.height} />
        <img style={{display: 'hidden'}} />
      </div>
    );
    
  },

  componentDidMount: function() {
    this.renderCanvas();
  },

  componentDidUpdate: function() {
    this.renderCanvas();
  },

  renderCanvas: function() {
    var canvas = ReactDOM.findDOMNode(this).getElementsByTagName('canvas')[0];
    var context = canvas.getContext('2d');

    var canvasCopy = document.createElement('canvas');
    var contextCopy = canvasCopy.getContext('2d');
    canvasCopy.width = canvas.width * 2;
    canvasCopy.height = canvas.height * 2;

    // make sure we're ready to draw the camera and the scene
    if (this.state.scene) {
      this.createImage(context, this.state.scene, function(image) {
        contextCopy.putImageData(image, 0, 0);

        if (image.width != canvas.width || image.height != canvas.height) {
          context.drawImage(canvasCopy, 0, 0, canvasCopy.width, canvasCopy.height, 0, 0, canvas.width, canvas.height);
        }

        if (this.props.antiAliasing > 0) {
          canvasCopy.width = canvas.width * 2;
          canvasCopy.height = canvas.height * 2;

          // stupid basic antialiasing
          for (var i = 0; i < this.props.antiAliasing; i++) {
            contextCopy.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, canvasCopy.width, canvasCopy.height);
            context.drawImage(canvasCopy, 0, 0, canvasCopy.width, canvasCopy.height, 0, 0, canvas.width, canvas.height);
          }
        }

        // debug:
        /*
        canvas.addEventListener('mousemove', function(e) {
          console.log(e.offsetX, e.offsetY);
        });
        */
      }.bind(this));
    }
  }
});

module.exports = Scene;
