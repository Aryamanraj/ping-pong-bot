export default () => {
  return {
    NODE_ENV: process.env.NODE_ENV,
    POSTGRES_HOST: process.env.POSTGRES_HOST,
    POSTGRES_PORT: parseInt(process.env.POSTGRES_PORT),
    POSTGRES_USER: process.env.POSTGRES_USER,
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
    POSTGRES_DB: process.env.POSTGRES_DB,
    PORT: parseInt(process.env.PORT) || 3001,
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
    NODE_URL: process.env.NODE_URL,
    NODE_WSS_URL: process.env.NODE_WSS_URL,
    ADMIN_API_KEY: process.env.ADMIN_API_KEY,
    ADMIN_PVT_KEY: process.env.ADMIN_PVT_KEY,
    NETWORK_NAME: process.env.NETWORK_NAME,
  };
};
