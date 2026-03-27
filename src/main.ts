import { rpcHealthCheck } from './healthcheck';
import { rpcCreateMatch, matchInit, matchJoin,matchmakerMatched, matchJoinAttempt, matchLeave, matchLoop, matchSignal, matchTerminate, rpcGetStats, rpcGetMatchDetail, rpcGetLeaderboard } from './match';
import { MODULE_NAME } from './constants';

// initializes module and registers handlers
function InitModule(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer
): void {

  try {
    // registers healthcheck rpc
    initializer.registerRpc("healthcheck", rpcHealthCheck);
    logger.info("healthcheck RPC registered");
  } catch (error) {
    logger.error("Failed: %s", error.message);
  }

  try {
    // creates global wins leaderboard
    nk.leaderboardCreate(
      "global_wins",
      false,
      nkruntime.SortOrder.DESCENDING,
      nkruntime.Operator.INCREMENTAL,
      null,
      {}
    );
    logger.info("Global wins leaderboard created");
  } catch (error) {
    logger.warn("Leaderboard creation failed (might already exist): %s", error.message);
  }

  try {
    // registers match handlers and rpcs
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
    initializer.registerRpc("get_match_detail", rpcGetMatchDetail);
    initializer.registerRpc("get_leaderboard", rpcGetLeaderboard);

    initializer.registerMatchmakerMatched(matchmakerMatched);
    
    logger.info("match handler registered");
  } catch (error) {
    logger.error("Failed: %s", error.message);
  }

  logger.info("=== Game server loaded successfully ===");
}

!InitModule && InitModule.bind(null);
