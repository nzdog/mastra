/**
 * Protocol Recommender Service
 *
 * Provides intelligent recommendations for next protocols based on diagnosed field
 */

export interface ProtocolRecommendation {
  protocol_id: string;
  protocol_name: string;
  reason: string;
  integration_days: number;
}

/**
 * Map of field patterns to recommended protocols
 * This can be expanded as more protocols are added to the system
 */
const FIELD_TO_PROTOCOL_MAP: Record<string, string[]> = {
  // Hustle/Burnout/Urgency fields -> Exit protocols
  hustle: ['exit_1', 'exit_2', 'exit_5'],
  burnout: ['exit_1', 'exit_3', 'exit_5'],
  urgency: ['exit_1', 'exit_4'],
  proving: ['exit_2', 'exit_3'],

  // Coherence field -> Maintenance/Deepening protocols
  coherence: ['exit_5'], // Walking Forward Without Residue

  // Default recommendations
  default: ['exit_1', 'exit_2'],
};

/**
 * Protocol metadata for recommendations
 */
const PROTOCOL_METADATA: Record<string, { name: string; focus: string }> = {
  exit_1: {
    name: 'Field Exit Protocol 1: Knowing When a Field Must End',
    focus: 'recognizing when a field has become unsustainable',
  },
  exit_2: {
    name: 'Field Exit Protocol 2: Composting the Old Signal',
    focus: 'processing and releasing old patterns without shame',
  },
  exit_3: {
    name: 'Field Exit Protocol 3: Extracting the Gifts Without Carrying the Pattern',
    focus: 'harvesting lessons while leaving dysfunctional dynamics behind',
  },
  exit_4: {
    name: 'Field Exit Protocol 4: Designing a Clean Exit',
    focus: 'planning a strategic, sustainable departure from a field',
  },
  exit_5: {
    name: 'Field Exit Protocol 5: Walking Forward Without Residue',
    focus: 'maintaining clarity and coherence after field transition',
  },
};

/**
 * Recommend integration timing based on field intensity
 */
export function getIntegrationTiming(diagnosedField: string): number {
  const lowerField = diagnosedField.toLowerCase();

  // Heavy fields need more integration time
  if (
    lowerField.includes('burnout') ||
    lowerField.includes('collapse') ||
    lowerField.includes('trauma')
  ) {
    return 5; // 5 days
  }

  // Moderate intensity fields
  if (
    lowerField.includes('hustle') ||
    lowerField.includes('proving') ||
    lowerField.includes('urgency')
  ) {
    return 3; // 3 days
  }

  // Lighter fields or coherence-oriented
  if (lowerField.includes('coherence') || lowerField.includes('clarity')) {
    return 2; // 2 days
  }

  // Default timing
  return 3; // 3 days
}

/**
 * Get recommended protocols based on diagnosed field
 */
export function getProtocolRecommendations(
  diagnosedField: string,
  limit: number = 2
): ProtocolRecommendation[] {
  const lowerField = diagnosedField.toLowerCase();

  // Determine which protocol IDs to recommend
  let protocolIds: string[] = [];

  // Check for specific field patterns
  if (lowerField.includes('hustle')) {
    protocolIds = FIELD_TO_PROTOCOL_MAP.hustle;
  } else if (lowerField.includes('burnout')) {
    protocolIds = FIELD_TO_PROTOCOL_MAP.burnout;
  } else if (lowerField.includes('urgency')) {
    protocolIds = FIELD_TO_PROTOCOL_MAP.urgency;
  } else if (lowerField.includes('proving')) {
    protocolIds = FIELD_TO_PROTOCOL_MAP.proving;
  } else if (lowerField.includes('coherence')) {
    protocolIds = FIELD_TO_PROTOCOL_MAP.coherence;
  } else {
    // Default recommendations
    protocolIds = FIELD_TO_PROTOCOL_MAP.default;
  }

  // Get integration timing
  const integrationDays = getIntegrationTiming(diagnosedField);

  // Build recommendations
  const recommendations: ProtocolRecommendation[] = protocolIds
    .slice(0, limit)
    .map((protocolId) => {
      const metadata = PROTOCOL_METADATA[protocolId];
      if (!metadata) {
        return null;
      }

      return {
        protocol_id: protocolId,
        protocol_name: metadata.name,
        reason: `This protocol helps with ${metadata.focus}, which is relevant to your diagnosed field.`,
        integration_days: integrationDays,
      };
    })
    .filter((rec): rec is ProtocolRecommendation => rec !== null);

  return recommendations;
}

/**
 * Format recommendations as markdown for inclusion in summary
 */
export function formatRecommendationsAsMarkdown(
  recommendations: ProtocolRecommendation[]
): string {
  if (recommendations.length === 0) {
    return '';
  }

  let markdown = '\n## Next Steps\n\n';
  markdown += `**Recommended Integration Time:** ${recommendations[0].integration_days} days\n\n`;
  markdown += '**Suggested Next Protocols:**\n\n';

  recommendations.forEach((rec, index) => {
    markdown += `${index + 1}. **${rec.protocol_name}**\n`;
    markdown += `   ${rec.reason}\n\n`;
  });

  return markdown;
}
