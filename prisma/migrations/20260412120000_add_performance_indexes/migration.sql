-- CreateIndex: covers WHERE status IN (...) ORDER BY kickoffTime
CREATE INDEX "Match_status_kickoffTime_idx" ON "Match"("status", "kickoffTime");

-- CreateIndex: covers WHERE externalLeagueId = ? ORDER BY kickoffTime
CREATE INDEX "Match_externalLeagueId_kickoffTime_idx" ON "Match"("externalLeagueId", "kickoffTime");

-- CreateIndex: covers WHERE matchId = ? (reverse lookup from match to predictions)
CREATE INDEX "Prediction_matchId_idx" ON "Prediction"("matchId");

-- CreateIndex: covers WHERE userId = ? ORDER BY createdAt DESC (predictions history page)
CREATE INDEX "Prediction_userId_createdAt_idx" ON "Prediction"("userId", "createdAt" DESC);
