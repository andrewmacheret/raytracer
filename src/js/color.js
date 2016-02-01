var Color = function(a, r, g, b) {
  this.a = a;
  this.r = r;
  this.g = g;
  this.b = b;
};

Color.BLACK = new Color(0xff, 0x00, 0x00, 0x00);
Color.WHITE = new Color(0xff, 0xff, 0xff, 0xff);

Color.parse = function(str) {
  str = str.replace('#', '');
  if (str.length == 3) {
    str = str[0] + str[0] + str[1] + str[1] + str[2] + str[2];
  }
  if (str.length == 6) {
    str = 'ff' + str;
  }
  var argb = parseInt(str, 16);
  return new Color(
    ((argb & 0xff000000) >>> 24),
    ((argb & 0xff0000) >>> 16),
    ((argb & 0xff00) >>> 8),
    (argb & 0xff)
  );
};

Color.prototype.multiply = function(scalar) {
  return new Color(
    this.a * scalar,
    this.r * scalar,
    this.g * scalar,
    this.b * scalar
  );
};

Color.prototype.divide = function(scalar) {
  return new Color(
    this.a / scalar,
    this.r / scalar,
    this.g / scalar,
    this.b / scalar
  );
};

Color.prototype.invert = function() {
  return new Color(
    0xff - this.a,
    0xff - this.r,
    0xff - this.g,
    0xff - this.b
  );
};

Color.prototype.filterColor = function(color) {
  return new Color(
    ((this.a / 0xff) * (color.a / 0xff)) * 0xff,
    ((this.r / 0xff) * (color.r / 0xff)) * 0xff,
    ((this.g / 0xff) * (color.g / 0xff)) * 0xff,
    ((this.b / 0xff) * (color.b / 0xff)) * 0xff
  );
};

Color.prototype.normalized = function() {
  return new Color(
    Math.min(Math.max(this.a, 0), 0xff),
    Math.min(Math.max(this.r, 0), 0xff),
    Math.min(Math.max(this.g, 0), 0xff),
    Math.min(Math.max(this.b, 0), 0xff)
  );
};

module.exports = Color;
