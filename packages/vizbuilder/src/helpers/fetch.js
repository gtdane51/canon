import sort from "fast-sort";
import {unique} from "shorthash";
import yn from "yn";

import * as api from "./api";
import {TooMuchData} from "./errors";
import {generateBaseState, queryBuilder, queryConverter} from "./query";
import {
  classifyMeasures,
  findByName,
  getDefaultGroup,
  getGeoLevel,
  getIncludedMembers,
  reduceLevelsFromDimension,
  userTableIdMeasure
} from "./sorting";
import {isGeoDimension, isValidDimension} from "./validation";

/**
 * Prepares the array of cubes that will be used in the vizbuilder.
 * Specifically, filters the cubes that aren't for public use, and injects
 * information about the parent cube into the annotations of its measures
 * and levels.
 * @param {Cube[]} cubes An array of cubes. This array is modified in place.
 */
export function injectCubeInfoOnMeasure(cubes) {
  let nCbs = cubes.length;
  while (nCbs--) {
    const cube = cubes[nCbs];
    const cbAnnotations = cube.annotations;

    if (yn(cbAnnotations.hide_in_ui)) {
      cubes.splice(nCbs, 1);
      continue;
    }

    const cbName = cube.caption || cube.name;
    const cbTableId = cbAnnotations.table_id;
    const cbTopic = cbAnnotations.topic || "Other";
    const cbSubtopic = cbAnnotations.subtopic;
    const selectorKey = `${cbTopic}_${cbSubtopic}_`;
    // const sourceName = cbAnnotations.source_name;
    const datasetName = cbAnnotations.dataset_name;
    const cbTagline = cbAnnotations.source_name || "";
    const cbMeta = [cbAnnotations.source_name, cbAnnotations.dataset_name]
      .filter(Boolean)
      .join("_");

    cbAnnotations._key = unique(cbName);

    const cbLevelList = cube.dimensions.filter(isValidDimension);
    let nDim = cube.dimensions.length;
    while (nDim--) {
      const dimension = cube.dimensions[nDim];
      const keyPrefix = `${cbName} ${dimension.name} `;

      dimension.annotations._key = unique(keyPrefix);
      dimension.annotations._nlvls = 0;

      let nHie = dimension.hierarchies.length;
      while (nHie--) {
        const hierarchy = dimension.hierarchies[nHie];

        let nLvl = hierarchy.levels.length;
        dimension.annotations._nlvls += nLvl;
        while (nLvl--) {
          const level = hierarchy.levels[nLvl];

          level.annotations._key = unique(
            `${keyPrefix} ${hierarchy.name} ${level.name}`
          );
        }
      }
    }

    const cbLevelNameList = cbLevelList
      .sort((a, b) => {
        const diff = b.annotations._nlvls - a.annotations._nlvls;
        return diff !== 0 ? diff : `${a.name}`.localeCompare(b.name);
      })
      .map(dim => dim.name);
    const levelKeys = cbLevelNameList.join("_");

    let nMsr = cube.measures.length;
    while (nMsr--) {
      const measure = cube.measures[nMsr];
      const measureLabel = measure.caption || measure.name;
      const msAnnotations = measure.annotations;

      msAnnotations._key = unique(`${cbName} ${measure.name}`);
      msAnnotations._cb_datasetName = datasetName;
      msAnnotations._cb_name = cbName;
      msAnnotations._cb_table_id = cbTableId;
      msAnnotations._cb_tagline = cbTagline;
      msAnnotations._cb_topic = cbTopic || "Other";
      msAnnotations._cb_subtopic = cbSubtopic || "Other";
      // msAnnotations._cb_sourceName = sourceName;
      msAnnotations._dim_labels =
        cbLevelNameList.length > 5
          ? [].concat(
              cbLevelNameList.slice(0, 4),
              `plus ${cbLevelNameList.slice(4).length} more`
            )
          : cbLevelNameList;
      msAnnotations._sortKey = selectorKey + measureLabel;
      msAnnotations._searchIndex = `${selectorKey}${measureLabel}_${cbMeta}_${levelKeys}`;
    }
  }
}

/**
 * Retrieves the cube list and prepares the initial state for the first query
 * @param {ExternalQueryParams} params An object with initial state parameters
 */
export function fetchCubes(params, props) {
  const isGeomapOnly =
    props.visualizations.length === 1 && props.visualizations[0] === "geomap";
  const geomapLevels = isGeomapOnly && Object.keys(props.topojson);

  return api.cubes().then(cubes => {
    if (geomapLevels) {
      /*
        keep only cubes with geographical dimensions, whose levels
        are in the list of available geomap configurations
       */
      cubes = cubes.filter(cube => {
        const geoDim = cube.dimensions.find(isGeoDimension);
        return (
          geoDim &&
          reduceLevelsFromDimension([], geoDim).some(
            lvl => geomapLevels.indexOf(lvl.name) > -1
          ) &&
          !yn(cube.annotations.hide_in_map)
        );
      });
    }

    injectCubeInfoOnMeasure(cubes);

    const {measures, measureMap} = classifyMeasures(cubes, isGeomapOnly);
    const measureByDefault = findByName(params.defaultMeasure, measures, true);
    const measure = params.defaultTable
      ? userTableIdMeasure(measureByDefault, measureMap, cubes, params.defaultTable)
      : measureByDefault;

    const newState = generateBaseState(cubes, measure, geomapLevels);

    const newOptions = newState.options;
    newOptions.cubes = cubes;
    newOptions.measures = measures;
    newOptions.measureMap = measureMap;
    newOptions.geomapLevels = geomapLevels;

    const newQuery = newState.query;
    newQuery.groups = getDefaultGroup(
      params.defaultGroup,
      newOptions.levels,
      measure.annotations.ui_default_drilldown
    );
    newQuery.geoLevel = getGeoLevel(newQuery);

    return newState;
  });
}

/**
 * Retrieves all the members for a certain Level.
 * @param {Level} level A mondrian-rest-client Level object
 */
export function fetchMembers(vbQuery, level) {
  const mondrianQuery = queryBuilder({
    queryObject: vbQuery.cube.query,
    measures: [vbQuery.measure.name],
    drilldowns: [level.fullName.slice(1, -1).split("].[")],
    cuts: [],
    filters: [],
    options: {
      nonempty: true,
      distinct: false,
      parents: true,
      debug: false,
      sparse: true
    }
  });
  return api.query(mondrianQuery, "json").then(result => {
    const members = result.data.axes[1].members;
    sort(members).asc("full_name");
    return members;
  });
}

/**
 * Retrieves the dataset for the query in the current Vizbuilder state.
 * @param {Query} query The Vizbuilder's state query object
 * @returns {Promise<QueryResults>}
 */
export function fetchQuery(query, params) {
  const {showConfidenceInt, datacap} = params;
  const measureName = query.measure.name;
  const timeLevelName = query.timeLevel;

  const nameQuery = queryConverter(query, showConfidenceInt);
  const mondrianQuery = queryBuilder(nameQuery);

  return api.query(mondrianQuery).then(result => {
    const dataset = (result.data || {}).data || [];
    sort(dataset).desc(measureName);
    const members = getIncludedMembers(query, dataset);

    let dataAmount = dataset.length;
    if (Array.isArray(members[timeLevelName])) {
      dataAmount *= 1 / members[timeLevelName].length;
    }
    if (dataAmount > datacap) {
      throw new TooMuchData(mondrianQuery, dataAmount);
    }

    return {dataset, members, query};
  });
}

/**
 * @typedef QueryResults
 * @prop {object[]} dataset The dataset for the current query
 * @prop {object} members An object with the list of current member names for the current drilldowns. Is the output of the `getIncludedMembers` function.
 */
