module.exports = {
  name: 'apiplus-dark',
  displayName: 'apiplusDark',
  theme: {
    foreground: {
      default: '#9399A9',
      tag: '#48505D',
      light: '#8F919E',
      paster: '#D4DCF6',
      post: '#56b6c2',
      get: '#61CD92',
      patch: '#e4a952',
      put: '#C974EC',
      others: '#e4a952',
      delete: '#E3584A'
    },
    background: {
      default: '#292C34',
      success: '#06DE6F',
      notice: '#e3a96c',
      warning: '#FFD052',
      danger: '#FF6D6D',
      surprise: '#c678dd',
      info: '#56b6c2',
      main: '#4C75E5',
      gray: '#1B1D23',
      silver: '#2D313A',
      window: '#282C34',
      darkline: '#1B1D23',
      line: '#1B1D23',
      light: "#292C34",
      tab: '#22252B',
      tabborder: '#1A1B23',
      tabactive: '#292C34',
      tabhover: '#1A1B23',
      white: '#2D313A',
      paster: '#313540',
      saving: '#1E2127',
      post: '#56b6c2',
      put: '#513aa9',
      patch: '#e4a952',
      put: '#C974EC',
      others: '#e4a952',
      delete: '#E3584A',
      get: '#61CD92'
    },
    highlight: {
      default: '#ABB2C0',
      md: '#2D313A',
      sm: '#292C34'
    },
    rawCss: `
      .tooltip, .dropdown__menu {
        opacity: 0.95;
      }
    `,
    styles: {
      dialog: {
        background: {
          default: '#2D313A',
          silver: '#22252B'
        }
      },
      transparentOverlay: {
        background: {
          default: 'rgba(35, 36, 43, .9)'
          // default: '#000'
        }
      },
      sidebar: {
        foreground:{
          default: '#9EA4B5',
          light: '#61697B'
        },
        background: {
          default: '#22252B'
        },
        highlight: {
          default: '#aaa'
        }
      },
      paneHeader: {
        foreground: {
          default: '#CBCCD7'
        },
        background: {
          default: '#27282C',
          success: '#6ac04b',
          notice: '#ebc742',
          warning: '#ea9f29',
          danger: '#df4b56',
          surprise: '#ed46f9',
          info: '#20bec9',
          lg: '#383A43'
        }
      },
      responseHeader: {
        background:{
          gray: '#22252B'
        }
      },
      noResponseHeader: {
        background:{
          gray: '#22252B'
        }
      },
      responseOverlay :{
       background: {
          default: 'rgba(35, 36, 43, 1)'
        }
      },
      horBtn:{
        foreground:{
          light:'#22252B'
        },
        background: {
          gray: '#2D313A'
        }
      },
      verBtn:{
        foreground:{
          light:'#22252B'
        },
        background: {
          gray: '#2D313A'
        }
      },
      reactTabs: {
        background:{
          gray: '#22252B',
          // silver: '#292C34'
        },
        highlight: {
          sm: '#1B1D23'
        }
      },
      responseTabs: {
        background: {
          tabborder: '#22252B'
        }
      },  
      sendDropdown:{
        foreground:{
          default: '#FFF'
        },
        background:{
          default:'#313640',
          main: '#4068D7'
        }
      },
      // pasterPanel: {
      //   background: {
      //     highlight: '#515A7B'
      //   }
      // },
      sendRequest: {
        foreground:{
          default: '#FFF'
        }
      },
      toolbarBtn: {
        foreground:{
          default: '#9399A9'
        },
        background: {
          default:'#313640',
          white: '#3a3f4a'
        }
      }
    }
  }
}
