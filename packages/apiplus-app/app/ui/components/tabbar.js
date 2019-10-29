// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import ReactDOM from 'react-dom';

import { styled } from 'apier-react-tabtab';
let { TabListStyle, ActionButtonStyle, TabStyle, PanelStyle } = styled;
import HelpTooltip from './help-tooltip';
import Tooltip from './tooltip';
import * as models from '../../models/index';
import * as store from '../../sync/storage';


// rtab import
import {
  Tabs,
  TabList,
  Tab,
  DragTabList,
  DragTab,
  PanelList,
  Panel,
  ExtraButton
} from 'apier-react-tabtab';
import { simpleSwitch } from 'apier-react-tabtab/lib/helpers/move';

TabListStyle = TabListStyle.extend`
  background: #000;
  // write css
`;

TabStyle = TabStyle.extend`
  background: #000;
  // write css
`;

ActionButtonStyle = ActionButtonStyle.extend`
  background: #000;
  // write css
`;

PanelStyle = PanelStyle.extend`
  background: #000;
  // write css
`;

@autobind
class Tabbar extends React.PureComponent<Props, State> {
  constructor(props: any) {
    super(props);
  }

  handleTabChange(index) {
    this.props.handleActivateRequest(this.props.rtabs[index].requestId);
  }

  handleTabSequenceChange({ oldIndex, newIndex }) {
    const newRtabs = simpleSwitch(this.props.rtabs, oldIndex, newIndex);
    this.props.updateActiveWorkspaceMeta({
      rtabs: newRtabs,
      activeRequestId: newRtabs[newIndex].requestId,
      rtabActiveIndex: newIndex
    });
  }

  async handleTabClose({ type, index }) {
    if (type === 'delete') {
      this.props.handleTab('delete', this.props.rtabs[index].requestId);
    }
  }

  render() {
    const {
      activeWorkspace,
      rtabs,
      requests,
      rtabActiveIndex,
      handleActivateRequest,
      handleTab,
      updateActiveWorkspaceMeta,
      sidebarHidden,
      sidebarWidth,
      activeRequest,
      requestMetas
    } = this.props;

    const tabTemplate = [];
    let fixRtabs = [...rtabs]
    for (const rtab of rtabs) {
      const request = requests.find(r => r._id === rtab.requestId);
      if (!request) {
        console.error("rtab can't find request! change to last rtabs or nothing.", rtabs, rtabActiveIndex);
        // 删除找不到 request 的 rtab
        fixRtabs = fixRtabs.filter(e => e.requestId !== rtab.requestId);
        // 跳出本次循环
        continue;
      }
      const requestMeta = requestMetas.find(m => m.parentId === request._id)
      tabTemplate.push(
        <DragTab key={request._id} closable={true}>
        {/*<span className="loading_box"><i className="apiplus api-pull_icon loading_icon loading"/></span>*/}
          {request.isTemp ? (
            <Tooltip
            position="top"
            message="Temp request will not be exported or synced">
            <label className="tab_api_name"><span className={`method_name http-method-${request.method}`}>{request.method}</span> <span className="temp_name">----</span></label>
          </Tooltip>
          ) : (
            <label className="tab_api_name"><span className={`method_name http-method-${request.method}`}>{request.method}</span><span className="name_text"><span className="api_num">{request.showid ? `#${request.showid} ` : null}</span>{request.name}</span></label>
          )}
          <div className={`tab_line http-method-${request.method}`}></div>
          <div className={"status_box" + (requestMeta && requestMeta.unpush ? " unpush" : "") + (requestMeta && requestMeta.unsave ? " unsave" : "")}><span className={(requestMeta && requestMeta.unpush ? "status_symbol unpush " : "") + (requestMeta && requestMeta.unsave ? "status_symbol unsave" : "")} /></div>
          {/*
          <div className="tabUrl">
            <span>{request.method}</span> <span>{request.url}</span>
          </div>
          */}
        </DragTab>
      );
    }

    console.warn("tabTemplate", tabTemplate)

    if (fixRtabs.length != rtabs.length){
      this.props.updateActiveWorkspaceMeta({ rtabs: fixRtabs });
      if (rtabActiveIndex + 1 > fixRtabs.length) {
        this.props.updateActiveWorkspaceMeta({
          activeRequestId: fixRtabs.length ? fixRtabs[fixRtabs.length - 1].requestId : null,
          rtabs: fixRtabs,
          rtabActiveIndex: fixRtabs.length ? fixRtabs.length - 1 : null
        });
      }
    }

    // tabs
    return (
      <section className="app_main_tabs">
        <Tabs
          onTabEdit={this.handleTabClose}
          onTabChange={this.handleTabChange}
          onTabSequenceChange={this.handleTabSequenceChange}
          activeIndex={rtabActiveIndex}
          ExtraButton={
            <ExtraButton onClick={this.props.handleAddTempTab}>
              <i className="apiplus api-tab-add" />
            </ExtraButton>
          }
          showModalButton={3}
          showArrowButton={"auto"}
          modalIsOpen={true}
          distance={2}
          autoCloseModal={true}>
          <DragTabList
            modalOverlayStyle={{ opacity: 0.9 }}
            modalContentStyle={{
              position: "fixed",
              width: 'auto',
              minWidth: 180,
              maxWidth: 400,
              overflowX: 'auto',
              overflowY: 'auto',
              top: 117,
              padding: 0,
              background: 'var(--color-tab)',
              left: this.props.sidebarHidden ? "0.1rem" : this.props.sidebarWidth + 0.1 + "rem",
            }}>
            {tabTemplate}
          </DragTabList>
        </Tabs>
      </section>
    );
  }
}

export default Tabbar;
