import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import * as constants from '../../../common/constants';
import { showPrompt } from '../modals/index';
import Downshift from 'downshift'

@autobind
class HostDropdown extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      value: props.host
    };
    this.input = React.createRef()
    this._interval = null;
  }

  handleStateChange (changes){
    console.warn("handleStateChange -> ", changes)
    if (changes.selectedItem) {
      this.setChange(changes.selectedItem)
    } else if (changes.hasOwnProperty('inputValue')) {
      this.setChange(changes.inputValue)
    }
  }

  setChange (inputValue){
    this.setState({value: inputValue})
    // 延迟 300 毫秒更新数据库，为了性能
    clearTimeout(this._interval);
    this._interval = setTimeout(() => {
      this.props.hostChange(inputValue);
    }, 300);
  }

  deleteHost (e, index){
    const newHosts = this.props.hosts.concat([]);
    newHosts.splice(index, 1);
    this.props.updateActiveWorkspaceMeta({ hosts: newHosts });
    e.stopPropagation()
  }

  clear (){
    this.setState({value: ""})
    this.input.current.focus()
  }

  render() {
    const { hosts, hostChange, host } = this.props;
    const { value } = this.state;

    return (
      <Downshift
        // onChange={this._onChnage}
        // itemToString={item => (item ? item : '')}
        // initialInputValue={host || "http://localhost"}
        selectedItem={value} onStateChange={this.handleStateChange}
      >
        {({
          getLabelProps,
          getInputProps,
          getToggleButtonProps,
          getMenuProps,
          getItemProps,
          isOpen,
          clearSelection,
          selectedItem,
          inputValue,
          highlightedIndex,
          openMenu,
          closeMenu
        }) => (
          <div className="host_dropdown">
            <input className="host_input"  {...getInputProps({
              ref: this.input,
              onFocus: openMenu,
            })} placeholder='Host' />
            {isOpen && (selectedItem || inputValue) ? (
              <span className="host_dropdown_handle clear" onClick={()=>{clearSelection();this.clear();}}><i className="apiplus api-tab-close"/></span>
            ) : (
              <React.Fragment>
              {isOpen ? (
                <span className="host_dropdown_handle close" onClick={closeMenu}><i className="fa fa-caret-down"/></span>
              ) : (
                <span className="host_dropdown_handle open" onClick={openMenu}><i className="fa fa-caret-down"/></span>
              )}
              </React.Fragment>
            )}
            
            <ul className="host_list" {...getMenuProps()}>
              {isOpen
                ? hosts
                    // .filter(item => !inputValue || item.toLowerCase().includes(inputValue.toLowerCase()))
                    .map((item, index) => (
                      <li 
                        key={item}
                        {...getItemProps({
                          index,
                          item,
                          style: {
                            backgroundColor: highlightedIndex === index ? '--lightgray' : '--white',
                            fontWeight: selectedItem === item ? 'bold' : 'normal',
                          },
                        })}
                      >
                        {item}
                        <button className="delete_host_btn" data-index={index} onClick={(e) => {this.deleteHost(e, index)}}><i className="apiplus api-delete"/></button>                  
                      </li>
                    ))
                : null}
            </ul>
          </div>
        )}
      </Downshift>
    );
  }
}

export default HostDropdown;
