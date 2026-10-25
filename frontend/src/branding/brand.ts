// Brand identity: everything an OEM changes to rebrand the app.
// Image paths point to files in /public.
export interface Brand {
  /** Browser tab title */
  title: string;
  /** Name shown next to the logo in the sidebar */
  appName: string;
  /** Logo in the sidebar, on the login and account pages */
  logo: string;
  /** Image shown for an asset without an uploaded photo */
  assetPlaceholder: string;
}

const brand: Brand = {
  title: 'Portfolio OEE & CMMS',
  appName: 'Portfolio CMMS',
  logo: '/logo.svg',
  assetPlaceholder: '/asset-placeholder.svg',
};

export default brand;
