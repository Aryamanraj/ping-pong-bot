export const ONCHAIN_CONFIG = {
  development: {
    NODE_URL: 'https://rpc.sepolia.org',
    NODE_WSS_URL: 'wss://ethereum-sepolia-rpc.publicnode.com	',
    READ_ONLY_PVT_KEY:
      '0x6e33b7dc541ef879017bd321d0522049e4d19c381dc99ef981d5ca22cb15e5f8',
    CONTRACT_ADDRESS: '0xF44471FcB4fA4c6574B5f65f203Bff074737edec',
    CHAIN: 'Sepolia',
  },
  test: {
    NODE_URL: 'https://rpc.sepolia.org',
    NODE_WSS_URL: 'wss://ethereum-sepolia-rpc.publicnode.com',
    READ_ONLY_PVT_KEY:
      '0x6e33b7dc541ef879017bd321d0522049e4d19c381dc99ef981d5ca22cb15e5f8',
    CONTRACT_ADDRESS: '0xF44471FcB4fA4c6574B5f65f203Bff074737edec',
    CHAIN: 'Sepolia',
  },
  production: {
    NODE_URL: '',
    NODE_WSS_URL: '',
    READ_ONLY_PVT_KEY: '',
    CONTRACT_ADDRESS: '',
    CHAIN: 'Sepolia',
  },
};
