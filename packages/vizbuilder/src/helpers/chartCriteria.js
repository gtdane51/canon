//@ts-check
/**
 * The main function here is chartCriteria
 * This function is in charge of deciding which charts will be rendered for each
 * dataset retrieved from the server.
 */

import {getTopTenByYear} from "./sorting";
import {isGeoDimension} from "./validation";

export default function chartCriteria(query, results, params) {
  /** @type {Datagroup[]} */
  const datagroups = [];

  for (let i = 0; i < results.length; i++) {
    /** @type {Datagroup} */
    const datagroup = results[i];
    datagroups.push(datagroup);

    let {members, query} = datagroup;

    const measureName = query.measure.name;
    const levelName = query.level.name;
    const xlevelName = query.xlevel && query.xlevel.name;
    const timeLevelName = query.timeLevel && query.timeLevel.name;

    const levelMembers = members[levelName] || [];
    const timeLevelMembers = members[timeLevelName] || [];

    const measureAnn = query.measure.annotations;

    const measureFormatter =
      params.formatting[measureAnn.units_of_measurement] ||
      params.formatting["default"];
    const topojsonConfig = params.topojson[levelName];

    const aggregatorType =
      measureAnn.pre_aggregation_method ||
      measureAnn.aggregation_method ||
      query.measure.aggregatorType ||
      "UNKNOWN";

    const availableKeys = Object.keys(members);
    const availableCharts = new Set(params.visualizations);

    const hasTimeLvl = timeLevelName && timeLevelMembers.length > 1;
    const hasGeoLvl = [query.level, query.xlevel].some(
      lvl => lvl && isGeoDimension(lvl.hierarchy.dimension)
    );

    // Hide barcharts with more than 20 members
    if (levelMembers.length > 20) {
      availableCharts.delete("barchart");
    }

    // Hide time scale charts if dataset has not time or only one time
    if (!hasTimeLvl) {
      availableCharts.delete("barchartyear");
      availableCharts.delete("lineplot");
      availableCharts.delete("stacked");
    }

    // Hide geomaps if there no geo levels, or if there's less than 3 members
    if (
      !hasGeoLvl ||
      !topojsonConfig ||
      levelMembers.length < 3 ||
      xlevelName
    ) {
      availableCharts.delete("geomap");
    }

    // Hide invalid charts according to the type of aggregation in the data
    if (aggregatorType === "AVERAGE") {
      availableCharts.delete("donut");
      availableCharts.delete("histogram");
      availableCharts.delete("stacked");
      availableCharts.delete("treemap");
    }
    else if (aggregatorType === "MEDIAN") {
      availableCharts.delete("stacked");
    }
    // @see Issue#327 on {@link https://github.com/Datawheel/canon/issues/327 | GitHub}
    else if (aggregatorType === "NONE") {
      availableCharts.delete("stacked");
      availableCharts.delete("barchart");
    }

    // Hide barchartyear and treemap if aggregation is not SUM or UNKNOWN
    if (aggregatorType !== "SUM" && aggregatorType !== "UNKNOWN") {
      availableCharts.delete("barchartyear");
      availableCharts.delete("treemap");
    }

    // Hide charts that would show a single shape only
    // (that is, if any drilldown, besides Year, only has 1 member)
    if (availableKeys.some(d => d !== "Year" && members[d].length === 1)) {
      availableCharts.delete("barchart");
      availableCharts.delete("stacked");
      availableCharts.delete("treemap");
    }

    datagroup.aggType = aggregatorType;
    datagroup.formatter = measureFormatter;
    datagroup.key = query.key;
    datagroup.names = {
      collectionName: query.collection && query.collection.name,
      lciName: query.lci && query.lci.name,
      levelName,
      measureName,
      moeName: query.moe && query.moe.name,
      sourceName: query.source && query.source.name,
      timeLevelName,
      uciName: query.uci && query.uci.name,
      xlevelName
    };
    datagroup.topojson = topojsonConfig;

    /**
     * If there's more than 60 lines in a lineplot, only show top ten each year
     * due to the implementation, this remove lineplot from this datagroup
     * and creates a new datagroup, lineplot-only, for the new trimmed dataset
     * @see Issue#296 on {@link https://github.com/Datawheel/canon/issues/296 | GitHub}
     */
    let totalMembers = members[levelName].length;
    if (xlevelName) {
      totalMembers *= members[xlevelName].length;
    }
    if (availableCharts.has("lineplot") && totalMembers > 60) {
      availableCharts.delete("lineplot");

      const {newDataset, newMembers} = getTopTenByYear(datagroup);
      datagroups.push({
        ...datagroup,
        charts: ["lineplot"],
        dataset: newDataset,
        members: newMembers
      });
    }

    datagroup.charts = Array.from(availableCharts);
  }

  return datagroups;
}

/**
 * @typedef Datagroup
 * @prop {string} aggType
 * @prop {string[]} charts
 * @prop {any[]} dataset
 * @prop {(d: number) => string} formatter
 * @prop {string} key
 * @prop {Object<string, number[]|string[]>} members
 * @prop {Object<string, string>} names
 * @prop {any} query
 * @prop {any} topojson
 */