const yn = require("yn");

/** */
function findName(d) {
  return d.name || d.dimension;
}

module.exports = function(dimensions) {

  const dims = dimensions.filter(d =>
    findName(d).includes("Year") ||
    d.type === "time" ||
    d.dimensionType === 1 ||
    d.annotations && d.annotations.dim_type === "TIME"
  );

  if (!dims.length) return false;

  let dim;
  if (dims.length === 1) dim = dims[0];
  else if (dims.find(d => yn(d.annotations.default_year))) dim = dims.find(d => yn(d.annotations.default_year));
  else if (dims.find(d => findName(d) === "Year")) dim = dims.find(d => findName(d) === "Year");
  else if (dims.find(d => findName(d).includes("End"))) dim = dims.find(d => findName(d).includes("End"));
  else if (dims.find(d => findName(d).includes("Year"))) dim = dims.find(d => findName(d).includes("Year"));
  else dim = dims[0];

  return {
    dimensions: dims,
    preferred: dim
  };

};
