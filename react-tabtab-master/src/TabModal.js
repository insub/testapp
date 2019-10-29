// @flow
import * as React from 'react';
import Poppop from 'react-poppop';
import {SortableContainer} from 'react-sortable-hoc';
import SortMethod from './SortMethod';

type Props = {
  closeModal: (event: any) => void,
  handleTabSequence: (event: any) => void,
  handleTabChange: (event: any) => void,
  activeIndex: number,
  children: React.Node
};

const DragTabContainer = SortableContainer(({children}) => {
  return (
    <div style={{marginTop: '50px'}} className='tab-modal-container'>
      {children}
    </div>
  );
});

class ModalTabListWrapper extends SortMethod {
  render() {
    return (
      <DragTabContainer onSortEnd={this.onSortEnd}
                        axis='y'
                        lockAxis='y'
                        helperClass={"tabbar-modal-dragging"}
                        // if no pressDelay, close button cannot be triggered,
                        // because it would always treat click as dnd action
                        // insub move pressDelay to distance , we don't need mobile
                        distance={2}>
        {this.props.children}
      </DragTabContainer>
    );
  }
}

export default class TabModal extends React.Component<Props> {
  render() {
    return (
      <Poppop open={true}
              onClose={this.props.closeModal}
              closeOnEsc={true}
              overlayStyle={this.props.modalOverlayStyle}
              contentStyle={this.props.modalContentStyle}>
        <ModalTabListWrapper handleTabSequence={this.props.handleTabSequence}
                             handleTabChange={this.props.handleTabChange}
                             activeIndex={this.props.activeIndex} className='tab-modal-tablist'>
          {this.props.children}
        </ModalTabListWrapper>
      </Poppop>
    );
  }
}
