module.exports = {
  name: 'apiplus-gray',
  displayName: 'Apiplus-Gray',
  theme: {
    foreground: {
      default: '#353535'
    },
    background: {
      default: '#FFF',
      success: '#2FBA5B',
      notice: '#EDA227',
      warning: '#f9ac2a',
      danger: '#f97e88',
      surprise: '#f24aff',
      info: '#5BA2EC',
      gray: '#D7D7D7'
    },
    rawCss: `
      .tooltip, .dropdown__menu {
        opacity: 1;
      }
    `,
    styles: {
      dialog: {
        background: {
          default: '#FFF'
        }
      },
      transparentOverlay: {
        background: {
          default: 'rgba(0, 0, 0, 0.5)'
        }
      },
      sidebar: {
        highlight: {
          default: '#aaa'
        },
        background: {
          default: '#F3F3F3'
        }
      },
      paneHeader: {
        background: {
          default: 'transparent',
          success: '#1ACA04',
          notice: '#ebc742',
          warning: '#FF9300',
          danger: '#F64444',
          surprise: '#FF9300',
          info: '#20bec9',
        },
        highlight:{
          default: '#666'
        }
      },
      sendBtn:{
        foreground:{
          default: '#FFF'
        }
      },
      sendDropdown:{
        foreground:{
          default: '#FFF'
        },
        background: {
          main: '#3475E5'
        }
      }
    }
  }
};
