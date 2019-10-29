import React from 'react';
// The svg path is from react-icons: https://github.com/gorangajic/react-icons/
// const Svg = ({ d }) => (
//   <svg
//     viewBox="0 0 40 40"
//     fill="currentColor"
//     height="1em"
//     width="1em"
//     style={{ verticalAlign: 'middle' }}>
//     <g>
//       <path d={d} />
//     </g>
//   </svg>
// );

const CloseIcon = () => <i className="apier api-tab-close" />;

const LeftIcon = () => <i className="apier api-tab-prev" />;

const RightIcon = () => <i className="apier api-tab-next" />;

const BulletIcon = () => <i className="apier api-tab-bullet" />;

export { CloseIcon, LeftIcon, RightIcon, BulletIcon };
