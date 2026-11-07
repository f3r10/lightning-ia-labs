import withMdkCheckout, { type NextConfigOverrides } from "@moneydevkit/nextjs/next-plugin";
const nextConfig: NextConfigOverrides = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
};

export default withMdkCheckout(nextConfig);
