const COMMENTS_PATTERN = /(comment|comments|reply|repl(?:y|ies))/i;

export interface DiscoveryBadgeCandidate {
  url: string;
  title: string | null;
  duplicate: boolean;
}

export interface DiscoveryBadgeFlags {
  alreadyInLibrary: boolean;
  recommended: boolean;
  likelyCommentsFeed: boolean;
}

export function isLikelyCommentsFeedCandidate(
  candidate: Pick<DiscoveryBadgeCandidate, "url" | "title">
): boolean {
  return COMMENTS_PATTERN.test(candidate.url) || COMMENTS_PATTERN.test(candidate.title ?? "");
}

export function getDiscoveryBadgeFlags(params: {
  candidate: DiscoveryBadgeCandidate;
  addableCandidateCount: number;
}): DiscoveryBadgeFlags {
  const { candidate, addableCandidateCount } = params;

  return {
    alreadyInLibrary: candidate.duplicate,
    recommended: !candidate.duplicate && addableCandidateCount === 1,
    likelyCommentsFeed: isLikelyCommentsFeedCandidate(candidate),
  };
}
