/**
 * Checks if the dimension passed as argument is a time-type dimension.
 * @param {Dimension} dimension A mondrian-rest-client dimension object
 * @returns {boolean}
 */
export function isTimeDimension(dimension) {
  return (
    dimension.dimensionType === 1 ||
    dimension.name === "Date" ||
    dimension.name === "Year"
  );
}

/**
 * Checks if an object can be used as a filter.
 * This means it should have a measure, a valid operator, and a numeric value.
 * @param {object} filter An object to check
 */
export function isValidFilter(filter) {
  return filter && filter.measure && filter.operator > 0 && filter.hasValue;
}

/**
 * Checks if an object can be used as a grouping.
 * This means it should have a valid level.
 * @param {object} filter An object to check
 */
export function isValidGrouping(grouping) {
  return grouping && grouping.level;
}

/**
 * Checks if a Grouping object can be used as a cut.
 * This means it should have at least 1 member.
 * @param {object} grouping An object to check
 */
export function isValidCut(grouping) {
  return isValidGrouping(grouping) && grouping.hasMembers;
}

/**
 *
 * @param {PermalinkKeywordMap} keywords A map with the parameter keys to parse from the location search
 * @param {object} query1 A parsed query object from current's `location.search` parameters
 * @param {object} query2 A parsed query object from current's `location.search` parameters
 */
export function isSamePermalinkQuery(keywords, query1, query2) {
  return (
    query1[keywords.measure] === query2[keywords.measure] &&
    query1[keywords.dimension] === query2[keywords.dimension] &&
    query1[keywords.level] === query2[keywords.level] &&
    query1[keywords.enlarged] === query2[keywords.enlarged] &&
    isSameArrayShallow(
      [].concat(query1[keywords.filters] || []),
      [].concat(query2[keywords.filters] || [])
    )
  );
}

/**
 * Compares two Vizbuilder's query state object to check if it contains the same parameters.
 * @param {object} query1 A query object from Vizbuilder's state
 * @param {object} query2 A query object from Vizbuilder's state
 */
export function isSameQuery(query1, query2) {
  return (
    query1.measure === query2.measure &&
    query1.dimension === query2.dimension &&
    query1.drilldown === query2.drilldown &&
    isSameCondition(query1.conditions, query2.conditions)
  );
}

/**
 * Compares two condition arrays and checks if all its elements are equivalent.
 * @param {Condition[]} conditions1 A condition to compare
 * @param {Condition[]} conditions2 An array of conditions to compare
 */
export function isSameCondition(conditions1, conditions2) {
  let n = conditions1.length;

  if (n !== conditions2.length) {
    return false;
  }

  while (n--) {
    const cond1 = conditions1[n];
    const cond2 = conditions2[n];
    if (
      cond1.type !== cond2.type &&
      cond1.property !== cond2.property &&
      cond1.operator !== cond2.operator &&
      !isSameArrayShallow(cond1.values, cond2.values)
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Makes a shallow comparison between two arrays.
 * Returns false if they aren't the same length, or if at certain index both
 * elements arent equal. Otherwise returns true.
 * @param {any[]} array1 An array to compare
 * @param {any[]} array2 An array to compare
 */
export function isSameArrayShallow(array1, array2) {
  let n = array1.length;

  if (n !== array2.length) {
    return false;
  }

  while (n--) {
    if (array1[n] !== array2[n]) {
      return false;
    }
  }

  return true;
}
