import * as api from "../helpers/api";
import {
  addTimeDrilldown,
  getMeasureMOE,
  getValidDrilldowns,
  getValidMeasures
} from "../helpers/sorting";

/**
 * These functions should be handled/called with `this`
 * as the component where they are used.
 */

export function fetchCubes() {
  return api
    .cubes()
    .then(cubes => {
      const firstCube = cubes[0];
      const measures = getValidMeasures(cubes);
      const levels = getValidDrilldowns(firstCube);
      const drilldowns = addTimeDrilldown(levels.slice(0, 1), firstCube);
      const firstMeasure = firstCube.measures[0];
      const firstMoe = getMeasureMOE(firstCube, firstMeasure);

      return {
        options: {cubes, measures, levels},
        query: {
          cube: firstCube,
          measure: firstMeasure,
          moe: firstMoe,
          drilldowns
        }
      };
    })
    .then(this.context.stateUpdate);
}

export function fetchMembers(level) {
  return api.members(level).then(members => this.setState({members}));
}

export function fetchQuery() {
  const {query} = this.props;
  const {datasetUpdate} = this.context;

  return api.query(query).then(result => {
    const data = result.data || {};
    return datasetUpdate(data.data);
  });
}
