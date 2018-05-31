//import {Treemap, Donut, Pie, BarChart, StackedArea} from "d3plus-react";
import {uuid} from "d3plus-common";

/*export const charts = {
  Treemap,
  Donut,
  Pie,
  BarChart,
  StackedArea
};*/

export const legendConfig = {
  label: false,
  shapeConfig: {
    width: 0,
    height: 0
  }
};

export const timelineConfig = {
  // time: !isOpen ? "ID Year" : ""
};

export const colorScaleConfig = {
  colorScale: false,
  colorScaleConfig: {
    color: "#0D47A1",
    scale: "jenks"
  }
};

export default function createConfig(chartConfig) {
  const x = chartConfig.groupBy;
  const measure = chartConfig.measure;

  // Confs of Viz
  const vizConfig = {
    groupBy: chartConfig.dimension,
    total: d => d[measure.name],
    totalConfig: {
      fontSize: 14
    },
    sum: d => d[measure.name],
    value: d => d[measure.name]
  };

  let config = {shapeConfig: {duration: 0}, height: 400, legend: false, tooltip: false};

  if (/BarChart/.test(chartConfig.type)) {
    config = {
      ...config,
      groupBy: false,
      x: "ID Year",
      xConfig: {
        title: x
      },
      discrete: "x",
      y: measure.name,
      yConfig: {
        title: measure.name
      }
    };
  }
  else {
    config = {
      ...config,
      ...vizConfig,
      uuid: uuid()

      /* tooltipConfig: {
        title: `<h5 class="title xs-small">${measure.name}</h5>`,
        body: d => d[measure.name]
      }*/
    };
  }

  // groupBy: "ID Year",

  if (chartConfig.type === "Geomap") config.colorScale = measure.name;
  if (chartConfig.type === "BarChart") {
    // config.time = "ID Year";
  }

  if (chartConfig.type === "StackedArea") {
    // config.groupBy = false;
    config.groupBy = chartConfig.dimension;
    config.x = "ID Year";
  }
  if (chartConfig.groupBy) config.groupBy = chartConfig.groupBy;
  if (x) config.x = x;

  return config;
}
