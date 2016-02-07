// Vector math!

var Vector = function(x, y, z) {
  this.x = x;
  this.y = y;
  this.z = z;
};

Vector.prototype.multiply = function(scalar) {
  return new Vector(this.x * scalar, this.y * scalar, this.z * scalar);
};

Vector.prototype.divide = function(scalar) {
  return new Vector(this.x / scalar, this.y / scalar, this.z / scalar);
};

Vector.prototype.magnitude = function() {
  if ('magnitudeCached' in this) {
    return this.magnitudeCached;
  }
  return this.magnitudeCached = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
};

Vector.prototype.normalized = function() {
  return this.divide(this.magnitude());
};

Vector.prototype.add = function(vector) {
  return new Vector(
    this.x + vector.x,
    this.y + vector.y,
    this.z + vector.z
  );
};

Vector.prototype.subtract = function(vector) {
  return new Vector(
    this.x - vector.x,
    this.y - vector.y,
    this.z - vector.z
  );
};

Vector.prototype.dotProduct = function(vector) {
  return this.x * vector.x + this.y * vector.y + this.z * vector.z;
};

Vector.prototype.crossProduct = function(vector) {
  return new Vector(
    this.y * vector.z - this.z * vector.y,
    this.z * vector.x - this.x * vector.z,
    this.x * vector.y - this.y * vector.x
  );
};

Vector.prototype.distance = function(vector) {
  var x = this.x - vector.x;
  var y = this.y - vector.y;
  var z = this.z - vector.z;
  return Math.sqrt(x*x + y*y + z*z);
};

module.exports = Vector;
