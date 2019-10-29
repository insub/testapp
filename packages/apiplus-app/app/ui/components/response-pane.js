// @flow
import type { Request } from '../../models/request';
import type { Response } from '../../models/response';

import * as React from 'react';
import autobind from 'autobind-decorator';
import fs from 'fs';
import mime from 'mime-types';
import { remote } from 'electron';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import SizeTag from './tags/size-tag';
import StatusTag from './tags/status-tag';
import TimeTag from './tags/time-tag';
import Button from './base/button';
import PreviewModeDropdown from './dropdowns/preview-mode-dropdown';
import ResponseViewer from './viewers/response-viewer';
import ResponseHistoryDropdown from './dropdowns/response-history-dropdown';
import ResponseTimer from './response-timer';
import ResponseTimelineViewer from './viewers/response-timeline-viewer';
import ResponseHeadersViewer from './viewers/response-headers-viewer';
import ResponseCookiesViewer from './viewers/response-cookies-viewer';
import * as models from '../../models';
import { PREVIEW_MODE_SOURCE } from '../../common/constants';
import { getSetCookieHeaders, nullFn } from '../../common/misc';
import { cancelCurrentRequest } from '../../network/network';
import Hotkey from './hotkey';
import * as hotkeys from '../../common/hotkeys';
import ErrorBoundary from './error-boundary';
import iconv from 'iconv-lite';
import * as sync from '../../sync';
import classnames from 'classnames';

type Props = {
  // Functions
  handleSetFilter: Function,
  showCookiesModal: Function,
  handleSetPreviewMode: Function,
  handleSetActiveResponse: Function,
  handleDeleteResponses: Function,
  handleDeleteResponse: Function,
  handleShowRequestSettings: Function,

  // Required
  previewMode: string,
  filter: string,
  filterHistory: Array<string>,
  editorFontSize: number,
  editorIndentSize: number,
  editorKeyMap: string,
  editorLineWrapping: boolean,
  loadStartTime: number,
  responses: Array<Response>,

  // Other
  request: ?Request,
  response: ?Response
};

@autobind
class ResponsePane extends React.PureComponent<Props> {
  constructor(props) {
    super(props);
  }

  _handleGetResponseBody(): Buffer | null {
    if (!this.props.response) {
      return null;
    }

    return models.response.getBodyBuffer(this.props.response);
  }

  async _handleDownloadResponseBody() {
    const { response, request } = this.props;
    if (!response || !request) {
      // Should never happen
      console.warn('No response to download');
      return;
    }

    const { contentType } = response;
    const extension = mime.extension(contentType) || 'unknown';

    const options = {
      title: 'Save Response Body',
      buttonLabel: 'Save',
      defaultPath: `${request.name.replace(/ +/g, '_')}-${Date.now()}.${extension}`
    };

    remote.dialog.showSaveDialog(options, outputPath => {
      if (!outputPath) {
        return;
      }

      const readStream = models.response.getBodyStream(response);
      if (readStream) {
        const to = fs.createWriteStream(outputPath);
        readStream.pipe(to);
        to.on('error', err => {
          console.warn('Failed to save response body', err);
        });
      }
    });
  }

  _handleDownloadFullResponseBody() {
    const { response, request } = this.props;

    if (!response || !request) {
      // Should never happen
      console.warn('No response to download');
      return;
    }

    const headers = response.timeline
      .filter(v => v.name === 'HEADER_IN')
      .map(v => v.value)
      .join('');

    const options = {
      title: 'Save Full Response',
      buttonLabel: 'Save',
      defaultPath: `${request.name.replace(/ +/g, '_')}-${Date.now()}.txt`
    };

    remote.dialog.showSaveDialog(options, filename => {
      if (!filename) {
        return;
      }

      const readStream = models.response.getBodyStream(response);
      if (readStream) {
        const to = fs.createWriteStream(filename);
        to.write(headers);
        readStream.pipe(to);
        to.on('error', err => {
          console.warn('Failed to save full response', err);
        });
      }
    });
  }

  render() {
    const {
      request,
      responses,
      response,
      previewMode,
      handleShowRequestSettings,
      handleSetPreviewMode,
      handleSetActiveResponse,
      handleDeleteResponses,
      handleDeleteResponse,
      handleSetFilter,
      loadStartTime,
      editorLineWrapping,
      editorFontSize,
      editorIndentSize,
      editorKeyMap,
      filter,
      filterHistory,
      showCookiesModal,
      verticalPaneMode,
      collapseResponse,
      toggleCollapseResponse
    } = this.props;

    {
      /*const paneClasses = 'response-pane theme--pane pane ver_collapse hor_collapse';*/
    }
    const paneClasses = 'response-pane theme--pane pane ';
    const paneHeaderClasses = 'pane__header theme--pane__header';
    const paneBodyClasses = 'pane__body theme--pane__body';

    if (!request) {
      return (
        <section className={paneClasses  + ' apiplus_init ver_collapse'}>
          <header className={paneHeaderClasses} />
          <div className={paneBodyClasses + ' pane__body--placeholder'} />
        </section>
      );
    }

    if (!response) {
      return (
        <section className={
          paneClasses +
          (this.props.verticalPaneMode ? ' ver_' : ' hor_') +
          (this.props.collapseResponse ? 'collapse' : '') + ' apiplus_init'
        }>
        <button className="horBtn" onClick={this.props.toggleCollapseResponse}>
          <i className="apiplus api-more" />
        </button>
        <button className="verBtn" onClick={this.props.toggleCollapseResponse}>
          <i className="apiplus api-more_ver" />
        </button>
          <header className={paneHeaderClasses  + ' no_response'}/>
          <div className={paneBodyClasses + ' pane__body--placeholder' + ' no_response'}>
            <div className="response_nodata_box">
              <h1>No Response Yet</h1>
              <p>Response will display in this panel after you send request</p>
              <table className="table--fancy">
                <tbody>
                  <tr>
                    <td>Send Request</td>
                    <td className="text-right">
                      <code>
                        <Hotkey hotkey={hotkeys.SEND_REQUEST} />
                      </code>
                    </td>
                  </tr>
                  <tr>
                    <td>Toggle Collapse Response</td>
                    <td className="text-right">
                      <code>
                        <Hotkey hotkey={hotkeys.COLLAPSE_RESPONSE} />
                      </code>
                    </td>
                  </tr>
                  {/*<tr>
                    <td>Manage Cookies</td>
                    <td className="text-right">
                      <code>
                        <Hotkey hotkey={hotkeys.SHOW_COOKIES} />
                      </code>
                    </td>
                  </tr>
                  <tr>
                    <td>Edit Environments</td>
                    <td className="text-right">
                      <code>
                        <Hotkey hotkey={hotkeys.SHOW_ENVIRONMENTS} />
                      </code>
                    </td>
                  </tr>*/}
                </tbody>
              </table>
            </div>
          </div>

          <ResponseTimer
            handleCancel={cancelCurrentRequest}
            loadStartTime={loadStartTime}
            request={request}
          />
        </section>
      );
    }

    const cookieHeaders = getSetCookieHeaders(response.headers);

    let colorClass;
    const firstChar = (response.statusCode + '')[0] || '';
    switch (firstChar) {
      case '1':
        colorClass = 'bg-info';
        break;
      case '2':
        colorClass = 'bg-success';
        break;
      case '3':
        colorClass = 'bg-surprise';
        break;
      case '4':
        colorClass = 'bg-warning';
        break;
      case '5':
        colorClass = 'bg-danger';
        break;
      case '0':
        colorClass = 'bg-danger';
        break;
      default:
        colorClass = 'bg-surprise';
        break;
    }

    return (
      <section
        className={
          paneClasses + 'save_response' + 
          (this.props.verticalPaneMode ? ' ver_' : ' hor_') +
          (this.props.collapseResponse ? 'collapse' : '')
        }>
        <button className="horBtn" onClick={this.props.toggleCollapseResponse}>
          <i className="apiplus api-more" />
        </button>
        <button className="verBtn" onClick={this.props.toggleCollapseResponse}>
          <i className="apiplus api-more_ver" />
        </button>
        {!response ? null : (
          <header className={paneHeaderClasses + ' row-spaced' + ' response_header'}>
            <div className={"no-wrap scrollable scrollable--no-bars pad-left response_info " + classnames(colorClass)}>
              <p className="response_title"><span className="title_text">Response.</span><span className="response_counts">{responses.length}</span></p>
              <StatusTag loadStartTime={loadStartTime} responseId={response._id} statusCode={response.statusCode} statusMessage={response.statusMessage} />
              <p className="tag reurl">{response.url ? response.url : ''}</p>
              <TimeTag milliseconds={response.elapsedTime} />
              <SizeTag bytesRead={response.bytesRead} bytesContent={response.bytesContent} />
            </div>
            <div className="response_ctrl no-wrap">
            <ResponseHistoryDropdown
                activeResponse={response}
                responses={responses}
                requestId={request._id}
                handleSetActiveResponse={handleSetActiveResponse}
                handleDeleteResponses={handleDeleteResponses}
                handleDeleteResponse={handleDeleteResponse}
                onChange={nullFn}
                className="tall pane__header__right"
                right
              />

              <button className={this.props.nrLoading ? "convert_btn can_push pushing" : "convert_btn"} onClick={this.props.handlePushResponseBody}>
                <div className={"push_btn " + (this.props.nrLoading ? 'pushing' : '')}>

                <svg width="13px" height="13px" viewBox="0 0 18 18" version="1.1" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.9947683,9.37798507 C17.5023015,9.04824792 16.941441,8.83475175 16.3572366,8.74921171 C16.3495197,7.52573796 16.0350459,6.29109967 15.3821173,5.16019412 C13.3487052,1.63822116 8.80268893,0.456033965 5.22830567,2.51970511 C1.6539224,4.58337625 0.404718397,9.11143545 2.43813043,12.6334084 C4.47154246,16.1553814 9.01755877,17.3375686 12.591942,15.2738974 C12.609102,15.2639901 12.6262085,15.2540259 12.6432612,15.2440054 C13.0651464,15.7468022 13.5980408,16.1233313 14.1858431,16.3590036 C13.9664136,16.5132427 13.7382375,16.6590526 13.5015028,16.7957314 C9.19686917,19.2810128 3.69255552,17.8061364 1.20727414,13.5015028 C-1.27800723,9.19686917 0.196869166,3.69255552 4.50150278,1.20727414 C8.80613639,-1.27800723 14.31045,0.196869166 16.7957314,4.50150278 C17.6828826,6.03809375 18.0654229,7.72755027 17.9947683,9.37798507 L17.9947683,9.37798507 Z M14.6665663,13.8136806 C14.2523527,13.0962417 14.4981655,12.1788561 15.2156044,11.7646425 C15.9330433,11.3504289 16.8504289,11.5962417 17.2646425,12.3136806 C17.6788561,13.0311195 17.4330433,13.9485051 16.7156044,14.3627187 C15.9981655,14.7769323 15.0807798,14.5311195 14.6665663,13.8136806 Z" id="Shape"></path>
                </svg>
                </div>
                <span>Documention</span>
              </button>
            </div>
            <button className="collapse_btn" onClick={this.props.toggleCollapseResponse}>
              <i className="apiplus api-downarrow"/>
            </button>
            {/*<div className="animation_response">
            <div className="saving_animation_first"></div>
            <div className="saving_animation_second"></div>
            <div className="saving_animation_third"></div>
            </div>*/}
          </header>
        )}
        <Tabs className={paneBodyClasses + ' react-tabs'} forceRenderTabPanel>
          <TabList>
            <Tab>
              <PreviewModeDropdown
                download={this._handleDownloadResponseBody}
                fullDownload={this._handleDownloadFullResponseBody}
                previewMode={previewMode}
                updatePreviewMode={handleSetPreviewMode}
              />
            </Tab>
            <Tab>
              <Button>
                Header{' '}
                {response.headers.length > 0 && (
                  <span className="bubble">{response.headers.length}</span>
                )}
              </Button>
            </Tab>
            <Tab>
              <Button>
                Cookie{' '}
                {cookieHeaders.length ? (
                  <span className="bubble">{cookieHeaders.length}</span>
                ) : null}
              </Button>
            </Tab>
            <Tab>
              <Button>Timeline</Button>
            </Tab>
          </TabList>
          <TabPanel className="react-tabs__tab-panel">
            <ResponseViewer
              // Send larger one because legacy responses have bytesContent === -1
              responseId={response._id}
              bytes={Math.max(response.bytesContent, response.bytesRead)}
              contentType={response.contentType || ''}
              previewMode={response.error ? PREVIEW_MODE_SOURCE : previewMode}
              filter={filter}
              filterHistory={filterHistory}
              updateFilter={response.error ? null : handleSetFilter}
              download={this._handleDownloadResponseBody}
              getBody={this._handleGetResponseBody}
              error={response.error}
              editorLineWrapping={editorLineWrapping}
              editorFontSize={editorFontSize}
              editorIndentSize={editorIndentSize}
              editorKeyMap={editorKeyMap}
              url={response.url}
            />
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel scrollable-container">
            <div className="scrollable pad">
              <ErrorBoundary key={response._id} errorClassName="font-error pad text-center">
                <ResponseHeadersViewer headers={response.headers} />
              </ErrorBoundary>
            </div>
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel scrollable-container">
            <div className="scrollable pad">
              <ErrorBoundary key={response._id} errorClassName="font-error pad text-center">
                <ResponseCookiesViewer
                  handleShowRequestSettings={handleShowRequestSettings}
                  cookiesSent={response.settingSendCookies}
                  cookiesStored={response.settingStoreCookies}
                  showCookiesModal={showCookiesModal}
                  headers={cookieHeaders}
                />
              </ErrorBoundary>
            </div>
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel">
            <ErrorBoundary key={response._id} errorClassName="font-error pad text-center">
              <ResponseTimelineViewer
                timeline={response.timeline || []}
                editorLineWrapping={editorLineWrapping}
                editorFontSize={editorFontSize}
                editorIndentSize={editorIndentSize}
              />
            </ErrorBoundary>
          </TabPanel>
        </Tabs>
        <ErrorBoundary errorClassName="font-error pad text-center">
          <ResponseTimer
            handleCancel={cancelCurrentRequest}
            loadStartTime={loadStartTime}
            request={request}
          />
        </ErrorBoundary>
      </section>
    );
  }
}

export default ResponsePane;
