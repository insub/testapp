import React, { Component } from 'react';
import { Tabs, TabList, Tab, PanelList, Panel } from '../../src';
import { makeData } from './utils';

export default class Modal extends Component {
  constructor(props) {
    super(props);
    const tabs = makeData(50);
    this.state = {
      tabs
    };
  }

  render() {
    const tabTemplate = [];
    const panelTemplate = [];
    this.state.tabs.forEach((tab, i) => {
      tabTemplate.push(<Tab key={i}>{tab.title}</Tab>);
      panelTemplate.push(<Panel key={i}>{tab.content}</Panel>);
    });
    return (
      <Tabs customStyle={this.props.customStyle} autoCloseModal={true}>
        <TabList
          modalOverlayStyle={{ opacity: 0.9 }}
          modalContentStyle={{ backgroundColor: 'black' }}>
          {tabTemplate}
        </TabList>
        <PanelList>{panelTemplate}</PanelList>
      </Tabs>
    );
  }
}
