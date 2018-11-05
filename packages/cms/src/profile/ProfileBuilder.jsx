import axios from "axios";
import React, {Component} from "react";
import {connect} from "react-redux";
import {NonIdealState, Tree, Dialog, Intent, Alert} from "@blueprintjs/core";
import NewProfile from "./NewProfile";
import ProfileEditor from "./ProfileEditor";
import SectionEditor from "./SectionEditor";
import TopicEditor from "./TopicEditor";
import PropTypes from "prop-types";
import Search from "../components/Search/Search";
import CtxMenu from "../components/CtxMenu";

import varSwap from "../utils/varSwap";

import deepClone from "../utils/deepClone.js";

import "./ProfileBuilder.css";

const topicIcons = {
  TextViz: "list-detail-view",
  Column: "list"
};

class ProfileBuilder extends Component {

  constructor(props) {
    super(props);
    this.state = {
      nodes: null,
      profiles: null,
      currentNode: null,
      currentSlug: null,
      variablesHash: {},
      preview: "",
      cubeData: {}
    };
  }

  componentDidMount() {
    const treeGet = axios.get("/api/cms/tree");
    const cubeGet = axios.get("/api/cubeData");
    Promise.all([treeGet, cubeGet]).then(resp => {
      const profiles = resp[0].data;
      const cubeData = resp[1].data;
      this.setState({profiles, cubeData}, this.buildNodes.bind(this));
    });
  }

  getChildContext() {
    const {formatters} = this.context;
    const {variablesHash, currentSlug} = this.state;
    return {formatters, variables: variablesHash[currentSlug]};
  }

  /**
   * Decode HTML elements such as &amp;. Taken from:
   * https://stackoverflow.com/questions/3700326/decode-amp-back-to-in-javascript
   */
  decode(str) {
    const elem = document.createElement("textarea");
    elem.innerHTML = str;
    return elem.value;
  }

  buildNodes(openNode) {
    const {profiles} = this.state;
    const {stripHTML} = this.context.formatters;
    const nodes = profiles.map(p => ({
      id: `profile${p.id}`,
      hasCaret: true,
      label: p.slug,
      itemType: "profile",
      masterSlug: p.slug,
      masterDimension: p.dimension,
      data: p,
      childNodes: p.sections.map(s => ({
        id: `section${s.id}`,
        hasCaret: true,
        label: this.decode(stripHTML(s.title)),
        itemType: "section",
        masterSlug: p.slug,
        masterDimension: p.dimension,
        data: s,
        childNodes: s.topics.map(t => ({
          id: `topic${t.id}`,
          hasCaret: false,
          iconName: topicIcons[t.type] || "help",
          label: this.decode(stripHTML(t.title)),
          itemType: "topic",
          masterSlug: p.slug,
          masterDimension: p.dimension,
          data: t
        }))
      }))
    }));
    if (!openNode) {
      this.setState({nodes});
    }
    else {
      this.setState({nodes}, this.handleNodeClick.bind(this, nodes[0]));
    }
  }

  saveNode(node) {
    const payload = {id: node.data.id, ordering: node.data.ordering};
    axios.post(`/api/cms/${node.itemType}/update`, payload).then(resp => {
      resp.status === 200 ? console.log("saved") : console.log("error");
    });
  }

  moveItem(n, dir) {
    const {nodes} = this.state;
    const sorter = (a, b) => a.data.ordering - b.data.ordering;
    n = this.locateNode(n.itemType, n.data.id);
    let parentArray;
    if (n.itemType === "topic") parentArray = this.locateNode("section", n.data.section_id).childNodes;
    if (n.itemType === "section") parentArray = this.locateNode("profile", n.data.profile_id).childNodes;
    if (n.itemType === "profile") parentArray = nodes;
    if (dir === "up") {
      const old = parentArray.find(node => node.data.ordering === n.data.ordering - 1);
      old.data.ordering++;
      n.data.ordering--;
      this.saveNode(old);
      this.saveNode(n);
    }
    if (dir === "down") {
      const old = parentArray.find(node => node.data.ordering === n.data.ordering + 1);
      old.data.ordering--;
      n.data.ordering++;
      this.saveNode(old);
      this.saveNode(n);
    }
    parentArray.sort(sorter);
    this.setState({nodes});
  }

  addItem(n, dir) {
    const {nodes} = this.state;
    const {variablesHash, currentSlug} = this.state;
    const {stripHTML} = this.context.formatters;
    const {formatters} = this.context;
    const variables = variablesHash[currentSlug] ? deepClone(variablesHash[currentSlug]) : null;
    n = this.locateNode(n.itemType, n.data.id);
    let parent;
    let parentArray;
    // For topics and sections, it is sufficient to find the Actual Parent - this parent will have
    // a masterSlug that the newly added item should share
    if (n.itemType === "topic") {
      parent = this.locateNode("section", n.data.section_id);
      parentArray = parent.childNodes;
    }
    else if (n.itemType === "section") {
      parent = this.locateNode("profile", n.data.profile_id);
      parentArray = parent.childNodes;
    }
    // However, if the user is adding a new profile, there is no top-level profile parent whose slug trickles down,
    // therefore we must make a small fake object whose only prop is masterSlug. This is used only so that when we
    // build the new Profile Tree Object, we can set the masterSlug of all three new elements (profile, section, topic)
    // to "parent.masterSlug" and have that correctly reflect the stub object.
    else if (n.itemType === "profile") {
      parent = {masterSlug: "new-profile-slug"};
      parentArray = nodes;
    }
    let loc = n.data.ordering;
    if (dir === "above") {
      for (const node of parentArray) {
        if (node.data.ordering >= n.data.ordering) {
          node.data.ordering++;
          this.saveNode(node);
        }
      }
    }
    if (dir === "below") {
      loc++;
      for (const node of parentArray) {
        if (node.data.ordering >= n.data.ordering + 1) {
          node.data.ordering++;
          this.saveNode(node);
        }
      }
    }

    const objTopic = {
      hasCaret: false,
      itemType: "topic",
      data: {}
    };
    objTopic.data.section_id = n.data.section_id;
    objTopic.data.ordering = loc;
    objTopic.masterSlug = parent.masterSlug;

    const objSection = {
      hasCaret: true,
      itemType: "section",
      data: {}
    };
    objSection.data.profile_id = n.data.profile_id;
    objSection.data.ordering = loc;
    objSection.masterSlug = parent.masterSlug;

    const objProfile = {
      hasCaret: true,
      itemType: "profile",
      data: {}
    };
    objProfile.data.ordering = loc;
    objProfile.masterSlug = parent.masterSlug;

    let obj = null;

    if (n.itemType === "topic") {
      obj = objTopic;
    }
    if (n.itemType === "section") {
      obj = objSection;
      objTopic.data.ordering = 0;
      obj.childNodes = [objTopic];
    }
    if (n.itemType === "profile") {
      obj = objProfile;
      objSection.data.ordering = 0;
      objTopic.data.ordering = 0;
      objSection.childNodes = [objTopic];
      obj.childNodes = [objSection];
    }
    if (obj) {

      const profilePath = "/api/cms/profile/new";
      const sectionPath = "/api/cms/section/new";
      const topicPath = "/api/cms/topic/new";

      if (n.itemType === "topic") {
        axios.post(topicPath, obj.data).then(topic => {
          if (topic.status === 200) {
            obj.id = `topic${topic.data.id}`;
            obj.data = topic.data;
            obj.label = varSwap(this.decode(stripHTML(obj.data.title)), formatters, variables);
            const parent = this.locateNode("section", obj.data.section_id);
            parent.childNodes.push(obj);
            parent.childNodes.sort((a, b) => a.data.ordering - b.data.ordering);
            this.setState({nodes}, this.handleNodeClick.bind(this, obj));
          }
          else {
            console.log("topic error");
          }
        });
      }
      else if (n.itemType === "section") {
        axios.post(sectionPath, obj.data).then(section => {
          obj.id = `section${section.data.id}`;
          obj.data = section.data;
          obj.label = varSwap(this.decode(stripHTML(obj.data.title)), formatters, variables);
          objTopic.data.section_id = section.data.id;
          axios.post(topicPath, objTopic.data).then(topic => {
            if (topic.status === 200) {
              objTopic.id = `topic${topic.data.id}`;
              objTopic.data = topic.data;
              objTopic.label = varSwap(this.decode(stripHTML(objTopic.data.title)), formatters, variables);
              const parent = this.locateNode("profile", obj.data.profile_id);
              parent.childNodes.push(obj);
              parent.childNodes.sort((a, b) => a.data.ordering - b.data.ordering);
              this.setState({nodes}, this.handleNodeClick.bind(this, obj));
            }
            else {
              console.log("section error");
            }
          });
        });
      }
      else if (n.itemType === "profile") {
        axios.post(profilePath, obj.data).then(profile => {
          obj.id = `profile${profile.data.id}`;
          obj.data = profile.data;
          obj.label = obj.data.slug;
          objSection.data.profile_id = profile.data.id;
          axios.post(sectionPath, objSection.data).then(section => {
            objSection.id = `section${section.data.id}`;
            objSection.data = section.data;
            objSection.label = varSwap(this.decode(stripHTML(objSection.data.title)), formatters, variables);
            objTopic.data.section_id = section.data.id;
            axios.post(topicPath, objTopic.data).then(topic => {
              if (topic.status === 200) {
                objTopic.id = `topic${topic.data.id}`;
                objTopic.data = topic.data;
                objTopic.label = varSwap(this.decode(stripHTML(objTopic.data.title)), formatters, variables);
                nodes.push(obj);
                nodes.sort((a, b) => a.data.ordering - b.data.ordering);
                this.setState({nodes}, this.handleNodeClick.bind(this, obj));
              }
              else {
                console.log("profile error");
              }
            });
          });
        });
      }
    }
  }

  confirmDelete(n) {
    this.setState({nodeToDelete: n});
  }

  deleteItem(n) {
    const {nodes} = this.state;
    const {stripHTML} = this.context.formatters;
    // If this method is running, then the user has clicked "Confirm" in the Deletion Alert. Setting the state of
    // nodeToDelete back to false will close the Alert popover.
    const nodeToDelete = false;
    n = this.locateNode(n.itemType, n.data.id);
    // todo: instead of the piecemeal refreshes being done for each of these tiers - is it sufficient to run buildNodes again?
    if (n.itemType === "topic") {
      const parent = this.locateNode("section", n.data.section_id);
      axios.delete("/api/cms/topic/delete", {params: {id: n.data.id}}).then(resp => {
        const topics = resp.data.map(topicData => ({
          id: `topic${topicData.id}`,
          hasCaret: false,
          iconName: topicIcons[topicData.type] || "help",
          label: this.decode(stripHTML(topicData.title)),
          itemType: "topic",
          masterSlug: parent.masterSlug,
          data: topicData
        }));
        parent.childNodes = topics;
        this.setState({nodes, nodeToDelete}, this.handleNodeClick.bind(this, parent.childNodes[0]));
      });
    }
    else if (n.itemType === "section") {
      const parent = this.locateNode("profile", n.data.profile_id);
      axios.delete("/api/cms/section/delete", {params: {id: n.data.id}}).then(resp => {
        const sections = resp.data.map(sectionData => ({
          id: `section${sectionData.id}`,
          hasCaret: true,
          label: this.decode(stripHTML(sectionData.title)),
          itemType: "section",
          masterSlug: parent.masterSlug,
          data: sectionData,
          childNodes: sectionData.topics.map(t => ({
            id: `topic${t.id}`,
            hasCaret: false,
            iconName: topicIcons[t.type] || "help",
            label: this.decode(stripHTML(t.title)),
            itemType: "topic",
            masterSlug: parent.masterSlug,
            data: t
          }))
        }));
        parent.childNodes = sections;
        this.setState({nodes, nodeToDelete}, this.handleNodeClick.bind(this, parent.childNodes[0]));
      });
    }
    else if (n.itemType === "profile") {
      axios.delete("/api/cms/profile/delete", {params: {id: n.data.id}}).then(resp => {
        const profiles = resp.data;
        this.setState({profiles, nodeToDelete}, this.buildNodes.bind(this, true));
      });
    }
  }

  handleNodeClick(node) {
    node = this.locateNode(node.itemType, node.data.id);
    const {nodes, currentNode} = this.state;
    let parentLength = 0;
    if (node.itemType === "topic") parentLength = this.locateNode("section", node.data.section_id).childNodes.length;
    if (node.itemType === "section") parentLength = this.locateNode("profile", node.data.profile_id).childNodes.length;
    if (node.itemType === "profile") parentLength = nodes.length;
    if (!currentNode) {
      node.isSelected = true;
      node.secondaryLabel = <CtxMenu node={node} parentLength={parentLength} moveItem={this.moveItem.bind(this)} addItem={this.addItem.bind(this)} deleteItem={this.confirmDelete.bind(this)} />;
    }
    else if (node.id !== currentNode.id) {
      node.isSelected = true;
      currentNode.isSelected = false;
      node.secondaryLabel = <CtxMenu node={node} parentLength={parentLength} moveItem={this.moveItem.bind(this)} addItem={this.addItem.bind(this)} deleteItem={this.confirmDelete.bind(this)} />;
      currentNode.secondaryLabel = null;
    }
    // This case is needed because, even if the same node is reclicked, its CtxMenu MUST update to reflect the new node (it may no longer be in its old location)
    else if (currentNode && node.id === currentNode.id) {
      node.secondaryLabel = <CtxMenu node={node} parentLength={parentLength} moveItem={this.moveItem.bind(this)} addItem={this.addItem.bind(this)} deleteItem={this.confirmDelete.bind(this)} />;
    }
    if (this.props.setPath) this.props.setPath(node);
    // If the slugs match, the master profile is the same, so keep the same preview
    if (this.state.currentSlug === node.masterSlug) {
      this.setState({currentNode: node});
    }
    // If they don't match, update the currentSlug and reset the preview
    else {
      // An empty search string will automatically provide the highest z-index results.
      // Use this to auto-populate the preview when the user changes profiles.
      axios.get(`/api/search?q=&dimension=${node.masterDimension}`).then(resp => {
        const preview = resp && resp.data && resp.data.results && resp.data.results[0] ? resp.data.results[0].id : "";
        this.setState({currentNode: node, currentSlug: node.masterSlug, preview});
      });
    }
  }

  handleNodeCollapse(node) {
    node.isExpanded = false;
    this.setState({nodes: this.state.nodes});
  }

  handleNodeExpand(node) {
    node.isExpanded = true;
    this.setState({nodes: this.state.nodes});
  }

  /**
   *
   */
  locateProfileNodeBySlug(slug) {
    return this.state.nodes.find(p => p.data.slug === slug);
  }

  /**
   * Called by the NewProfile Modal Popover. profileData contains special metadata that will need to be passed to
   * a script that will populate the search table with the appropriate entities.
   */
  onCreateProfile(profileData) {
    profileData.ordering = this.state.nodes.length;
    axios.post("/api/cms/profile/newScaffold", profileData).then(resp => {
      const profiles = resp.data;
      const profileModalOpen = false;
      this.setState({profiles, profileModalOpen}, this.buildNodes.bind(this));
    });
  }

  /**
   * Given a node type (profile, section, topic) and an id, crawl down the tree and fetch a reference to the Tree node with that id
   */
  locateNode(type, id) {
    const {nodes} = this.state;
    let node = null;
    if (type === "profile") {
      node = nodes.find(p => p.data.id === id);
    }
    else if (type === "section") {
      nodes.forEach(p => {
        const attempt = p.childNodes.find(s => s.data.id === id);
        if (attempt) node = attempt;
      });
    }
    else if (type === "topic") {
      nodes.forEach(p => {
        p.childNodes.forEach(s => {
          const attempt = s.childNodes.find(t => t.data.id === id);
          if (attempt) node = attempt;
        });
      });
    }
    return node;
  }

  /**
   * If a save occurred in one of the editors, the user may have changed the slug/title. This callback is responsible for
   * updating the tree labels accordingly. If the user has changed a slug, the "masterSlug" reference that ALL children
   * of a profile use must be recursively updated as well.
   */
  reportSave(type, id, newValue) {
    let {nodes} = this.state;
    const {variablesHash, currentSlug} = this.state;
    const {stripHTML} = this.context.formatters;
    const {formatters} = this.context;
    const variables = variablesHash[currentSlug] ? deepClone(variablesHash[currentSlug]) : null;
    const node = this.locateNode.bind(this)(type, id);
    // Update the label based on the new value. If this is a section or a topic, this is the only thing needed
    if (node) {
      node.data.title = newValue;
      // todo: determine if this could be merged with formatTreeVariables
      node.label = varSwap(this.decode(stripHTML(newValue)), formatters, variables);
    }
    // However, if this is a profile changing its slug, then all children must be informed so their masterSlug is up to date.
    if (type === "profile") {
      nodes = nodes.map(p => {
        p.masterSlug = newValue;
        p.data.slug = newValue;
        p.childNodes = p.childNodes.map(s => {
          s.masterSlug = newValue;
          s.childNodes = s.childNodes.map(t => {
            t.masterSlug = newValue;
            return t;
          });
          return s;
        });
        return p;
      });
    }
    this.setState({nodes});
  }

  /*
   * Callback for Preview.jsx, pass down new preview id to all Editors
   */
  onSelectPreview(preview) {
    this.setState({preview: preview.id});
  }

  /*
   * When the function "fetchVariables" is called (below), it means that something has
   * happened in one of the editors that requires re-running the generators and storing
   * a new set of variables in the hash. When this happens, it is an opportunity to update
   * all the labels in the tree by varSwapping them, allowing them to appear properly
   * in the sidebar.
   */
  formatTreeVariables() {
    const {variablesHash, currentSlug, nodes} = this.state;
    const {stripHTML} = this.context.formatters;
    const {formatters} = this.context;
    const variables = variablesHash[currentSlug] ? deepClone(variablesHash[currentSlug]) : null;
    const p = this.locateProfileNodeBySlug(currentSlug);
    p.label = varSwap(p.data.slug, formatters, variables);
    p.childNodes = p.childNodes.map(s => {
      s.label = varSwap(this.decode(stripHTML(s.data.title)), formatters, variables);
      s.childNodes = s.childNodes.map(t => {
        t.label = varSwap(this.decode(stripHTML(t.data.title)), formatters, variables);
        return t;
      });
      return s;
    });
    this.setState({nodes});
  }

  /**
   * Certain events in the Editors, such as saving a generator, can change the resulting
   * variables object. In order to ensure that this new variables object is passed down to
   * all the editors, each editor has a callback that accesses this function. We store the
   * variables object in a hash that is keyed by the slug, so we don't re-run the get if
   * the variables are already there. However, we provide a "force" option, which editors
   * can use to say "trust me, I've changed something, you need to re-get the variables get"
   */
  fetchVariables(slug, id, force, callback) {
    const {variablesHash} = this.state;
    const maybeCallback = () => {
      if (callback) callback();
      this.formatTreeVariables.bind(this)();
    };
    if (force || !variablesHash[slug]) {
      if (id) {
        axios.get(`/api/variables/${slug}/${id}`).then(resp => {
          variablesHash[slug] = resp.data;
          this.setState({variablesHash}, maybeCallback);
        });
      }
      else {
        variablesHash[slug] = {_genStatus: {}, _matStatus: {}};
        this.setState({variablesHash}, maybeCallback);
      }
    }
    else {
      this.setState({variablesHash}, maybeCallback);
    }
  }

  render() {

    const {nodes, currentNode, variablesHash, currentSlug, preview, profileModalOpen, cubeData, nodeToDelete} = this.state;

    const {NODE_ENV} = this.props.env;
    if (NODE_ENV === "production") return null;

    if (!nodes) return <div>Loading</div>;

    const variables = variablesHash[currentSlug] ? deepClone(variablesHash[currentSlug]) : null;

    return (

      <div className="cms-panel profile-panel" id="profile-builder">
        <div className="cms-sidebar" id="tree">

          <button className="cms-button"
            onClick={() => this.setState({profileModalOpen: true})}>
              Add Profile <span className="pt-icon pt-icon-plus" />
          </button>

          <Tree
            onNodeClick={this.handleNodeClick.bind(this)}
            onNodeCollapse={this.handleNodeCollapse.bind(this)}
            onNodeExpand={this.handleNodeExpand.bind(this)}
            contents={nodes}

          />
        </div>
        <Dialog
          className="profileModal"
          isOpen={profileModalOpen}
          icon="new-object"
          onClose={() => this.setState({profileModalOpen: false})}
          title="Add New Profile"
        >
          <NewProfile cubeData={cubeData} onCreateProfile={this.onCreateProfile.bind(this)}/>
        </Dialog>
        <Alert
          isOpen={nodeToDelete}
          cancelButtonText="Cancel"
          confirmButtonText="Delete"
          iconName="trash"
          intent={Intent.DANGER}
          onConfirm={() => this.deleteItem.bind(this)(nodeToDelete)}
          onCancel={() => this.setState({nodeToDelete: false})}
        >
          {nodeToDelete ? `Are you sure you want to delete the ${nodeToDelete.itemType} "${nodeToDelete.label}" and all its children? This action cannot be undone.` : ""}
        </Alert>
        <div className="cms-editor" id="item-editor">
          { currentNode &&
            currentSlug &&
            <div id="Search">
              {preview ? `Currently Previewing Data ID: ${preview}` : "Search to Preview"}
              <Search
                render={d => <span onClick={this.onSelectPreview.bind(this, d)}>{d.name}</span>}
                dimension={currentNode.masterDimension}
                limit={20}
              />
            </div>
          }
          { currentNode
            ? currentNode.itemType === "profile"
              ? <ProfileEditor
                id={currentNode.data.id}
                masterSlug={currentNode.masterSlug}
                preview={preview}
                fetchVariables={this.fetchVariables.bind(this)}
                variables={variables}
                reportSave={this.reportSave.bind(this)}
              />
              : currentNode.itemType === "section"
                ? <SectionEditor
                  id={currentNode.data.id}
                  masterSlug={currentNode.masterSlug}
                  preview={preview}
                  fetchVariables={this.fetchVariables.bind(this)}
                  variables={variables}
                  reportSave={this.reportSave.bind(this)}
                />
                : currentNode.itemType === "topic"
                  ? <TopicEditor
                    id={currentNode.data.id}
                    masterSlug={currentNode.masterSlug}
                    preview={preview}
                    fetchVariables={this.fetchVariables.bind(this)}
                    variables={variables}
                    reportSave={this.reportSave.bind(this)}
                  />
                  : null
            : <NonIdealState title="No Profile Selected" description="Please select a Profile from the menu on the left." visual="path-search" />
          }
        </div>

      </div>
    );
  }
}

ProfileBuilder.childContextTypes = {
  formatters: PropTypes.object,
  variables: PropTypes.object
};

ProfileBuilder.contextTypes = {
  formatters: PropTypes.object
};

export default connect(state => ({env: state.env}))(ProfileBuilder);