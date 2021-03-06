import {deviation, mean} from "d3-array";

/**
 * Calculate the Relative Standard Deviation
 * This means it should have a numeric value, and a valid operator.
 * @param {Array} data An array to check
 * @param {String} measureName Name of the measure
 */
export function relativeStdDev(data, measureName) {
  const dataPoints = data.map(d => d[measureName]);
  return deviation(dataPoints) / mean(dataPoints);
}
