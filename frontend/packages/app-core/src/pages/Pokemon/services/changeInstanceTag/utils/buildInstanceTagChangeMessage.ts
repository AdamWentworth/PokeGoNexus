// buildInstanceTagChangeMessage.ts

export function buildInstanceTagChangeMessage(details: string[]): string {
  const maxDetails = 10;
  const hasMore = details.length > maxDetails;
  const displayedDetails = hasMore ? details.slice(0, maxDetails) : details;
  const additionalCount = hasMore ? details.length - maxDetails : 0;
  const listedDetails = displayedDetails.map((detail) => `• ${detail}`);

  if (hasMore) {
    listedDetails.push(`…and ${additionalCount} more items`);
  }

  return `Review these changes:\n${listedDetails.join('\n')}`;
}
