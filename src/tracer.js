import Color from './color.js';
import Vector from './vector.js';

// Builds the scene (camera, lights and objects) from the parsed app.properties.
export function loadScene(properties) {
  return buildScene(readScene(properties));
}

// Reads app.properties into plain objects, so the scene can be sent to a web worker.
export function readScene(properties) {
  const get = (key) => properties.get('scene.' + key);
  const number = (key) => parseFloat(get(key));
  const point = (key) => ({ x: number(key + '.x'), y: number(key + '.y'), z: number(key + '.z') });
  const material = (prefix) => ({
    diffuse: number(prefix + 'diffuse'),
    reflect: number(prefix + 'reflect'),
    refract: number(prefix + 'refract'),
    color: get(prefix + 'color')
  });

  const spec = {
    depth: number('depth'),
    sky: { color: get('sky.color'), horizon: get('sky.horizon') },
    ambient: { color: get('ambient.color'), intensity: number('ambient.intensity') },
    camera: {
      position: point('camera.position'),
      direction: point('camera.direction'),
      field: number('camera.field')
    },
    objects: []
  };

  for (let i = 1; ; i++) {
    const prefix = 'object.' + i + '.';
    const type = get(prefix + 'type');
    if (!type) {
      break;
    }

    switch (type) {
      case 'light':
        spec.objects.push({
          type,
          color: get(prefix + 'color'),
          center: point(prefix + 'center'),
          radius: number(prefix + 'radius'),
          strength: number(prefix + 'strength')
        });
        break;
      case 'sphere':
        spec.objects.push({ type, ...material(prefix), center: point(prefix + 'center'), radius: number(prefix + 'radius') });
        break;
      case 'plane':
        spec.objects.push({ type, ...material(prefix), normal: point(prefix + 'normal'), point: point(prefix + 'point') });
        break;
      case 'quad':
        spec.objects.push({
          type,
          ...material(prefix),
          inverse: get(prefix + 'inverse'),
          points: [1, 2, 3, 4].map((n) => point(prefix + 'point.' + n))
        });
        break;
      default:
        throw new Error('Unsupported object type: ' + type);
    }
  }

  return spec;
}

// Turns the plain scene from readScene into vectors and colors the tracer can use.
export function buildScene(spec) {
  const vector = (p) => new Vector(p.x, p.y, p.z);

  const scene = {
    depth: spec.depth,
    sky: {
      color: Color.parse(spec.sky.color),
      horizon: spec.sky.horizon ? Color.parse(spec.sky.horizon) : null
    },
    ambient: {
      color: Color.parse(spec.ambient.color),
      intensity: spec.ambient.intensity
    },
    camera: {
      position: vector(spec.camera.position),
      direction: vector(spec.camera.direction).normalized(),
      field: (Math.PI / 180) * spec.camera.field
    },
    objects: [],
    lights: []
  };

  spec.objects.forEach((item, i) => {
    let object;
    switch (item.type) {
      case 'light':
        object = {
          color: Color.parse(item.color),
          center: vector(item.center),
          radius: item.radius,
          strength: item.strength
        };
        break;

      case 'sphere':
        object = {
          diffuse: item.diffuse,
          reflect: item.reflect,
          refract: item.refract,
          color: Color.parse(item.color),
          center: vector(item.center),
          radius: item.radius
        };
        break;

      case 'plane':
        object = {
          diffuse: item.diffuse,
          reflect: item.reflect,
          refract: item.refract,
          color: Color.parse(item.color),
          normal: vector(item.normal).normalized(),
          point: vector(item.point)
        };
        break;

      case 'quad':
        object = {
          diffuse: item.diffuse,
          reflect: item.reflect,
          refract: item.refract,
          color: Color.parse(item.color),
          inverse: item.inverse,
          points: item.points.map(vector)
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
        throw new Error('Unsupported object type: ' + item.type);
    }

    object.type = item.type;
    object.index = i + 1;
    if (object.type == 'light') {
      scene.lights.push(object);
    } else {
      scene.objects.push(object);
    }
  });

  return scene;
}

// The color of pixel (x, y) in a width x height picture of the scene.
export function getColor(scene, x, y, width, height) {
  const trueUp = new Vector(0, 0, 1);
  const camera = scene.camera;
  const h = (width / 2) / Math.tan(camera.field / 2);
  const xM = width / 2 - x;
  const yM = height / 2 - y;

  const right = trueUp.crossProduct(camera.direction).normalized();
  const down = camera.direction.crossProduct(right).normalized();

  // get the point that represents the location on the camera's image
  const rayPoint = camera.position
    .add(camera.direction.multiply(h))
    .add(right.multiply(xM))
    .add(down.multiply(yM));

  // get the direction to the point from the camera
  const rayDirection = rayPoint.subtract(camera.position).normalized();

  // we now have the ray start (camera position) and the ray direction
  // generate a path tree
  const pathTree = getPathTree(scene, camera.position, rayDirection, scene.depth);

  // determine the color of the path tree
  return getColorFromPathTree(scene, pathTree);
}

// The sky fades from the horizon color (if there is one) to the sky color straight up.
function getSkyColor(scene, direction) {
  const sky = scene.sky;
  if (!sky.horizon) return sky.color;
  const t = Math.sqrt(Math.max(0, direction.z));
  return sky.horizon.multiply(1 - t).add(sky.color.multiply(t));
}

function getColorIntensitiesFromPathTree(scene, pathTree, distance) {
  const colorIntensities = [];

  if (pathTree == null) {
    return colorIntensities;
  }

  if (pathTree.sky) {
    colorIntensities.push({color: getSkyColor(scene, pathTree.direction), intensity: 1});
    return colorIntensities;
  }

  const newDistance = distance + pathTree.distance;

  if (pathTree.reflection) {
    getColorIntensitiesFromPathTree(scene, pathTree.reflection, newDistance).forEach((colorIntensity) => {
      colorIntensities.push({
        color: colorIntensity.color.filterColor(pathTree.object.color),
        intensity: colorIntensity.intensity * pathTree.object.reflect
      });
    });
  }

  if (pathTree.diffusions) {
    pathTree.diffusions.forEach((diffusion) => {
      getColorIntensitiesFromPathTree(scene, diffusion, newDistance).forEach((colorIntensity) => {
        colorIntensities.push({
          color: colorIntensity.color.filterColor(pathTree.object.color),
          intensity: colorIntensity.intensity * pathTree.object.diffuse
        });
      });
    });
  }

  if (pathTree.object.type == 'light') {
    colorIntensities.push({
      color: pathTree.object.color,
      intensity: pathTree.strength / Math.pow(newDistance / pathTree.object.strength, 2)
    });
  }

  return colorIntensities;
}

function getColorFromPathTree(scene, pathTree) {
  const colorIntensities = getColorIntensitiesFromPathTree(scene, pathTree, 0);
  colorIntensities.push({color: Color.WHITE, intensity: 0.05});

  // combine the colors with the intensities
  const colors = colorIntensities.map((colorIntensity) => colorIntensity.color.multiply(colorIntensity.intensity));

  // add all the colors together (this is the inverse of the subtraction of the inverse colors)
  const finalColor = colors.reduce((result, color) => result.filterColor(color.invert()), Color.WHITE).invert();

  return finalColor.normalized();
}

function getLightIntersection(light, rayPosition, rayDirection) {
  const l = light.center.subtract(rayPosition);
  const lMag = l.magnitude();
  const tca = rayDirection.dotProduct(l);
  if (tca <= 0) return null;
  if (lMag < tca) return null;
  const d = Math.sqrt(lMag * lMag - tca * tca);
  if (light.radius <= d) return null;
  const thc = Math.sqrt(light.radius * light.radius - d * d);
  const t0 = tca - thc;
  const t1 = tca + thc;
  const newRayPosition = rayPosition.add(rayDirection.multiply(t0));
  const strength = (t1 - t0) / (2 * light.radius);

  const n = newRayPosition.subtract(light.center).normalized();
  const newRayDirection = rayDirection.subtract(n.multiply(2 * rayDirection.dotProduct(n))).normalized();

  const distance = rayPosition.distance(newRayPosition);

  return {
    object: light,
    distance: distance,
    position: newRayPosition,
    reflectionDirection: newRayDirection,
    normalDirection: n,
    strength: strength
  };
}

function getSphereIntersection(sphere, rayPosition, rayDirection) {
  const l = sphere.center.subtract(rayPosition);
  const lMag = l.magnitude();
  const tca = rayDirection.dotProduct(l);
  if (tca <= 0) return null;
  if (lMag <= tca) return null;
  const d = Math.sqrt(lMag * lMag - tca * tca);
  if (sphere.radius <= d) return null;
  const thc = Math.sqrt(sphere.radius * sphere.radius - d * d);
  const t0 = tca - thc;
  const newRayPosition = rayPosition.add(rayDirection.multiply(t0));

  const n = newRayPosition.subtract(sphere.center).normalized();
  const newRayDirection = rayDirection.subtract(n.multiply(2 * rayDirection.dotProduct(n))).normalized();

  const distance = rayPosition.distance(newRayPosition);

  return {
    object: sphere,
    distance: distance,
    position: newRayPosition,
    reflectionDirection: newRayDirection,
    normalDirection: n
  };
}

function getPlaneIntersection(plane, rayPosition, rayDirection) {
  const denom = rayDirection.dotProduct(plane.normal);
  if (denom >= 0) return null;
  const t = (plane.point.subtract(rayPosition)).dotProduct(plane.normal) / denom;
  if (t <= 0) return null;
  const newRayPosition = rayPosition.add(rayDirection.multiply(t));
  const newRayDirection = rayDirection.subtract(plane.normal.multiply(2 * rayDirection.dotProduct(plane.normal))).normalized();

  const distance = rayPosition.distance(newRayPosition);

  return {
    object: plane,
    distance: distance,
    position: newRayPosition,
    reflectionDirection: newRayDirection,
    normalDirection: plane.normal
  };
}

function getTriangleIntersectionPart(points, normal, inverse, rayPosition, rayDirection) {
  const plane = {normal: normal, point: points[0]};
  const intersection = getPlaneIntersection(plane, rayPosition, rayDirection);
  if (intersection == null) return null;

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const lastPoint = points[(i + points.length - 1) % points.length];
    const edge = point.subtract(lastPoint);
    const vector = intersection.position.subtract(lastPoint);
    const cross = edge.crossProduct(vector);
    const determinant = cross.dotProduct(normal);
    if (determinant >= 0) {
      return inverse ? intersection : null;
    }
  }

  return inverse ? null : intersection;
}

function getQuadIntersection(quad, rayPosition, rayDirection) {
  for (let i = 0; i < 2; i++) {
    const points = [];
    points.push(quad.points[(i * 2 + 0) % quad.points.length]); // 0 or 2
    points.push(quad.points[(i * 2 + 1) % quad.points.length]); // 1 or 3
    points.push(quad.points[(i * 2 + 2) % quad.points.length]); // 2 or 0

    const normal = quad.normals[i];
    const intersection = getTriangleIntersectionPart(points, normal, quad.inverse, rayPosition, rayDirection);
    if (intersection != null) {
      intersection.object = quad;
      return intersection;
    }
  }
  return null;
}

const intersectionFunctions = {
  sphere: getSphereIntersection,
  plane: getPlaneIntersection,
  quad: getQuadIntersection
};

function findClosestObject(scene, rayPosition, rayDirection) {
  let closest = null;

  scene.lights.forEach((object) => {
    const intersection = getLightIntersection(object, rayPosition, rayDirection);
    if (intersection != null && (closest == null || intersection.distance < closest.distance)) {
      closest = intersection;
    }
  });

  scene.objects.forEach((object) => {
    const intersection = intersectionFunctions[object.type](object, rayPosition, rayDirection);
    if (intersection != null && (closest == null || intersection.distance < closest.distance)) {
      closest = intersection;
    }
  });

  return closest;
}

function getPathTree(scene, rayPosition, rayDirection, depth) {
  if (depth <= 0) return null;

  const closest = findClosestObject(scene, rayPosition, rayDirection);

  if (!closest) {
    return {sky: true, direction: rayDirection};
  }

  if (closest.object.type != 'light') {
    closest.diffusions = getDiffusions(scene, closest.position, closest.normalDirection);

    closest.reflection = getPathTree(scene, closest.position, closest.reflectionDirection, depth - 1);
  }

  return closest;
}

function getDiffusions(scene, rayPosition, rayDirection) {
  const diffusions = [];

  scene.lights.forEach((object) => {
    const l = object.center.subtract(rayPosition);
    const lNorm = l.normalized();

    const percent = rayDirection.dotProduct(lNorm);
    if (percent <= 0) return;

    // skip this light if something else is in the way
    const closest = findClosestObject(scene, rayPosition, lNorm);
    if (closest == null || closest.object.index != object.index) {
      return;
    }

    diffusions.push({
      object: object,
      distance: l.magnitude(),
      position: object.center,
      strength: percent
    });
  });

  return diffusions;
}
