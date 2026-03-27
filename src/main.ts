import { rpcHealthCheck } from './healthcheck';
import { rpcCreateMatch, matchInit, matchJoin,matchmakerMatched, matchJoinAttempt, matchLeave, matchLoop, matchSignal, matchTerminate, rpcGetStats } from './match';
import { MODULE_NAME } from './constants';

function InitModule(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer
): void {

  try {
    initializer.registerRpc("healthcheck", rpcHealthCheck);
    logger.info("healthcheck RPC registered");
  } catch (error) {
    logger.error("Failed: %s", error.message);
  }

  try {
    // Register the match handler — ALL 7 functions in one call
    initializer.registerMatch(MODULE_NAME, {
      matchInit,
      matchJoinAttempt,
      matchJoin,
      matchLoop,
      matchLeave,
      matchTerminate,
      matchSignal,
    });
    initializer.registerRpc("create_match", rpcCreateMatch);
    initializer.registerRpc("get_stats", rpcGetStats);

    initializer.registerMatchmakerMatched(matchmakerMatched);
    
    logger.info("match handler registered");
  } catch (error) {
    logger.error("Failed: %s", error.message);
  }

  logger.info("=== Game server loaded successfully ===");
}

!InitModule && InitModule.bind(null);