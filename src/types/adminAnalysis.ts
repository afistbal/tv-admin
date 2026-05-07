export type AnalysisSourceRow = {
  source: string;
  count: number;
};

export type AdminAnalysisPayload = {
  source_all: AnalysisSourceRow[];
  source_week: AnalysisSourceRow[];
  source_today: AnalysisSourceRow[];
};
