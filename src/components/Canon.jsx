import React, {Component} from "react";
import PropTypes from "prop-types";
import {connect} from "react-redux";
import Loading from "components/Loading";
import d3plus from "d3plus.js";
import Helmet from "react-helmet";

class Canon extends Component {

  getChildContext() {
    const {data} = this.props;
    return {d3plus, data};
  }

  render() {
    const {helmet, locale} = this.context;
    const {children, loading} = this.props;
    return loading ? <Loading />
      : <div id="Canon">
        <Helmet
          htmlAttributes={{lang: locale, amp: undefined}}
          defaultTitle={helmet.title}
          titleTemplate={ `%s | ${helmet.title}` }
          meta={helmet.meta}
          link={helmet.link} />
        { children }
      </div>;
  }

}

Canon.contextTypes = {
  helmet: PropTypes.object,
  locale: PropTypes.string
};

Canon.childContextTypes = {
  data: PropTypes.object,
  d3plus: PropTypes.object
};

Canon.defaultProps = {
  data: {}
};

Canon = connect(state => ({
  data: state.data,
  loading: state.loading
}))(Canon);

export {Canon};