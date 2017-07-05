import React, {Component} from "react";
import {connect} from "react-redux";
import {Link} from "react-router";
import "pages/Home.css";

import {fetchData} from "../../src/actions/fetchData";
import {dataFold} from "d3plus-viz";

import Viz1 from "./Viz1";
import Viz2 from "./Viz2";
import Viz3 from "./Viz3";

import {AnchorLink, CanonComponent, TopicTitle} from "../../src";

const d3plus = {
  shapeConfig: {
    labelConfig: {
      fontFamily: "Comic Sans MS"
    }
  }
};

class Profile extends Component {

  render() {
    const {competitors, topCrop} = this.props.data;
    if (!topCrop) return null;
    return (
      <CanonComponent data={this.props.data} d3plus={d3plus}>
        <div className="home">
          <h1>{ this.props.params.id === "040AF00182" ? "Nigeria" : "Ethopia" }</h1>
          <p>Top Crop ID (from "preneed"): { topCrop.crop }</p>
          <p>{ topCrop.crop } Competitors ("need" using "preneed" in URL): { competitors ? competitors.map(c => c.geo_name).join(", ") : "Loading" }</p>
          <TopicTitle slug="agriculture">Agriculture</TopicTitle>
          <Viz1 />
          <TopicTitle slug="climate">Climate</TopicTitle>
          <Viz2 />
          <Viz3 />
          <Link to="/profile/040AF00182">Jump to Nigeria</Link>
          <Link to="/profile/040AF00079">Jump to Ethopia</Link>
          <AnchorLink className="custom-class" to="agriculture">Jump to Agriculture</AnchorLink>
        </div>
      </CanonComponent>
    );
  }
}

const topCropUrl = "https://api.dataafrica.io/api/join/?show=year,crop&sumlevel=latest_by_geo,lowest&required=harvested_area&order=harvested_area&sort=desc&display_names=true&geo=<id>&limit-1";
Profile.preneed = [
  fetchData("topCrop", topCropUrl, res => dataFold(res)[0])
];

Profile.need = [
  Viz1, Viz2, Viz3,
  fetchData("competitors", "api/join/?show=geo&sumlevel=adm0&crop=<topCrop.crop>&required=harvested_area&order=harvested_area&sort=desc&display_names=true"),
  fetchData("value_of_production", "api/join/?geo=<id>&show=crop&required=harvested_area,value_of_production&order=value_of_production&sort=desc&display_names=true&limit=5")
];

export default connect(state => ({
  data: state.data
}), {})(Profile);