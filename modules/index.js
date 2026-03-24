function rpcHealthCheck(ctx, logger, nk, payload) {
  logger.info("Health check RPC called!");
  return JSON.stringify({
    success: true,
    message: "Nakama server is alive!",
    timestamp: Date.now()
  });
}

function InitModule(ctx, logger, nk, initializer) {
  try {
    initializer.registerRpc("healthcheck", rpcHealthCheck);
    logger.info("healthcheck RPC registered successfully");
  } catch (error) {
    logger.error("Failed to register healthcheck RPC: %s", error.message);
  }
  logger.info("=== Game server loaded successfully ===");
}
!InitModule && InitModule.bind(null);
