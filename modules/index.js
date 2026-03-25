function rpcHealthCheck(ctx, logger, nk, payload) {
  logger.info("Health check RPC called!");
  return JSON.stringify({
    success: true,
    message: "Nakama server is alive!",
    timestamp: Date.now()
  });
}

function rpcSaveStats(ctx, logger, nk, payload) {
  var userId = ctx.userId;
  var stats = {
    wins: 0,
    losses: 0,
    draws: 0
  };
  var writeRequest = {
    collection: "player_stats",
    key: "stats",
    userId: userId,
    value: stats,
    permissionRead: 1,
    permissionWrite: 0
  };
  try {
    nk.storageWrite([writeRequest]);
    logger.info("Stats saved for user: %s", userId);
  } catch (error) {
    logger.error("Failed to save stats: %s", error.message);
    throw error;
  }
  return JSON.stringify({
    success: true,
    saved: stats
  });
}
function rpcGetStats(ctx, logger, nk, payload) {
  var userId = ctx.userId;
  var readRequest = {
    collection: "player_stats",
    key: "stats",
    userId: userId
  };
  try {
    var result = nk.storageRead([readRequest]);
    if (result.length === 0) {
      return JSON.stringify({
        wins: 0,
        losses: 0,
        draws: 0
      });
    }
    return JSON.stringify(result[0].value);
  } catch (error) {
    logger.error("Failed to get stats: %s", error.message);
    throw error;
  }
}

function InitModule(ctx, logger, nk, initializer) {
  try {
    initializer.registerRpc("healthcheck", rpcHealthCheck);
    logger.info("healthcheck RPC registered successfully");
  } catch (error) {
    logger.error("Failed to register healthcheck RPC: %s", error.message);
  }
  try {
    initializer.registerRpc("save_stats", rpcSaveStats);
    initializer.registerRpc("get_stats", rpcGetStats);
    logger.info("storage RPCs registered");
  } catch (error) {
    logger.error("Failed to register storage RPCs: %s", error.message);
  }
  logger.info("=== Game server loaded successfully ===");
}
!InitModule && InitModule.bind(null);
