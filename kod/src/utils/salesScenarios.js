import scenarioCatalog from '../../../shared/salesScenarios.json';

export const SALES_SCENARIOS = Array.isArray(scenarioCatalog) ? scenarioCatalog : [];

export const DEFAULT_SCENARIO =
  SALES_SCENARIOS[0] || {
    id: 'default',
    title: 'Všeobecný obchodný scenár',
    description: 'Všeobecný tréningový scenár bez špecifikácie.',
    constraints: [],
  };

export const resolveScenarioById = (scenarioId) => {
  const normalized = typeof scenarioId === 'string' ? scenarioId.trim() : '';
  if (!normalized) return null;
  return SALES_SCENARIOS.find((scenario) => scenario.id === normalized) || null;
};

export const resolveScenarioForSession = (sessionData = {}) => {
  const scenarioFromId = resolveScenarioById(sessionData.scenario_id);
  if (scenarioFromId) return scenarioFromId;

  const scenarioFromTopic = resolveScenarioById(sessionData.topic);
  if (scenarioFromTopic) return scenarioFromTopic;

  const topicValue = typeof sessionData.topic === 'string' ? sessionData.topic.trim() : '';
  if (topicValue) {
    const scenarioByTitle = SALES_SCENARIOS.find(
      (scenario) => scenario.title.toLowerCase() === topicValue.toLowerCase()
    );
    if (scenarioByTitle) return scenarioByTitle;
  }

  if (topicValue) {
    return {
      id: 'legacy_topic',
      title: topicValue,
      description: `Scenár zo staršej relácie: ${topicValue}.`,
      constraints: [],
    };
  }

  return DEFAULT_SCENARIO;
};

export const resolveScenarioIdForVoice = (sessionData = {}) => {
  const scenarioFromId = resolveScenarioById(sessionData.scenario_id);
  if (scenarioFromId) return scenarioFromId.id;
  const scenarioFromTopic = resolveScenarioById(sessionData.topic);
  if (scenarioFromTopic) return scenarioFromTopic.id;
  const topicValue = typeof sessionData.topic === 'string' ? sessionData.topic.trim() : '';
  if (topicValue) {
    const scenarioByTitle = SALES_SCENARIOS.find(
      (scenario) => scenario.title.toLowerCase() === topicValue.toLowerCase()
    );
    if (scenarioByTitle) return scenarioByTitle.id;
  }
  return DEFAULT_SCENARIO.id;
};
