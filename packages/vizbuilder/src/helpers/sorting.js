import sort from "fast-sort";
import groupBy from "lodash/groupBy";
import union from "lodash/union";
import yn from "yn";

import Grouping from "../components/Sidebar/GroupingManager/Grouping";
import {findFirstNumber} from "./formatting";
import {
  areKindaNumeric,
  isGeoDimension,
  isNumeric,
  isTimeDimension,
  isValidDimension,
  isValidMeasure
} from "./validation";

/**
 * If `needle` is a valid value, returns the first element in the `haystack`
 * that matches the annotation._key property.
 * If there's no matches and `elseFirst` is true, returns the first element
 * in the `haystack`.
 * @param {string} needle The key to match
 * @param {any[]} haystack The array where to search for the object.
 * @param {boolean?} elseFirst A flag to return the first element in case of no matching result.
 */
export function findByKey(needle, haystack, elseFirst = false) {
  const findResult = needle
    ? haystack.find(item => item.annotations._key === needle)
    : undefined;
  return elseFirst ? findResult || haystack[0] : findResult;
}

/**
 * If `needle` is a valid value, returns the first element in the `haystack`
 * that matches the name property.
 * If there's no matches and `elseFirst` is true, returns the first element
 * in the `haystack`.
 * @param {string} needle The key to match
 * @param {any[]} haystack The array where to search for the object.
 * @param {boolean?} elseFirst A flag to return the first element in case of no matching result.
 */
export function findByName(needle, haystack, elseFirst = false) {
  const findResult = needle
    ? haystack.find(item => item.name === needle)
    : undefined;
  return elseFirst ? findResult || haystack[0] : findResult;
}

/**
 * If `needle` is a valid value, returns the first element in the `haystack`
 * that matches the fullName property.
 * If there's no matches and `elseFirst` is true, returns the first element
 * in the `haystack`.
 * @param {string} needle The key to match
 * @param {any[]} haystack The array where to search for the object.
 * @param {boolean?} elseFirst A flag to return the first element in case of no matching result.
 */
export function findByFullName(needle, haystack, elseFirst = false) {
  const findResult = haystack.find(item => item.fullName.indexOf(needle) > -1);
  return elseFirst ? findResult || haystack[0] : findResult;
}

/**
 * Looks for an element of `needles` in `haystack`, using the `matchingFunction`.
 * If `elseFirst` is true and there's no match, returns the first element in `haystack`.
 * @param {(needle, haystack) => any} matchingFunction The function to use to find the elements
 * @param {any[]} haystack The array where to search for the object
 * @param {string[]} needles The array of default names to search for
 * @param {boolean?} elseFirst A flag to return the first element in case of no matching result
 */
export function multiFinder(matchingFunction, needles, haystack, elseFirst) {
  needles = needles.slice().reverse();
  let matchResult;
  let n = needles.length;
  while (n--) {
    matchResult = matchingFunction(needles[n], haystack);
    if (matchResult) {
      break;
    }
  }
  return elseFirst ? matchResult || haystack[0] : matchResult;
}

/**
 * Reduces a list of cubes to the measures that will be used in the vizbuilder.
 * @param {Cube[]} cubes An array of the cubes to be reduced.
 */
export function classifyMeasures(cubes, mapMode) {
  const measures = [];
  const otherMeasures = []; // measures without `annotations.topic`
  const multiMeasures = {};

  let nCbs = cubes.length;
  while (nCbs--) {
    const cube = cubes[nCbs];
    const cbHasTopic = cube.annotations.topic && cube.annotations.topic !== "Other";
    const cbTableId = cube.annotations.table_id;

    let nMsr = cube.measures.length;
    while (nMsr--) {
      const measure = cube.measures[nMsr];
      const hideInMap = mapMode && yn(measure.annotations.hide_in_map);
      if (isValidMeasure(measure) && !hideInMap) {
        (cbHasTopic ? measures : otherMeasures).push(measure);
        if (cbTableId) {
          const key = `${cbTableId}.${measure.name}`;
          multiMeasures[key] = multiMeasures[key] || [];
          multiMeasures[key].push(measure);
        }
      }
    }
  }

  const sortingFunction = a => a.annotations._sortKey;
  const sortedMeasures = sort(measures).asc(sortingFunction);
  const sortedOther = sort(otherMeasures).asc(sortingFunction);

  return {
    measures: sortedMeasures.concat(sortedOther),
    measureMap: multiMeasures
  };
}

/**
 *
 * @param {Measure} measure The initial measure to make the selection
 * @param {Object<string, Measure[]>} measureMap The general tableId map
 * @param {Cube[]} cubes The general cube list
 * @param {(cube: Cube) => Cube} userTableIdFunc The cube selector function
 */
export function userTableIdMeasure(measure, measureMap, cubes, userTableIdFunc) {
  const measureTableKey = `${measure.annotations._cb_table_id}.${measure.name}`;
  const measureArray = measureMap[measureTableKey] || [];
  const cubeArray = measureArray.map(msr =>
    cubes.find(cube => cube.name === msr.annotations._cb_name)
  );

  const pickedCube = userTableIdFunc(cubeArray);

  const pickedCubeIndex = cubeArray.indexOf(pickedCube);
  return pickedCubeIndex > -1 ? measureArray[pickedCubeIndex] : measure;
}

/**
 * Finds a valid Level using a user defined parameter list.
 * @param {object[]} defaultGroup Array of user-defined default levels
 * @param {Level[]} levels An array with all the available valid levels
 */
export function getDefaultGroup(defaultGroup, levels, priorityLevel) {
  const level = priorityLevel
    ? findByName(priorityLevel, levels, true)
    : multiFinder(findByFullName, defaultGroup, levels, true);
  return [new Grouping(level)];
}

/**
 * Returns the MOE measure for a certain measure, in the full measure list
 * from the cube. If there's no MOE for the measure, returns undefined.
 * @param {Cube} cube The measure's parent cube
 * @param {*} measure The measure
 * @returns {Object<string,Measure|undefined>}
 */
export function getMeasureMeta(cube, measure) {
  let collection, lci, moe, source, uci;
  const measureName = RegExp(measure.name, "i");

  if (cube.measures.indexOf(measure) > -1) {
    let nMsr = cube.measures.length;
    while (nMsr--) {
      const currentMeasure = cube.measures[nMsr];
      const measureAnnotations = currentMeasure.annotations;

      const keyMoe = measureAnnotations.error_for_measure;
      const keyCollection = measureAnnotations.collection_for_measure;
      const keySource = measureAnnotations.source_for_measure;

      if (keyMoe && measureName.test(keyMoe)) {
        const errorType = measureAnnotations.error_type;

        if (errorType === "LCI") {
          lci = currentMeasure;
        }
        else if (errorType === "UCI") {
          uci = currentMeasure;
        }
        else {
          moe = currentMeasure;
        }
      }

      if (!source && keySource && measureName.test(keySource)) {
        source = currentMeasure;
      }

      if (!collection && keyCollection && measureName.test(keyCollection)) {
        collection = currentMeasure;
      }

      if (collection && ((lci && uci) || moe) && source) {
        break;
      }
    }
  }

  return {collection, lci, moe, source, uci};
}

/**
 * Extracts a time-type Dimension from a Cube object. If not found,
 * returns undefined.
 * @param {Cube} cube The Cube object to extract the time Dimension from
 * @returns {Dimension|undefined}
 */
export function getTimeLevel(cube) {
  const timeDim =
    cube.dimensions.find(dim => yn(dim.annotations.default_year)) ||
    cube.timeDimension ||
    cube.dimensionsByName.Date ||
    cube.dimensionsByName.Year;
  if (timeDim) {
    const timeHie = timeDim.hierarchies.slice(-1).pop();
    if (timeHie) {
      return timeHie.levels.slice(1, 2).pop();
    }
  }
  return undefined;
}

export function getGeoLevel(query) {
  const geoGroup = query.groups.find(
    grp => grp.level && isGeoDimension(grp.level.hierarchy.dimension)
  );
  return geoGroup && geoGroup.level;
}

/**
 * Returns an array with non-time dimensions from a cube.
 * @param {Cube} cube The cube where the dimensions will be reduced from
 * @returns {Dimension[]}
 */
export function getValidDimensions(cube) {
  return cube.dimensions.filter(isValidDimension);
}

/**
 * Extracts the levels from non-time dimensions in a cube.
 * @param {Cube} cube The cube where to extract levels from.
 * @returns {Level[]}
 */
export function getValidLevels(cube) {
  const dimensions = getValidDimensions(cube);
  return dimensions
    .reduce(reduceLevelsFromDimension, [])
    .filter(lvl => !yn(lvl.annotations.hide_in_ui));
}

/**
 * Modifies the `array`, removing the Level elements that would cause an
 * incompatibility problem in a cut if queried with the `interestLevel` as
 * a drilldown.
 * @param {Level[]} array An array of mondrian-rest-client Levels
 * @param {Level} interestLevel The Level to test by hierarchy incompatibility
 */
export function preventHierarchyIncompatibility(array, interestLevel) {
  const interestHierarchy = interestLevel.hierarchy;
  const interestDimension = interestHierarchy.dimension;

  let n = array.length;
  while (n--) {
    const level = array[n];
    const hierarchy = level.hierarchy;
    if (
      hierarchy.dimension === interestDimension &&
      (hierarchy !== interestHierarchy || level.depth > interestLevel.depth)
    ) {
      array.splice(n, 1);
    }
  }
}

/**
 * A function to be reused in the `Array.prototype.reduce` method, to obtain
 * the valid Level elements from an array of Dimension elements.
 * @param {Dimension[]} container The target array to save the reduced elements
 * @param {Dimension} dimension The current Dimension in the iteration
 * @returns {Dimension[]}
 */
export function reduceLevelsFromDimension(container, dimension) {
  return isTimeDimension(dimension) || yn(dimension.annotations.hide_in_ui)
    ? container
    : dimension.hierarchies.reduce(
        (container, hierarchy) => container.concat(hierarchy.levels.slice(1)),
        container
      );
}

/**
 * Adds a Level object to a list of Level objects, and removes duplicate elements.
 * @param {Level[]} array Target Level array
 * @param {Level} drilldown Level object to add
 */
export function joinDrilldownList(array, drilldown) {
  array = array.filter(dd => dd.hierarchy !== drilldown.hierarchy);
  drilldown = [].concat(drilldown || []);
  drilldown = union(array, drilldown);
  return sort(drilldown).asc(a => a.hierarchy.dimension.dimensionType);
}

/**
 * Checks for duplicate levels, based on their names.
 * If a duplicate is found, the level whose hierarchy name
 * is different to their own name is removed.
 * @see Issue#136 on {@link https://github.com/Datawheel/canon/issues/136 | GitHub}
 * @param {Level[]} array The level array to filter
 */
export function removeDuplicateLevels(array) {
  const nameList = array.map(lvl => lvl.name);
  let n = array.length;
  while (n--) {
    const currName = nameList[n];
    if (
      // the current element's name is more than once on the list
      nameList.indexOf(currName) !== nameList.lastIndexOf(currName) &&
      // and its hierarchy's name is different to its own name
      array[n].hierarchy.name !== currName
    ) {
      nameList.splice(n, 1);
      array.splice(n, 1);
    }
  }
}

/**
 * Returns an object where the keys are the current query's drilldowns
 * and its values are arrays with the values available in the current dataset.
 * @param {Query} query A mondrian-rest-client Query object
 * @param {Array<any>} dataset The result dataset for the query object passed along.
 */
export function getIncludedMembers(query, dataset) {
  return [].concat(query.levels, query.timeLevel).reduce((members, dd) => {
    if (dd) {
      const key = dd.name;
      const set = {};

      let n = dataset.length;
      while (n--) {
        const value = dataset[n][key];
        set[value] = 0;
      }

      const memberList = Object.keys(set);
      if (memberList.every(isNumeric)) {
        members[key] = memberList.map(n => n * 1).sort((a, b) => a - b);
      }
      else {
        members[key] = memberList.sort();
      }
    }

    return members;
  }, {});
}

/**
 * Returns the value of the highest timeLevel value in the dataset, but lower or equal than the current time.
 * @param {number[]} timelist An array with time-related members
 */
export function higherTimeLessThanNow(timelist) {
  timelist = timelist || [];
  // TODO: prepare it to handle months, days, etc
  const now = new Date();
  const currentTime = now.getFullYear();
  return timelist.filter(time => time <= currentTime).pop();
}

export function getTopTenByYear(datagroup) {
  const {timeLevelName, levelNames} = datagroup.names;
  const firstLevelName = levelNames[0];
  const groups = groupBy(datagroup.dataset, timeLevelName);

  let newDataset;
  const topElements = Object.keys(groups).reduce((all, time) => {
    const top = groups[time].slice(0, 10);
    all.push(...top);
    return all;
  }, []);

  const topElementsDatasets = groupBy(topElements, firstLevelName);
  if (Object.keys(topElementsDatasets).length > 12) {
    const time = Object.keys(groups).sort().pop();
    const timeElements = groupBy(groups[time].slice(0, 10), firstLevelName);
    newDataset = datagroup.dataset.filter(item => item[firstLevelName] in timeElements);
  }
  else {
    newDataset = topElements;
  }

  const newMembers = getIncludedMembers(datagroup.query, newDataset);
  return {newDataset, newMembers};
}

/**
 * Generates a sorting function to be used in `Array.prototype.sort`,
 * based on a certain key.
 * @param {string} key The key to the property to be used as comparison string
 */
export function sortByCustomKey(key, members) {
  if (areKindaNumeric(members)) {
    return (a, b) => findFirstNumber(a) - findFirstNumber(b);
  }

  return (a, b) => `${a[key]}`.localeCompare(`${b[key]}`);
}

/**
 * Generates a 2-object combination from a list of objects.
 * @param {any[]} set An array of objects to get the combo.
 */
export function* getCombinationsChoose2(set) {
  const n = set.length;
  if (n > 0) {
    const first = set[0];
    for (let i = 1; i < n; i++) {
      yield [first, set[i]];
    }
    yield* getCombinationsChoose2(set.slice(1));
  }
}

export function getPermutations(set) {
  let result = [];

  const permute = (arr, m = []) => {
    if (arr.length === 0) {
      result.push(m);
    }
    else {
      for (let i = 0; i < arr.length; i++) {
        let curr = arr.slice();
        let next = curr.splice(i, 1);
        permute(curr.slice(), m.concat(next));
      }
    }
  };

  permute(set);

  return result;
}
