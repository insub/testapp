import React, { PureComponent } from 'react';
import Link from '../base/link';
import {
  CHANGELOG_BASE_URL,
  getAppVersion,
  isMac
} from '../../../common/constants';

class About extends PureComponent {
  render() {
    return (
      <div className="about_box">
        <h2 className="no-margin-top">About apiplus</h2>
        <p>
          <Link href={CHANGELOG_BASE_URL + '/' + getAppVersion() + '/'}>Changelog</Link>
        </p>
      </div>
    );
  }
}

export default About;
